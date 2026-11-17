"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKET_STALE_MS = exports.SUPPORTED_MARKET_SYMBOLS = void 0;
exports.getMarketRefreshIntervalMs = getMarketRefreshIntervalMs;
exports.getMarketLiveMs = getMarketLiveMs;
exports.classifyPriceFreshness = classifyPriceFreshness;
exports.isUsablePrice = isUsablePrice;
exports.isRateLimited = isRateLimited;
exports.isAccessRestricted = isAccessRestricted;
exports.isRetryable = isRetryable;
exports.retryAfterMs = retryAfterMs;
exports.normalizeCoinGecko = normalizeCoinGecko;
exports.normalizeKraken = normalizeKraken;
exports.normalizeCoinbase = normalizeCoinbase;
exports.resolveProviderChain = resolveProviderChain;
exports.refreshMarketData = refreshMarketData;
exports.snapshotAgeMs = snapshotAgeMs;
exports.getAllMarketPrices = getAllMarketPrices;
exports.getMarketPriceForSymbol = getMarketPriceForSymbol;
exports.getMarketDataStatus = getMarketDataStatus;
exports.validateMarketDataConfig = validateMarketDataConfig;
exports.primeMarketData = primeMarketData;
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
/* ------------------------------------------------------------------ */
/* Asset → provider-symbol mapping                                     */
/* ------------------------------------------------------------------ */
/** CoinGecko coin ids (aggregator; the primary source). */
const COINGECKO_IDS = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    USDT: "tether",
    BNB: "binancecoin",
    XRP: "ripple"
};
/**
 * Kraken uses non-obvious pair names for the legacy assets (XXBT = BTC,
 * XETH = ETH, XXRP = XRP) and plain names for the rest. USDT is priced against
 * USD directly (`USDTZUSD`), so it is never substituted with USDC.
 */
const KRAKEN_PAIRS = {
    BTC: "XXBTZUSD",
    ETH: "XETHZUSD",
    SOL: "SOLUSD",
    USDT: "USDTZUSD",
    BNB: "BNBUSD",
    XRP: "XXRPZUSD"
};
/** Extra result keys Kraken may return for a pair, in case of alias drift. */
const KRAKEN_PAIR_ALIASES = {
    BTC: ["XXBTZUSD", "XBTUSD"],
    ETH: ["XETHZUSD", "ETHUSD"],
    SOL: ["SOLUSD"],
    USDT: ["USDTZUSD", "USDTUSD"],
    BNB: ["BNBUSD"],
    XRP: ["XXRPZUSD", "XRPUSD"]
};
/**
 * Coinbase exchange-rate codes. `GET /v2/exchange-rates?currency=USD` returns
 * USD→asset rates, so the USD price is the reciprocal. USDT is quoted directly
 * (`USDT`), never via USDC.
 */
const COINBASE_RATE_CODES = {
    BTC: "BTC",
    ETH: "ETH",
    SOL: "SOL",
    USDT: "USDT",
    BNB: "BNB",
    XRP: "XRP"
};
/**
 * Binance spot pairs, kept only for deployments in regions where Binance is
 * reachable. Binance answers HTTP 451 ("Unavailable For Legal Reasons") from
 * restricted environments, so it is disabled unless explicitly enabled.
 * USDT has no `USDTUSDT` market: it is derived from the USDC/USDT cross.
 */
const BINANCE_PAIRS = {
    BTC: "BTCUSDT",
    ETH: "ETHUSDT",
    SOL: "SOLUSDT",
    USDT: null,
    BNB: "BNBUSDT",
    XRP: "XRPUSDT"
};
const BINANCE_USDT_REFERENCE_PAIR = "USDCUSDT";
/* ------------------------------------------------------------------ */
/* Tunables (environment-configurable)                                 */
/* ------------------------------------------------------------------ */
const MARKET_CACHE_KEY = "market:snapshot:v2";
function readPositiveInt(name, fallback) {
    const raw = process.env[name];
    if (!raw || String(raw).trim().length === 0) {
        return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
function readBoolean(name, fallback) {
    const raw = process.env[name];
    if (!raw || String(raw).trim().length === 0) {
        return fallback;
    }
    return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}
/** How often the central refresh runs. */
function getMarketRefreshIntervalMs() {
    return readPositiveInt("MARKET_REFRESH_INTERVAL_MS", 60000);
}
function cacheTtlSeconds() {
    return readPositiveInt("MARKET_CACHE_TTL_SECONDS", 1800);
}
function requestTimeoutMs() {
    return readPositiveInt("MARKET_REQUEST_TIMEOUT_MS", 7000);
}
function retryAttempts() {
    return readPositiveInt("MARKET_RETRY_ATTEMPTS", 2);
}
function retryBackoffMs() {
    return readPositiveInt("MARKET_RETRY_BACKOFF_MS", 400);
}
/** A rate older than this can never price a new conversion. */
exports.MARKET_STALE_MS = 5 * 60 * 1000;
/** A price at or below this age is treated as live. */
function getMarketLiveMs() {
    return Math.max(getMarketRefreshIntervalMs(), 90000);
}
/** Default cool-down after an HTTP 429 when the provider sends no Retry-After. */
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60000;
/** Cool-down after an access-restricted response (HTTP 451). */
const ACCESS_RESTRICTED_COOLDOWN_MS = 30 * 60 * 1000;
/** Upper bound for any provider cool-down so a bad header cannot park a provider for a day. */
const MAX_PROVIDER_COOLDOWN_MS = 15 * 60 * 1000;
/** Classify a snapshot's age into the three freshness buckets. */
function classifyPriceFreshness(ageMs) {
    if (ageMs === null || !Number.isFinite(ageMs)) {
        return "stale";
    }
    if (ageMs <= getMarketLiveMs()) {
        return "live";
    }
    if (ageMs <= exports.MARKET_STALE_MS) {
        return "cached";
    }
    return "stale";
}
/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */
let inMemoryCache = null;
let lastRefreshAttemptAt = 0;
let lastSuccessfulRefreshAt = 0;
let lastRefreshError = null;
let lastProviderWarnings = [];
let lastRateLimited = false;
let lastAccessRestricted = false;
let lastLoggedError = null;
let refreshInFlight = null;
const providerCooldownUntil = {};
/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
/**
 * Accept a price only when it is a finite, strictly positive number. This
 * rejects missing, zero, negative, NaN and non-numeric values. Anything that
 * cannot be trusted as a real price is dropped rather than defaulted.
 */
function isUsablePrice(value) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0;
}
function toPositiveNumber(value) {
    return isUsablePrice(value) ? Number(value) : null;
}
function toFiniteNumber(value, fallback = 0) {
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
}
function statusOf(error) {
    if (axios_1.default.isAxiosError(error)) {
        return error.response?.status ?? null;
    }
    return null;
}
function describeError(error) {
    if (axios_1.default.isAxiosError(error)) {
        const status = error.response?.status;
        if (status) {
            return `HTTP ${status}`;
        }
        return error.code ? `${error.code}` : error.message;
    }
    return error instanceof Error ? error.message : String(error);
}
/** Rate limited (HTTP 429) or access restricted (HTTP 451) responses. */
function isRateLimited(error) {
    return statusOf(error) === 429;
}
/** HTTP 451: the provider is unreachable from this environment (geo/legal). */
function isAccessRestricted(error) {
    return statusOf(error) === 451;
}
/**
 * A transient failure worth one retry. HTTP 429 is deliberately excluded: the
 * provider asked us to slow down, so the caller parks the provider for the
 * Retry-After window and fails over instead of retrying immediately.
 */
function isRetryable(error) {
    if (!axios_1.default.isAxiosError(error)) {
        return false;
    }
    const status = error.response?.status;
    if (status === undefined) {
        // No response at all: network error, DNS failure or timeout.
        return true;
    }
    return status === 408 || status >= 500;
}
/** Read the provider's Retry-After instruction (seconds or HTTP-date). */
function retryAfterMs(error) {
    if (!axios_1.default.isAxiosError(error)) {
        return null;
    }
    const headers = error.response?.headers;
    const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
    if (raw === undefined || raw === null) {
        return null;
    }
    const value = String(raw).trim();
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, MAX_PROVIDER_COOLDOWN_MS);
    }
    const at = Date.parse(value);
    if (Number.isFinite(at)) {
        return Math.min(Math.max(0, at - Date.now()), MAX_PROVIDER_COOLDOWN_MS);
    }
    return null;
}
function logMarketWarning(message) {
    if (lastLoggedError === message) {
        return;
    }
    lastLoggedError = message;
    // eslint-disable-next-line no-console
    console.warn(`[market] ${message}`);
}
function logMarketInfo(message) {
    // eslint-disable-next-line no-console
    console.log(`[market] ${message}`);
}
async function requestWithRetry(label, run) {
    const attempts = retryAttempts();
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            return await run();
        }
        catch (error) {
            lastError = error;
            if (!isRetryable(error) || attempt === attempts - 1) {
                break;
            }
            await delay(retryBackoffMs() * (attempt + 1));
        }
    }
    throw new Error(`${label} request failed: ${describeError(lastError)}`);
}
/* ------------------------------------------------------------------ */
/* Provider normalisers (pure; unit-tested)                            */
/* ------------------------------------------------------------------ */
/** Normalise a CoinGecko `/simple/price` payload into the internal format. */
function normalizeCoinGecko(payload, now = new Date().toISOString()) {
    if (!payload || typeof payload !== "object") {
        throw new Error("CoinGecko returned an unexpected payload");
    }
    const record = payload;
    const result = {};
    for (const symbol of exports.SUPPORTED_MARKET_SYMBOLS) {
        const entry = record[COINGECKO_IDS[symbol]];
        const price = toPositiveNumber(entry?.usd);
        if (price === null) {
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
    return result;
}
/** Normalise a Kraken `/0/public/Ticker` payload into the internal format. */
function normalizeKraken(payload, now = new Date().toISOString()) {
    const record = payload?.result;
    if (!record || typeof record !== "object") {
        throw new Error("Kraken returned an unexpected payload");
    }
    const result = {};
    for (const symbol of exports.SUPPORTED_MARKET_SYMBOLS) {
        const aliases = KRAKEN_PAIR_ALIASES[symbol];
        const key = Object.keys(record).find((candidate) => aliases.includes(candidate));
        if (!key) {
            continue;
        }
        const entry = record[key];
        const last = toPositiveNumber(Array.isArray(entry?.c) ? entry?.c[0] : undefined);
        if (last === null) {
            continue;
        }
        // Kraken reports today's opening price, not a 24h percentage. Deriving the
        // change keeps the field meaningful instead of silently reporting 0%.
        const open = toFiniteNumber(entry?.o, 0);
        const change24h = open > 0 ? ((last - open) / open) * 100 : 0;
        result[symbol] = {
            symbol,
            price: last,
            change24h,
            // Kraken does not publish a market cap; it is reported as unknown (0)
            // rather than mislabelling 24h volume as capitalisation.
            marketCap: 0,
            lastUpdated: now,
            source: "kraken"
        };
    }
    return result;
}
/** Normalise a Coinbase `/v2/exchange-rates` payload into the internal format. */
function normalizeCoinbase(payload, now = new Date().toISOString()) {
    const rates = payload?.data?.rates;
    if (!rates || typeof rates !== "object") {
        throw new Error("Coinbase returned an unexpected payload");
    }
    const result = {};
    for (const symbol of exports.SUPPORTED_MARKET_SYMBOLS) {
        const code = COINBASE_RATE_CODES[symbol];
        const rate = toPositiveNumber(rates[code]);
        if (rate === null) {
            continue;
        }
        // The endpoint returns USD→asset units, so the USD price is the reciprocal.
        const price = 1 / rate;
        if (!Number.isFinite(price) || price <= 0) {
            continue;
        }
        result[symbol] = {
            symbol,
            price,
            change24h: 0,
            marketCap: 0,
            lastUpdated: now,
            source: "coinbase"
        };
    }
    return result;
}
function coingeckoUrl() {
    return (process.env.COINGECKO_API_BASE || "https://api.coingecko.com/api/v3").replace(/\/+$/, "");
}
async function fetchFromCoinGecko() {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const apiKey = (process.env.COINGECKO_API_KEY || "").trim();
    const keyType = (process.env.COINGECKO_API_KEY_TYPE || "demo").trim().toLowerCase();
    const headers = {};
    if (apiKey) {
        // A demo/pro key removes the aggressive anonymous rate limiting that makes
        // the public endpoint unreliable behind shared datacenter IPs.
        headers[keyType === "pro" ? "x-cg-pro-api-key" : "x-cg-demo-api-key"] = apiKey;
    }
    const response = await requestWithRetry("CoinGecko", () => axios_1.default.get(`${coingeckoUrl()}/simple/price`, {
        params: {
            ids,
            vs_currencies: "usd",
            include_24hr_change: "true",
            include_market_cap: "true"
        },
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        timeout: requestTimeoutMs()
    }));
    const cache = normalizeCoinGecko(response.data);
    if (Object.keys(cache).length === 0) {
        throw new Error("CoinGecko returned no usable prices");
    }
    return cache;
}
async function fetchFromKraken() {
    const baseUrl = (process.env.KRAKEN_API_BASE || "https://api.kraken.com").replace(/\/+$/, "");
    const pairs = exports.SUPPORTED_MARKET_SYMBOLS.map((symbol) => KRAKEN_PAIRS[symbol]).join(",");
    const response = await requestWithRetry("Kraken", () => axios_1.default.get(`${baseUrl}/0/public/Ticker`, {
        params: { pair: pairs },
        timeout: requestTimeoutMs()
    }));
    const cache = normalizeKraken(response.data);
    if (Object.keys(cache).length === 0) {
        throw new Error("Kraken returned no usable prices");
    }
    return cache;
}
async function fetchFromCoinbase() {
    const baseUrl = (process.env.COINBASE_API_BASE || "https://api.coinbase.com/v2/exchange-rates").replace(/\/+$/, "");
    const response = await requestWithRetry("Coinbase", () => axios_1.default.get(baseUrl, {
        params: { currency: "USD" },
        timeout: requestTimeoutMs()
    }));
    const cache = normalizeCoinbase(response.data);
    if (Object.keys(cache).length === 0) {
        throw new Error("Coinbase returned no usable prices");
    }
    return cache;
}
async function fetchBinancePair(baseUrl, pair) {
    const response = await requestWithRetry(`Binance ${pair}`, () => axios_1.default.get(baseUrl, {
        params: { symbol: pair },
        timeout: requestTimeoutMs()
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
    // `allSettled`, not `all`: one unsupported or delisted pair must not discard
    // the prices that did come back.
    const settled = await Promise.allSettled(pairs.map(async ([symbol, pair]) => {
        const ticker = await fetchBinancePair(baseUrl, pair);
        return [symbol, ticker];
    }));
    settled.forEach((outcome, index) => {
        if (outcome.status !== "fulfilled") {
            return;
        }
        const symbol = pairs[index][0];
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
    // USDT has no direct USD pair on Binance: derive it from USDC/USDT, a genuine
    // market rate rather than an assumed peg.
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
    catch {
        // USDT simply stays unavailable from this provider.
    }
    if (Object.keys(result).length === 0) {
        throw new Error("Binance returned no usable prices");
    }
    return result;
}
const PROVIDERS = {
    coingecko: { id: "coingecko", label: "CoinGecko", fetch: fetchFromCoinGecko },
    kraken: { id: "kraken", label: "Kraken", fetch: fetchFromKraken },
    coinbase: { id: "coinbase", label: "Coinbase", fetch: fetchFromCoinbase },
    binance: { id: "binance", label: "Binance", fetch: fetchFromBinance }
};
const DEFAULT_PROVIDER_CHAIN = ["coingecko", "kraken", "coinbase"];
function isProviderId(value) {
    return value === "coingecko" || value === "kraken" || value === "coinbase" || value === "binance";
}
/**
 * Resolve the ordered provider chain. Binance is only included when explicitly
 * enabled, because it answers HTTP 451 from restricted (for example, US)
 * deployment environments and must not be treated as a working source there.
 */
function resolveProviderChain() {
    const raw = (process.env.MARKET_PROVIDER_CHAIN || "").trim();
    let ids = raw
        ? raw
            .split(",")
            .map((entry) => entry.trim().toLowerCase())
            .filter(isProviderId)
        : [...DEFAULT_PROVIDER_CHAIN];
    if (!readBoolean("MARKET_BINANCE_ENABLED", false)) {
        ids = ids.filter((id) => id !== "binance");
    }
    if (ids.length === 0) {
        ids = [...DEFAULT_PROVIDER_CHAIN];
    }
    return ids.map((id) => PROVIDERS[id]);
}
/* ------------------------------------------------------------------ */
/* Central refresh                                                     */
/* ------------------------------------------------------------------ */
function isSnapshotComplete(prices) {
    return exports.SUPPORTED_MARKET_SYMBOLS.every((symbol) => Boolean(prices[symbol]));
}
/**
 * Walk the provider chain and fill any symbol still missing. Providers are
 * consumed only until the snapshot is complete, so a healthy primary costs a
 * single upstream request. A provider on cool-down is skipped without a request
 * — this is what stops the pipeline from hammering a rate-limited CoinGecko.
 */
async function collectFromProviders() {
    const prices = {};
    const errors = [];
    let rateLimited = false;
    let accessRestricted = false;
    for (const provider of resolveProviderChain()) {
        if (isSnapshotComplete(prices)) {
            break;
        }
        const cooldown = providerCooldownUntil[provider.id] ?? 0;
        if (cooldown > Date.now()) {
            continue;
        }
        try {
            const data = await provider.fetch();
            for (const symbol of exports.SUPPORTED_MARKET_SYMBOLS) {
                const point = data[symbol];
                if (point && !prices[symbol]) {
                    prices[symbol] = point;
                }
            }
        }
        catch (error) {
            errors.push(`${provider.label}: ${describeError(error)}`);
            if (isRateLimited(error)) {
                rateLimited = true;
                const wait = retryAfterMs(error) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS;
                providerCooldownUntil[provider.id] = Date.now() + wait;
                logMarketWarning(`${provider.label} rate limited; pausing this provider for ${Math.round(wait / 1000)}s`);
            }
            else if (isAccessRestricted(error)) {
                accessRestricted = true;
                providerCooldownUntil[provider.id] = Date.now() + ACCESS_RESTRICTED_COOLDOWN_MS;
                logMarketWarning(`${provider.label} is not reachable from this environment (HTTP 451); pausing this provider`);
            }
        }
    }
    return { prices, errors, rateLimited, accessRestricted };
}
/**
 * Refresh the central snapshot: primary provider, then the independent
 * secondary, then (on failure) whatever last-known-good snapshot we already
 * hold. Data is never overwritten with an empty result.
 */
async function refreshMarketData(force = false) {
    const now = Date.now();
    const interval = lastRefreshError
        ? Math.max(getMarketRefreshIntervalMs(), 30000)
        : getMarketRefreshIntervalMs();
    if (!force && now - lastRefreshAttemptAt < interval) {
        return;
    }
    if (refreshInFlight) {
        return refreshInFlight;
    }
    lastRefreshAttemptAt = now;
    refreshInFlight = (async () => {
        const collected = await collectFromProviders();
        const count = Object.keys(collected.prices).length;
        lastRateLimited = collected.rateLimited;
        lastAccessRestricted = collected.accessRestricted;
        lastProviderWarnings = collected.errors;
        if (count === 0) {
            lastRefreshError =
                collected.errors.join(" | ") || "no configured provider returned a usable price";
            logMarketWarning(`live pricing unavailable (${lastRefreshError}). Keeping the previous snapshot if any.`);
            return;
        }
        inMemoryCache = collected.prices;
        lastSuccessfulRefreshAt = Date.now();
        lastRefreshError = null;
        await (0, cache_1.setCachedJson)(MARKET_CACHE_KEY, { refreshedAt: new Date(lastSuccessfulRefreshAt).toISOString(), points: collected.prices }, cacheTtlSeconds());
        if (!isSnapshotComplete(collected.prices)) {
            const missing = exports.SUPPORTED_MARKET_SYMBOLS.filter((symbol) => !collected.prices[symbol]);
            logMarketWarning(`partial pricing; missing ${missing.join(", ")}${collected.errors.length ? ` (${collected.errors.join(", ")})` : ""}`);
        }
        else if (collected.errors.length > 0) {
            logMarketWarning(`served from the provider chain with a degraded upstream (${collected.errors.join(", ")})`);
        }
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
    if (!cached || typeof cached !== "object") {
        return null;
    }
    const wrapped = "points" in cached;
    const points = (wrapped ? cached.points : cached);
    if (!points || typeof points !== "object" || Object.keys(points).length === 0) {
        return null;
    }
    inMemoryCache = points;
    if (wrapped) {
        const refreshedAt = Date.parse(cached.refreshedAt);
        if (Number.isFinite(refreshedAt)) {
            lastSuccessfulRefreshAt = refreshedAt;
        }
    }
    return points;
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
    if (ageMs !== null && ageMs < getMarketRefreshIntervalMs()) {
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
async function getMarketDataStatus() {
    const cache = await loadFromCache();
    const ageMs = snapshotAgeMs(cache);
    const points = cache ? Object.values(cache).filter(Boolean) : [];
    const sources = Array.from(new Set(points.map((point) => point.source).filter(Boolean)));
    const freshness = classifyPriceFreshness(ageMs);
    const chain = resolveProviderChain().map((provider) => provider.id);
    return {
        health: points.length === 0 ? "unavailable" : freshness,
        hasData: points.length > 0,
        source: sources[0] ?? null,
        providerSources: sources,
        lastUpdatedAt: ageMs === null ? null : new Date(Date.now() - ageMs).toISOString(),
        ageSeconds: ageMs === null ? null : Math.round(ageMs / 1000),
        lastSuccessfulRefreshAt: lastSuccessfulRefreshAt === 0 ? null : new Date(lastSuccessfulRefreshAt).toISOString(),
        lastAttemptAt: lastRefreshAttemptAt === 0 ? null : new Date(lastRefreshAttemptAt).toISOString(),
        refreshing: refreshInFlight !== null,
        rateLimited: lastRateLimited,
        accessRestricted: lastAccessRestricted,
        providers: Object.keys(PROVIDERS).map((id) => ({
            id,
            label: PROVIDERS[id].label,
            inChain: chain.includes(id),
            coolingDown: (providerCooldownUntil[id] ?? 0) > Date.now()
        })),
        cache: (0, cache_1.getCacheStatus)(),
        lastError: lastRefreshError,
        lastProviderWarnings
    };
}
/**
 * Validate the pricing configuration at startup and log which providers are in
 * the chain. Returns human-readable warnings for anything misconfigured.
 */
function validateMarketDataConfig() {
    const warnings = [];
    const chain = resolveProviderChain();
    logMarketInfo(`provider chain: ${chain.map((provider) => provider.label).join(" → ")} (fallback: last-known-good snapshot)`);
    if (!chain.some((provider) => provider.id === "coingecko")) {
        warnings.push("CoinGecko is not in the provider chain; verify MARKET_PROVIDER_CHAIN.");
    }
    if (!readBoolean("MARKET_BINANCE_ENABLED", false)) {
        logMarketInfo("Binance is disabled (set MARKET_BINANCE_ENABLED=true only where Binance is reachable).");
    }
    if (chain.length < 2) {
        warnings.push("Only one live pricing provider is configured; a single provider outage will fall back straight to the last-known-good snapshot.");
    }
    if (!process.env.REDIS_URL) {
        warnings.push("REDIS_URL is not set: market prices are cached in memory only and are not shared between instances.");
    }
    for (const warning of warnings) {
        logMarketWarning(warning);
    }
    return warnings;
}
/** Force an initial refresh so the first user never waits on an empty cache. */
async function primeMarketData() {
    await refreshMarketData(true);
}
