"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const marketDataService_1 = require("./marketDataService");
const NOW = "2026-01-01T00:00:00.000Z";
function axiosLikeError(status, headers = {}) {
    return { isAxiosError: true, response: { status, headers } };
}
/* ------------------------------------------------------------------ */
/* Price validation                                                    */
/* ------------------------------------------------------------------ */
(0, node_test_1.test)("rejects missing, zero, negative, malformed and non-numeric prices", () => {
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)(1), true);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)("64697.4"), true);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)(0), false);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)(-1), false);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)(Number.NaN), false);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)(Number.POSITIVE_INFINITY), false);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)(null), false);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)(undefined), false);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)(""), false);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)("abc"), false);
    assert_1.default.equal((0, marketDataService_1.isUsablePrice)({}), false);
});
/* ------------------------------------------------------------------ */
/* Provider normalisation                                              */
/* ------------------------------------------------------------------ */
(0, node_test_1.test)("normalises a CoinGecko payload into every supported symbol", () => {
    const cache = (0, marketDataService_1.normalizeCoinGecko)({
        bitcoin: { usd: 64697.4, usd_24h_change: 1.2, usd_market_cap: 1200000000000 },
        ethereum: { usd: 1816.21, usd_24h_change: -0.4, usd_market_cap: 218000000000 },
        solana: { usd: 71.49 },
        tether: { usd: 0.99903 },
        binancecoin: { usd: 589.87 },
        ripple: { usd: 0.95326 }
    }, NOW);
    assert_1.default.equal(Object.keys(cache).length, 6);
    assert_1.default.equal(cache.BTC?.price, 64697.4);
    assert_1.default.equal(cache.BTC?.source, "coingecko");
    assert_1.default.equal(cache.BTC?.lastUpdated, NOW);
    assert_1.default.equal(cache.USDT?.price, 0.99903);
    // Missing change/market-cap fields fall back to 0 rather than NaN.
    assert_1.default.equal(cache.SOL?.change24h, 0);
});
(0, node_test_1.test)("drops CoinGecko entries with invalid prices instead of defaulting them", () => {
    const cache = (0, marketDataService_1.normalizeCoinGecko)({
        bitcoin: { usd: 64697.4 },
        ethereum: { usd: 0 },
        solana: { usd: -5 },
        tether: { usd: "not-a-number" },
        binancecoin: {},
        ripple: { usd: 0.95 }
    }, NOW);
    assert_1.default.deepEqual(Object.keys(cache).sort(), ["BTC", "XRP"]);
    assert_1.default.equal(cache.ETH, undefined);
});
(0, node_test_1.test)("normalises a Kraken payload including the xtbt/xeth/xxrp aliases", () => {
    const cache = (0, marketDataService_1.normalizeKraken)({
        result: {
            XXBTZUSD: { c: ["64697.4", "0.1"], o: "64000.0" },
            XETHZUSD: { c: ["1816.21", "0.1"], o: "1816.21" },
            SOLUSD: { c: ["71.49", "0.1"], o: "70.0" },
            USDTZUSD: { c: ["0.99903", "0.1"], o: "0.99903" },
            BNBUSD: { c: ["589.87", "0.1"], o: "600.0" },
            XXRPZUSD: { c: ["0.95326", "0.1"], o: "0.95326" }
        }
    }, NOW);
    assert_1.default.equal(Object.keys(cache).length, 6);
    assert_1.default.equal(cache.BTC?.price, 64697.4);
    assert_1.default.equal(cache.BTC?.source, "kraken");
    assert_1.default.equal(cache.USDT?.price, 0.99903);
    // 24h change is derived from Kraken's opening price.
    assert_1.default.ok(Math.abs((cache.BTC?.change24h ?? 0) - 1.0897) < 0.01);
});
(0, node_test_1.test)("normalises a Coinbase payload using the reciprocal of the USD rate", () => {
    const cache = (0, marketDataService_1.normalizeCoinbase)({
        data: {
            currency: "USD",
            rates: {
                BTC: "0.000015443438253",
                ETH: "0.0005506062174454",
                SOL: "0.0139997200055999",
                USDT: "1.0010110211313427",
                BNB: "0.0016941973739941",
                XRP: "1.0496483677967881"
            }
        }
    }, NOW);
    assert_1.default.equal(Object.keys(cache).length, 6);
    assert_1.default.ok(Math.abs((cache.BTC?.price ?? 0) - 64752.4) < 20);
    assert_1.default.equal(cache.USDT?.source, "coinbase");
});
(0, node_test_1.test)("USDT is priced from the USDT market and is never substituted with USDC", () => {
    // Only USDC is present: USDT must be absent, not silently back-filled.
    const cache = (0, marketDataService_1.normalizeCoinbase)({
        data: {
            rates: {
                BTC: "0.000015443438253",
                USDC: "1.0",
                ETH: "0.0005506062174454"
            }
        }
    }, NOW);
    assert_1.default.equal(cache.USDT, undefined);
    assert_1.default.ok(Math.abs((cache.BTC?.price ?? 0) - 64752.4) < 20);
    // USDT present: it is priced from the genuine USDT rate (~1 USD), not USDC.
    const withUsdt = (0, marketDataService_1.normalizeCoinbase)({ data: { rates: { USDT: "1.0010110211313427", USDC: "1.0" } } }, NOW);
    assert_1.default.ok(Math.abs((withUsdt.USDT?.price ?? 0) - 0.99899) < 0.001);
});
/* ------------------------------------------------------------------ */
/* Failure classification (HTTP 429 / HTTP 451)                        */
/* ------------------------------------------------------------------ */
(0, node_test_1.test)("treats HTTP 429 as rate limited and never as a retryable success", () => {
    const error = axiosLikeError(429, { "retry-after": "30" });
    assert_1.default.equal((0, marketDataService_1.isRateLimited)(error), true);
    // 429 must not be retried: the provider asked us to back off.
    assert_1.default.equal((0, marketDataService_1.isRetryable)(error), false);
    assert_1.default.equal((0, marketDataService_1.retryAfterMs)(error), 30000);
});
(0, node_test_1.test)("treats HTTP 451 as access restricted, not as a usable price source", () => {
    const error = axiosLikeError(451);
    assert_1.default.equal((0, marketDataService_1.isAccessRestricted)(error), true);
    assert_1.default.equal((0, marketDataService_1.isRateLimited)(error), false);
    assert_1.default.equal((0, marketDataService_1.isRetryable)(error), false);
});
(0, node_test_1.test)("retries transient network and 5xx failures, but not 4xx", () => {
    assert_1.default.equal((0, marketDataService_1.isRetryable)(axiosLikeError(500)), true);
    assert_1.default.equal((0, marketDataService_1.isRetryable)(axiosLikeError(503)), true);
    assert_1.default.equal((0, marketDataService_1.isRetryable)(axiosLikeError(408)), true);
    // No response at all: network/DNS/timeout.
    assert_1.default.equal((0, marketDataService_1.isRetryable)({ isAxiosError: true }), true);
    assert_1.default.equal((0, marketDataService_1.isRetryable)(axiosLikeError(400)), false);
    assert_1.default.equal((0, marketDataService_1.isRetryable)(new Error("boom")), false);
});
(0, node_test_1.test)("reads Retry-After as either seconds or an HTTP date, capped", () => {
    assert_1.default.equal((0, marketDataService_1.retryAfterMs)(axiosLikeError(429, { "retry-after": "120" })), 120000);
    const farFuture = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
    // Capped at 15 minutes so a bad header cannot park a provider for hours.
    assert_1.default.equal((0, marketDataService_1.retryAfterMs)(axiosLikeError(429, { "retry-after": farFuture })), 15 * 60 * 1000);
    assert_1.default.equal((0, marketDataService_1.retryAfterMs)(axiosLikeError(429)), null);
});
/* ------------------------------------------------------------------ */
/* Freshness taxonomy                                                  */
/* ------------------------------------------------------------------ */
(0, node_test_1.test)("classifies snapshot age into live / cached / stale", () => {
    assert_1.default.equal((0, marketDataService_1.classifyPriceFreshness)(5000), "live");
    assert_1.default.equal((0, marketDataService_1.classifyPriceFreshness)(4 * 60000), "cached");
    assert_1.default.equal((0, marketDataService_1.classifyPriceFreshness)(10 * 60000), "stale");
    assert_1.default.equal((0, marketDataService_1.classifyPriceFreshness)(null), "stale");
});
/* ------------------------------------------------------------------ */
/* Provider chain configuration                                        */
/* ------------------------------------------------------------------ */
(0, node_test_1.test)("excludes Binance from the provider chain unless explicitly enabled", () => {
    const previous = process.env.MARKET_BINANCE_ENABLED;
    const previousChain = process.env.MARKET_PROVIDER_CHAIN;
    delete process.env.MARKET_BINANCE_ENABLED;
    delete process.env.MARKET_PROVIDER_CHAIN;
    const ids = () => (0, marketDataService_1.resolveProviderChain)().map((provider) => provider.id);
    assert_1.default.deepEqual(ids(), ["coingecko", "kraken", "coinbase"]);
    process.env.MARKET_PROVIDER_CHAIN = "coingecko,binance";
    assert_1.default.deepEqual(ids(), ["coingecko"]);
    process.env.MARKET_BINANCE_ENABLED = "true";
    assert_1.default.deepEqual(ids(), ["coingecko", "binance"]);
    if (previous === undefined) {
        delete process.env.MARKET_BINANCE_ENABLED;
    }
    else {
        process.env.MARKET_BINANCE_ENABLED = previous;
    }
    if (previousChain === undefined) {
        delete process.env.MARKET_PROVIDER_CHAIN;
    }
    else {
        process.env.MARKET_PROVIDER_CHAIN = previousChain;
    }
});
(0, node_test_1.test)("refresh interval is environment-configurable", () => {
    const previous = process.env.MARKET_REFRESH_INTERVAL_MS;
    delete process.env.MARKET_REFRESH_INTERVAL_MS;
    assert_1.default.equal((0, marketDataService_1.getMarketRefreshIntervalMs)(), 60000);
    process.env.MARKET_REFRESH_INTERVAL_MS = "15000";
    assert_1.default.equal((0, marketDataService_1.getMarketRefreshIntervalMs)(), 15000);
    process.env.MARKET_REFRESH_INTERVAL_MS = "not-a-number";
    assert_1.default.equal((0, marketDataService_1.getMarketRefreshIntervalMs)(), 60000);
    if (previous === undefined) {
        delete process.env.MARKET_REFRESH_INTERVAL_MS;
    }
    else {
        process.env.MARKET_REFRESH_INTERVAL_MS = previous;
    }
});
