import Redis from "ioredis";

type CacheValue = string;

interface CacheClient {
  get(key: string): Promise<CacheValue | null>;
  set(key: string, value: CacheValue, ttlSeconds?: number): Promise<void>;
}

type CacheBackend = "redis" | "memory";

const CACHE_FAILURE_LOG_INTERVAL_MS = 30_000;

class InMemoryCache implements CacheClient {
  private store = new Map<string, { value: CacheValue; expiresAt: number | null }>();

  async get(key: string): Promise<CacheValue | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: CacheValue, ttlSeconds?: number): Promise<void> {
    const expiresAt =
      ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }
}

class RedisBackedCache implements CacheClient {
  constructor(
    private readonly client: Redis,
    private readonly fallback: InMemoryCache
  ) {}

  async get(key: string): Promise<CacheValue | null> {
    try {
      const value = await this.client.get(key);
      markRedisHealthy();
      return value;
    } catch (error) {
      markRedisDegraded();
      logCacheFailure("get", error);
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: CacheValue, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, "EX", ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      markRedisHealthy();
    } catch (error) {
      markRedisDegraded();
      logCacheFailure("set", error);
      await this.fallback.set(key, value, ttlSeconds);
    }
  }
}

let redisClient: Redis | null = null;
let cacheClient: CacheClient | null = null;
let cacheBackend: CacheBackend = "memory";
let lastCacheFailureLogAt = 0;
let redisDegraded = false;
let redisReachable: boolean | null = null;

function markRedisHealthy(): void {
  redisDegraded = false;
  redisReachable = true;
}

function markRedisDegraded(): void {
  redisDegraded = true;
  redisReachable = false;
}

/**
 * Strip anything that looks like credentials from an error before it reaches a
 * log line, so a connection failure can never leak the basic-auth user/password
 * embedded in a Redis URL.
 */
function sanitizeCacheError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\/\/[^@\s/]*@/g, "//***@");
}

function logCacheFailure(operation: string, error: unknown): void {
  const now = Date.now();
  if (now - lastCacheFailureLogAt < CACHE_FAILURE_LOG_INTERVAL_MS) {
    return;
  }
  lastCacheFailureLogAt = now;
  // eslint-disable-next-line no-console
  console.warn(
    `[cache] Redis ${operation} failed, using in-memory fallback: ${sanitizeCacheError(error)}`
  );
}

const REDIS_CONNECT_TIMEOUT_MS = 10_000;
const REDIS_RECONNECT_MAX_DELAY_MS = 30_000;

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }
  const client = new Redis(url, {
    // Fail fast: a command issued while disconnected rejects immediately instead
    // of queueing, so a Redis outage never blocks a request.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    // ioredis reconnects on its own; the backoff is capped so a long outage does
    // not turn into a tight reconnect loop. We never create a client per request.
    retryStrategy: (times: number) => Math.min(times * 1_000, REDIS_RECONNECT_MAX_DELAY_MS)
  });

  client.on("ready", () => {
    markRedisHealthy();
  });
  client.on("end", () => {
    redisReachable = false;
  });
  client.on("error", (error: unknown) => {
    redisReachable = false;
    logCacheFailure("connection", error);
  });

  return client;
}

function getCacheClient(): CacheClient {
  if (cacheClient) {
    return cacheClient;
  }

  redisClient = createRedisClient();

  if (redisClient) {
    cacheBackend = "redis";
    cacheClient = new RedisBackedCache(redisClient, new InMemoryCache());
  } else {
    cacheBackend = "memory";
    cacheClient = new InMemoryCache();
  }

  return cacheClient;
}

export function getCacheStatus(): {
  backend: CacheBackend;
  redisConfigured: boolean;
  degraded: boolean;
  reachable: boolean | null;
} {
  getCacheClient();
  return {
    backend: cacheBackend,
    redisConfigured: Boolean(process.env.REDIS_URL),
    degraded: cacheBackend === "redis" && redisDegraded,
    reachable: redisReachable
  };
}

/**
 * Validate the Redis connection once, at startup. A failure is logged clearly
 * (without credentials) and the server keeps running on the in-memory cache —
 * but the degraded state is recorded so it is never mistaken for a healthy
 * shared cache.
 */
export async function validateCacheConnection(): Promise<boolean> {
  if (!process.env.REDIS_URL) {
    cacheBackend = "memory";
    // eslint-disable-next-line no-console
    console.warn(
      "[cache] REDIS_URL is not set. Using an in-memory cache; this is not safe for multi-instance deployments."
    );
    return false;
  }

  getCacheClient();
  if (!redisClient) {
    return false;
  }

  try {
    const pong = await redisClient.ping();
    const healthy = String(pong).toUpperCase() === "PONG";
    if (healthy) {
      markRedisHealthy();
      // eslint-disable-next-line no-console
      console.log("[cache] Redis connection verified; shared cache active.");
    } else {
      markRedisDegraded();
      // eslint-disable-next-line no-console
      console.warn("[cache] Redis did not answer PING; falling back to in-memory caching.");
    }
    return healthy;
  } catch (error) {
    markRedisDegraded();
    // eslint-disable-next-line no-console
    console.warn(
      `[cache] Redis connection could not be established (${sanitizeCacheError(
        error
      )}). Continuing with an in-memory cache; market prices will not be shared between instances.`
    );
    return false;
  }
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const client = getCacheClient();
  const raw = await client.get(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  const client = getCacheClient();
  const payload = JSON.stringify(value);
  await client.set(key, payload, ttlSeconds);
}
