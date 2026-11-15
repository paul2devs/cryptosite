"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheStatus = getCacheStatus;
exports.getCachedJson = getCachedJson;
exports.setCachedJson = setCachedJson;
const ioredis_1 = __importDefault(require("ioredis"));
const CACHE_FAILURE_LOG_INTERVAL_MS = 30000;
class InMemoryCache {
    constructor() {
        this.store = new Map();
    }
    async get(key) {
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
    async set(key, value, ttlSeconds) {
        const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
        this.store.set(key, { value, expiresAt });
    }
}
class RedisBackedCache {
    constructor(client, fallback) {
        this.client = client;
        this.fallback = fallback;
    }
    async get(key) {
        try {
            const value = await this.client.get(key);
            markRedisHealthy();
            return value;
        }
        catch (error) {
            markRedisDegraded();
            logCacheFailure("get", error);
            return this.fallback.get(key);
        }
    }
    async set(key, value, ttlSeconds) {
        try {
            if (ttlSeconds && ttlSeconds > 0) {
                await this.client.set(key, value, "EX", ttlSeconds);
            }
            else {
                await this.client.set(key, value);
            }
            markRedisHealthy();
        }
        catch (error) {
            markRedisDegraded();
            logCacheFailure("set", error);
            await this.fallback.set(key, value, ttlSeconds);
        }
    }
}
let redisClient = null;
let cacheClient = null;
let cacheBackend = "memory";
let lastCacheFailureLogAt = 0;
let redisDegraded = false;
function markRedisHealthy() {
    redisDegraded = false;
}
function markRedisDegraded() {
    redisDegraded = true;
}
function logCacheFailure(operation, error) {
    const now = Date.now();
    if (now - lastCacheFailureLogAt < CACHE_FAILURE_LOG_INTERVAL_MS) {
        return;
    }
    lastCacheFailureLogAt = now;
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn(`[cache] Redis ${operation} failed, using in-memory fallback: ${message}`);
}
function createRedisClient() {
    const url = process.env.REDIS_URL;
    if (!url) {
        return null;
    }
    const client = new ioredis_1.default(url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: false
    });
    client.on("error", (error) => {
        logCacheFailure("connection", error);
    });
    return client;
}
function getCacheClient() {
    if (cacheClient) {
        return cacheClient;
    }
    redisClient = createRedisClient();
    if (redisClient) {
        cacheBackend = "redis";
        cacheClient = new RedisBackedCache(redisClient, new InMemoryCache());
    }
    else {
        cacheBackend = "memory";
        cacheClient = new InMemoryCache();
    }
    return cacheClient;
}
function getCacheStatus() {
    getCacheClient();
    return {
        backend: cacheBackend,
        redisConfigured: Boolean(process.env.REDIS_URL),
        degraded: cacheBackend === "redis" && redisDegraded
    };
}
async function getCachedJson(key) {
    const client = getCacheClient();
    const raw = await client.get(key);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function setCachedJson(key, value, ttlSeconds) {
    const client = getCacheClient();
    const payload = JSON.stringify(value);
    await client.set(key, payload, ttlSeconds);
}
