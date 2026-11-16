"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_MARKET_SYMBOLS = void 0;
exports.fetchFromCoinGecko = fetchFromCoinGecko;
exports.fetchFromBinance = fetchFromBinance;
exports.refreshMarketData = refreshMarketData;
exports.snapshotAgeMs = snapshotAgeMs;
exports.getAllMarketPrices = getAllMarketPrices;
exports.getMarketPriceForSymbol = getMarketPriceForSymbol;
exports.getMarketDataStatus = getMarketDataStatus;
const axios_1 = __importDefault(require("axios"));
const cache_1 = require("../config/cache");
exports.SUPPORTED_MARKET_SYMBOLS = [
    "BTC",
    "ETH",
    "SOL",
    "USDT",
    "BNB",
    "XRP"
];
const COINGECKO_IDS = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    USDT: "tether",
    BNB: "binancecoin",
    XRP: "ripple",
};
/**
 * Binance spot pairs used by the fallback provider. USDT is deliberately left
 * out: there is no `USDTUSDT` market, so its USD value is derived from the
 * USDC/USDT reference pair below instead of being assumed to be exactly $1.
 */
const BINANCE_PAIRS = {
    BTC: "BTCUSDT",
    ETH: "ETHUSDT",
    SOL: "SOLUSDT",
    USDT: null,
    BNB: "BNBUSDT",
    XRP: "XRPUSDT",
};
/** Binance's USD-stablecoin cross used to price USDT. */
const BINANCE_USDT_REFERENCE_PAIR = "USDCUSDT";
const MARKET_CACHE_KEY = "market:latest";
/**
 * The last snapshot is kept in the cache well past its useful life so a provider
 * outage does not destroy the only recent rate we have. Freshness is decided
 * from each point's `lastUpdated`, not from the cache TTL.
 */
const MARKET_CACHE_TTL_SECONDS = 600;
const MARKET_REFRESH_INTERVAL_MS = 15000;
const MARKET_FAILURE_BACKOFF_MS = 30000;
const MARKET_REQUEST_TIMEOUT_MS = 7000;
const MARKET_RETRY_ATTEMPTS = 2;
const MARKET_RETRY_BACKOFF_MS = 400;
let inMemoryCache = null;
let lastRefreshAttemptAt = 0;
let lastRefreshError = null;
let lastLoggedError = null;
let refreshInFlight = null;
function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
function toPositiveNumber(value) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function toFiniteNumber(value, fallback = 0) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
}
function describeError(error) {
    if (axios_1.default.isAxiosError(error)) {
        const status = error.response?.status;
        const payload = error.response?.data;
        const upstream = payload?.status?.error_message;
        if (status) {
            return `HTTP ${status}${upstream ? ` (${upstream})` : ""}`;
        }
        return error.code ? `${error.code}` : error.message;
    }
    return error instanceof Error ? error.message : String(error);
}
/** A 429 or 5xx is worth one retry; a 400 means the request itself is wrong. */
function isRetryable(error) {
    if (!axios_1.default.isAxiosError(error)) {
        return false;
    }
    const status = error.response?.status;
    if (status === undefined) {
        // No response at all: network error, DNS failure or timeout.
        return true;
    }
    return status === 429 || status === 408 || status >= 500;
}
function logMarketWarning(message) {
    if (lastLoggedError === message) {
        return;
    }
    lastLoggedError = message;
    // eslint-disable-next-line no-console
    console.warn(`[market] ${message}`);
}
async function requestWithRetry(label, run) {
    let lastError = null;
    for (let attempt = 0; attempt < MARKET_RETRY_ATTEMPTS; attempt += 1) {
        try {
            return await run();
        }
        catch (error) {
            lastError = error;
            const retryable = isRetryable(error);
            if (!retryable || attempt === MARKET_RETRY_ATTEMPTS - 1) {
                break;
            }
            await delay(MARKET_RETRY_BACKOFF_MS * (attempt + 1));
        }
    }
    throw new Error(`${label} request failed: ${describeError(lastError)}`);
}
async function fetchFromCoinGecko() {
    const baseUrl = (process.env.COINGECKO_API_BASE || "https://api.coingecko.com/api/v3").replace(/\/+$/, "");
    const ids = Object.values(COINGECKO_IDS).join(",");
    const apiKey = (process.env.COINGECKO_API_KEY || "").trim();
    const response = await requestWithRetry("CoinGecko", () => axios_1.default.get(`${baseUrl}/simple/price`, {
        params: {
            ids,
            vs_currencies: "usd",
            include_24hr_change: "true",
            include_market_cap: "true"
        },
        // A demo/pro key removes the aggressive anonymous rate limiting that makes
        // the public endpoint unreliable behind shared datacenter IPs.
        headers: apiKey ? { "x-cg-demo-api-key": apiKey } : undefined,
        timeout: MARKET_REQUEST_TIMEOUT_MS
    }));
    const payload = response.data;
    if (!payload || typeof payload !== "object") {
        throw new Error("CoinGecko returned an unexpected payload");
    }
    const now = new Date().toISOString();
    const result = {};
    const missing = [];
    for (const symbol of exports.SUPPORTED_MARKET_SYMBOLS) {
        const entry = payload[COINGECKO_IDS[symbol]];
        const price = toPositiveNumber(entry?.usd);
        if (price === null) {
            missing.push(symbol);
            continue;
        }
        result[symbol] = {
            symbol,
            price,
            change24h: toFiniteNumber(entry?.usd_24h_change),
            marketCap: toFiniteNumber(entry?.usd_market_cap),
            lastUpdated: now,
            source: "coingecko"
        };
    }
    if (missing.length === exports.SUPPORTED_MARKET_SYMBOLS.length) {
        throw new Error("CoinGecko returned no usable prices");
    }
    if (missing.length > 0) {
        logMarketWarning(`CoinGecko omitted ${missing.join(", ")}; those rates stay unavailable`);
    }
    return result;
}
async function fetchBinancePair(baseUrl, pair) {
    const response = await requestWithRetry(`Binance ${pair}`, () => axios_1.default.get(baseUrl, {
        params: { symbol: pair },
        timeout: MARKET_REQUEST_TIMEOUT_MS
    }));
    const data = response.data;
    const lastPrice = toPositiveNumber(data?.lastPrice);
    if (lastPrice === null) {
        throw new Error(`Binance ${pair} returned no usable price`);
    }
    return {
        lastPrice,
        priceChangePercent: toFiniteNumber(data?.priceChangePercent),
        quoteVolume: toFiniteNumber(data?.quoteVolume)
    };
}
async function fetchFromBinance() {
    const baseUrl = process.env.BINANCE_API_BASE || "https://api.binance.com/api/v3/ticker/24hr";
    const now = new Date().toISOString();
    const result = {};
    const pairs = exports.SUPPORTED_MARKET_SYMBOLS.map((symbol) => [symbol, BINANCE_PAIRS[symbol]]).filter((entry) => entry[1] !== null);
    // `allSettled`, not `all`: one unsupported or delisted pair must not discard the
    // prices that did come back.
    const settled = await Promise.allSettled(pairs.map(async ([symbol, pair]) => {
        const ticker = await fetchBinancePair(baseUrl, pair);
        return [symbol, ticker];
    }));
    const failures = [];
    settled.forEach((outcome, index) => {
        const symbol = pairs[index][0];
        if (outcome.status !== "fulfilled") {
            failures.push(`${symbol} (${describeError(outcome.reason)})`);
            return;
        }
        const [, ticker] = outcome.value;
        result[symbol] = {
            symbol,
            price: ticker.lastPrice,
            change24h: ticker.priceChangePercent,
            marketCap: ticker.quoteVolume,
            lastUpdated: now,
            source: "binance"
        };
    });
    // USDT has no direct USD pair on Binance: derive it from USDC/USDT, which is a
    // genuine market rate rather than a hardcoded peg.
    try {
        const reference = await fetchBinancePair(baseUrl, BINANCE_USDT_REFERENCE_PAIR);
        const usdtPrice = 1 / reference.lastPrice;
        if (Number.isFinite(usdtPrice) && usdtPrice > 0) {
            result.USDT = {
                symbol: "USDT",
                price: usdtPrice,
                change24h: reference.priceChangePercent,
                marketCap: reference.quoteVolume,
                lastUpdated: now,
                source: "binance"
            };
        }
    }
    catch (error) {
        failures.push(`USDT (${describeError(error)})`);
    }
    if (Object.keys(result).length === 0) {
        throw new Error(`Binance returned no usable prices${failures.length ? `: ${failures.join(", ")}` : ""}`);
    }
    if (failures.length > 0) {
        logMarketWarning(`Binance omitted ${failures.join(", ")}; those rates stay unavailable`);
    }
    return result;
}
/**
 * Fetch the latest prices from the primary provider, falling back to the
 * secondary one. Previous good data is never discarded: a failed refresh keeps
 * whatever snapshot we already hold so the staleness rules can decide whether it
 * is still usable.
 */
async function refreshMarketData(force = false) {
    const now = Date.now();
    const interval = lastRefreshError ? MARKET_FAILURE_BACKOFF_MS : MARKET_REFRESH_INTERVAL_MS;
    if (!force && now - lastRefreshAttemptAt < interval) {
        return;
    }
    if (refreshInFlight) {
        return refreshInFlight;
    }
    lastRefreshAttemptAt = now;
    refreshInFlight = (async () => {
        const failures = [];
        try {
            const data = await fetchFromCoinGecko();
            inMemoryCache = data;
            lastRefreshError = null;
            lastLoggedError = null;
            await (0, cache_1.setCachedJson)(MARKET_CACHE_KEY, data, MARKET_CACHE_TTL_SECONDS);
            return;
        }
        catch (error) {
            failures.push(`CoinGecko: ${describeError(error)}`);
        }
        try {
            const fallback = await fetchFromBinance();
            inMemoryCache = fallback;
            lastRefreshError = null;
            lastLoggedError = null;
            await (0, cache_1.setCachedJson)(MARKET_CACHE_KEY, fallback, MARKET_CACHE_TTL_SECONDS);
            logMarketWarning("CoinGecko unavailable; serving Binance rates");
            return;
        }
        catch (error) {
            failures.push(`Binance: ${describeError(error)}`);
        }
        lastRefreshError = failures.join(" | ");
        logMarketWarning(`live pricing unavailable (${lastRefreshError}). Keeping the previous snapshot if any.`);
    })().finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}
async function loadFromCache() {
    if (inMemoryCache) {
        return inMemoryCache;
    }
    const cached = await (0, cache_1.getCachedJson)(MARKET_CACHE_KEY);
    if (cached && typeof cached === "object" && Object.keys(cached).length > 0) {
        inMemoryCache = cached;
        return cached;
    }
    return null;
}
/** Age of the newest point in a snapshot, or null when it cannot be determined. */
function snapshotAgeMs(cache) {
    if (!cache) {
        return null;
    }
    let newest = Number.NEGATIVE_INFINITY;
    for (const point of Object.values(cache)) {
        if (!point) {
            continue;
        }
        const stamp = Date.parse(point.lastUpdated);
        if (Number.isFinite(stamp) && stamp > newest) {
            newest = stamp;
        }
    }
    return Number.isFinite(newest) ? Date.now() - newest : null;
}
/**
 * The current snapshot. Data is refreshed when it is missing or older than the
 * refresh interval; if every provider is down the last known snapshot is
 * returned (possibly empty) and `getMarketDataStatus()` explains why.
 */
async function getAllMarketPrices() {
    const cached = await loadFromCache();
    const ageMs = snapshotAgeMs(cached);
    if (ageMs !== null && ageMs < MARKET_REFRESH_INTERVAL_MS) {
        return cached;
    }
    await refreshMarketData();
    const refreshed = await loadFromCache();
    return refreshed ?? cached ?? {};
}
async function getMarketPriceForSymbol(symbol) {
    const cache = await getAllMarketPrices();
    return cache[symbol] || null;
}
/** Diagnostic view of the pricing pipeline, for operators and support. */
async function getMarketDataStatus() {
    const cache = await loadFromCache();
    const ageMs = snapshotAgeMs(cache);
    const points = cache ? Object.values(cache).filter(Boolean) : [];
    const source = points.length > 0 ? points[0]?.source ?? null : null;
    return {
        hasData: points.length > 0,
        source,
        lastUpdatedAt: ageMs === null ? null : new Date(Date.now() - ageMs).toISOString(),
        ageSeconds: ageMs === null ? null : Math.round(ageMs / 1000),
        lastAttemptAt: lastRefreshAttemptAt === 0 ? null : new Date(lastRefreshAttemptAt).toISOString(),
        lastError: lastRefreshError,
        refreshing: refreshInFlight !== null
    };
}
