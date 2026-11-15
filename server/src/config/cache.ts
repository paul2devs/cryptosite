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

function markRedisHealthy(): void {
  redisDegraded = false;
}

function markRedisDegraded(): void {
  redisDegraded = true;
}

function logCacheFailure(operation: string, error: unknown): void {
  const now = Date.now();
  if (now - lastCacheFailureLogAt < CACHE_FAILURE_LOG_INTERVAL_MS) {
    return;
  }
  lastCacheFailureLogAt = now;
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.warn(
    `[cache] Redis ${operation} failed, using in-memory fallback: ${message}`
  );
}

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false
  });

  client.on("error", (error: unknown) => {
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
} {
  getCacheClient();
  return {
    backend: cacheBackend,
    redisConfigured: Boolean(process.env.REDIS_URL),
    degraded: cacheBackend === "redis" && redisDegraded
  };
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
