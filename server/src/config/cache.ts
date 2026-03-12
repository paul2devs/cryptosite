import Redis from "ioredis";

type CacheValue = string;

interface CacheClient {
  get(key: string): Promise<CacheValue | null>;
  set(key: string, value: CacheValue, ttlSeconds?: number): Promise<void>;
}

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

let redisClient: Redis | null = null;
let cacheClient: CacheClient | null = null;

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });

  client.on("error", () => {
    // silent fallback to in-memory cache
  });

  return client;
}

function getCacheClient(): CacheClient {
  if (cacheClient) {
    return cacheClient;
  }

  redisClient = createRedisClient();

  if (redisClient) {
    cacheClient = {
      async get(key: string): Promise<CacheValue | null> {
        const value = await redisClient!.get(key);
        return value;
      },
      async set(key: string, value: CacheValue, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds && ttlSeconds > 0) {
          await redisClient!.set(key, value, "EX", ttlSeconds);
        } else {
          await redisClient!.set(key, value);
        }
      }
    };
  } else {
    cacheClient = new InMemoryCache();
  }

  return cacheClient;
}

export async function getCachedJson<T>(
  key: string
): Promise<T | null> {
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

