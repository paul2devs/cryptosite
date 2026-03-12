"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedJson = getCachedJson;
exports.setCachedJson = setCachedJson;
const ioredis_1 = __importDefault(require("ioredis"));
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
let redisClient = null;
let cacheClient = null;
function createRedisClient() {
    const url = process.env.REDIS_URL;
    if (!url) {
        return null;
    }
    const client = new ioredis_1.default(url, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
    });
    client.on("error", () => {
        // silent fallback to in-memory cache
    });
    return client;
}
function getCacheClient() {
    if (cacheClient) {
        return cacheClient;
    }
    redisClient = createRedisClient();
    if (redisClient) {
        cacheClient = {
            async get(key) {
                const value = await redisClient.get(key);
                return value;
            },
            async set(key, value, ttlSeconds) {
                if (ttlSeconds && ttlSeconds > 0) {
                    await redisClient.set(key, value, "EX", ttlSeconds);
                }
                else {
                    await redisClient.set(key, value);
                }
            }
        };
    }
    else {
        cacheClient = new InMemoryCache();
    }
    return cacheClient;
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
