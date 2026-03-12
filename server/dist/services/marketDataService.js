"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFromCoinGecko = fetchFromCoinGecko;
exports.refreshMarketData = refreshMarketData;
exports.getAllMarketPrices = getAllMarketPrices;
exports.getMarketPriceForSymbol = getMarketPriceForSymbol;
const axios_1 = __importDefault(require("axios"));
const cache_1 = require("../config/cache");
const COINGECKO_IDS = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    USDT: "tether",
    BNB: "binancecoin",
    XRP: "ripple",
};
const MARKET_CACHE_KEY = "market:latest";
const MARKET_CACHE_TTL_SECONDS = 20;
let inMemoryCache = null;
async function fetchFromCoinGecko() {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const url = `${process.env.COINGECKO_API_BASE || "https://api.coingecko.com/api/v3"}/simple/price`;
    const response = await axios_1.default.get(url, {
        params: {
            ids,
            vs_currencies: "usd",
            include_24hr_change: "true",
            include_market_cap: "true"
        },
        timeout: 5000
    });
    const now = new Date().toISOString();
    const data = response.data;
    const result = {
        BTC: {
            symbol: "BTC",
            price: data[COINGECKO_IDS.BTC].usd,
            change24h: data[COINGECKO_IDS.BTC].usd_24h_change,
            marketCap: data[COINGECKO_IDS.BTC].usd_market_cap,
            lastUpdated: now
        },
        ETH: {
            symbol: "ETH",
            price: data[COINGECKO_IDS.ETH].usd,
            change24h: data[COINGECKO_IDS.ETH].usd_24h_change,
            marketCap: data[COINGECKO_IDS.ETH].usd_market_cap,
            lastUpdated: now
        },
        SOL: {
            symbol: "SOL",
            price: data[COINGECKO_IDS.SOL].usd,
            change24h: data[COINGECKO_IDS.SOL].usd_24h_change,
            marketCap: data[COINGECKO_IDS.SOL].usd_market_cap,
            lastUpdated: now
        },
        USDT: {
            symbol: "USDT",
            price: data[COINGECKO_IDS.USDT].usd,
            change24h: data[COINGECKO_IDS.USDT].usd_24h_change,
            marketCap: data[COINGECKO_IDS.USDT].usd_market_cap,
            lastUpdated: now
        },
        BNB: {
            symbol: "BNB",
            price: data[COINGECKO_IDS.BNB].usd,
            change24h: data[COINGECKO_IDS.BNB].usd_24h_change,
            marketCap: data[COINGECKO_IDS.BNB].usd_market_cap,
            lastUpdated: now
        },
        XRP: {
            symbol: "XRP",
            price: data[COINGECKO_IDS.XRP].usd,
            change24h: data[COINGECKO_IDS.XRP].usd_24h_change,
            marketCap: data[COINGECKO_IDS.XRP].usd_market_cap,
            lastUpdated: now
        },
    };
    return result;
}
async function fetchFromBinance() {
    const baseUrl = process.env.BINANCE_API_BASE || "https://api.binance.com/api/v3/ticker/24hr";
    const symbols = {
        BTC: "BTCUSDT",
        ETH: "ETHUSDT",
        SOL: "SOLUSDT",
        USDT: "USDTUSDT",
        BNB: "BNBUSDT",
        XRP: "XRPUSDT",
    };
    const now = new Date().toISOString();
    const entries = await Promise.all(Object.keys(symbols).map(async (symbol) => {
        const marketSymbol = symbols[symbol];
        const response = await axios_1.default.get(baseUrl, {
            params: { symbol: marketSymbol },
            timeout: 5000
        });
        const data = response.data;
        const price = Number(data.lastPrice);
        const change24h = Number(data.priceChangePercent);
        const marketCap = Number(data.quoteVolume);
        const point = {
            symbol,
            price,
            change24h,
            marketCap,
            lastUpdated: now
        };
        return [symbol, point];
    }));
    const result = {
        BTC: entries.find(([s]) => s === "BTC")[1],
        ETH: entries.find(([s]) => s === "ETH")[1],
        SOL: entries.find(([s]) => s === "SOL")[1],
        USDT: entries.find(([s]) => s === "USDT")[1],
        BNB: entries.find(([s]) => s === "BNB")[1],
        XRP: entries.find(([s]) => s === "XRP")[1],
    };
    return result;
}
async function refreshMarketData() {
    try {
        const data = await fetchFromCoinGecko();
        inMemoryCache = data;
        await (0, cache_1.setCachedJson)(MARKET_CACHE_KEY, data, MARKET_CACHE_TTL_SECONDS);
        return;
    }
    catch {
        try {
            const fallback = await fetchFromBinance();
            inMemoryCache = fallback;
            await (0, cache_1.setCachedJson)(MARKET_CACHE_KEY, fallback, MARKET_CACHE_TTL_SECONDS);
            return;
        }
        catch {
            return;
        }
    }
}
async function loadFromCache() {
    if (inMemoryCache) {
        return inMemoryCache;
    }
    const cached = await (0, cache_1.getCachedJson)(MARKET_CACHE_KEY);
    if (cached) {
        inMemoryCache = cached;
        return cached;
    }
    return null;
}
async function getAllMarketPrices() {
    const existing = await loadFromCache();
    if (existing) {
        return existing;
    }
    await refreshMarketData();
    return (await loadFromCache()) || {};
}
async function getMarketPriceForSymbol(symbol) {
    const cache = await getAllMarketPrices();
    return cache[symbol] || null;
}
