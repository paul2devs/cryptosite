import assert from "assert";
import { test } from "node:test";
import {
  classifyPriceFreshness,
  getMarketRefreshIntervalMs,
  isAccessRestricted,
  isRateLimited,
  isRetryable,
  isUsablePrice,
  normalizeCoinbase,
  normalizeCoinGecko,
  normalizeKraken,
  resolveProviderChain,
  retryAfterMs
} from "./marketDataService";

const NOW = "2026-01-01T00:00:00.000Z";

function axiosLikeError(status: number, headers: Record<string, string> = {}): unknown {
  return { isAxiosError: true, response: { status, headers } };
}

/* ------------------------------------------------------------------ */
/* Price validation                                                    */
/* ------------------------------------------------------------------ */

test("rejects missing, zero, negative, malformed and non-numeric prices", () => {
  assert.equal(isUsablePrice(1), true);
  assert.equal(isUsablePrice("64697.4"), true);
  assert.equal(isUsablePrice(0), false);
  assert.equal(isUsablePrice(-1), false);
  assert.equal(isUsablePrice(Number.NaN), false);
  assert.equal(isUsablePrice(Number.POSITIVE_INFINITY), false);
  assert.equal(isUsablePrice(null), false);
  assert.equal(isUsablePrice(undefined), false);
  assert.equal(isUsablePrice(""), false);
  assert.equal(isUsablePrice("abc"), false);
  assert.equal(isUsablePrice({}), false);
});

/* ------------------------------------------------------------------ */
/* Provider normalisation                                              */
/* ------------------------------------------------------------------ */

test("normalises a CoinGecko payload into every supported symbol", () => {
  const cache = normalizeCoinGecko(
    {
      bitcoin: { usd: 64697.4, usd_24h_change: 1.2, usd_market_cap: 1_200_000_000_000 },
      ethereum: { usd: 1816.21, usd_24h_change: -0.4, usd_market_cap: 218_000_000_000 },
      solana: { usd: 71.49 },
      tether: { usd: 0.99903 },
      binancecoin: { usd: 589.87 },
      ripple: { usd: 0.95326 }
    },
    NOW
  );

  assert.equal(Object.keys(cache).length, 6);
  assert.equal(cache.BTC?.price, 64697.4);
  assert.equal(cache.BTC?.source, "coingecko");
  assert.equal(cache.BTC?.lastUpdated, NOW);
  assert.equal(cache.USDT?.price, 0.99903);
  // Missing change/market-cap fields fall back to 0 rather than NaN.
  assert.equal(cache.SOL?.change24h, 0);
});

test("drops CoinGecko entries with invalid prices instead of defaulting them", () => {
  const cache = normalizeCoinGecko(
    {
      bitcoin: { usd: 64697.4 },
      ethereum: { usd: 0 },
      solana: { usd: -5 },
      tether: { usd: "not-a-number" },
      binancecoin: {},
      ripple: { usd: 0.95 }
    },
    NOW
  );

  assert.deepEqual(Object.keys(cache).sort(), ["BTC", "XRP"]);
  assert.equal(cache.ETH, undefined);
});

test("normalises a Kraken payload including the xtbt/xeth/xxrp aliases", () => {
  const cache = normalizeKraken(
    {
      result: {
        XXBTZUSD: { c: ["64697.4", "0.1"], o: "64000.0" },
        XETHZUSD: { c: ["1816.21", "0.1"], o: "1816.21" },
        SOLUSD: { c: ["71.49", "0.1"], o: "70.0" },
        USDTZUSD: { c: ["0.99903", "0.1"], o: "0.99903" },
        BNBUSD: { c: ["589.87", "0.1"], o: "600.0" },
        XXRPZUSD: { c: ["0.95326", "0.1"], o: "0.95326" }
      }
    },
    NOW
  );

  assert.equal(Object.keys(cache).length, 6);
  assert.equal(cache.BTC?.price, 64697.4);
  assert.equal(cache.BTC?.source, "kraken");
  assert.equal(cache.USDT?.price, 0.99903);
  // 24h change is derived from Kraken's opening price.
  assert.ok(Math.abs((cache.BTC?.change24h ?? 0) - 1.0897) < 0.01);
});

test("normalises a Coinbase payload using the reciprocal of the USD rate", () => {
  const cache = normalizeCoinbase(
    {
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
    },
    NOW
  );

  assert.equal(Object.keys(cache).length, 6);
  assert.ok(Math.abs((cache.BTC?.price ?? 0) - 64752.4) < 20);
  assert.equal(cache.USDT?.source, "coinbase");
});

test("USDT is priced from the USDT market and is never substituted with USDC", () => {
  // Only USDC is present: USDT must be absent, not silently back-filled.
  const cache = normalizeCoinbase(
    {
      data: {
        rates: {
          BTC: "0.000015443438253",
          USDC: "1.0",
          ETH: "0.0005506062174454"
        }
      }
    },
    NOW
  );
  assert.equal(cache.USDT, undefined);
  assert.ok(Math.abs((cache.BTC?.price ?? 0) - 64752.4) < 20);

  // USDT present: it is priced from the genuine USDT rate (~1 USD), not USDC.
  const withUsdt = normalizeCoinbase(
    { data: { rates: { USDT: "1.0010110211313427", USDC: "1.0" } } },
    NOW
  );
  assert.ok(Math.abs((withUsdt.USDT?.price ?? 0) - 0.99899) < 0.001);
});

/* ------------------------------------------------------------------ */
/* Failure classification (HTTP 429 / HTTP 451)                        */
/* ------------------------------------------------------------------ */

test("treats HTTP 429 as rate limited and never as a retryable success", () => {
  const error = axiosLikeError(429, { "retry-after": "30" });
  assert.equal(isRateLimited(error), true);
  // 429 must not be retried: the provider asked us to back off.
  assert.equal(isRetryable(error), false);
  assert.equal(retryAfterMs(error), 30_000);
});

test("treats HTTP 451 as access restricted, not as a usable price source", () => {
  const error = axiosLikeError(451);
  assert.equal(isAccessRestricted(error), true);
  assert.equal(isRateLimited(error), false);
  assert.equal(isRetryable(error), false);
});

test("retries transient network and 5xx failures, but not 4xx", () => {
  assert.equal(isRetryable(axiosLikeError(500)), true);
  assert.equal(isRetryable(axiosLikeError(503)), true);
  assert.equal(isRetryable(axiosLikeError(408)), true);
  // No response at all: network/DNS/timeout.
  assert.equal(isRetryable({ isAxiosError: true }), true);
  assert.equal(isRetryable(axiosLikeError(400)), false);
  assert.equal(isRetryable(new Error("boom")), false);
});

test("reads Retry-After as either seconds or an HTTP date, capped", () => {
  assert.equal(retryAfterMs(axiosLikeError(429, { "retry-after": "120" })), 120_000);
  const farFuture = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
  // Capped at 15 minutes so a bad header cannot park a provider for hours.
  assert.equal(retryAfterMs(axiosLikeError(429, { "retry-after": farFuture })), 15 * 60 * 1000);
  assert.equal(retryAfterMs(axiosLikeError(429)), null);
});

/* ------------------------------------------------------------------ */
/* Freshness taxonomy                                                  */
/* ------------------------------------------------------------------ */

test("classifies snapshot age into live / cached / stale", () => {
  assert.equal(classifyPriceFreshness(5_000), "live");
  assert.equal(classifyPriceFreshness(4 * 60_000), "cached");
  assert.equal(classifyPriceFreshness(10 * 60_000), "stale");
  assert.equal(classifyPriceFreshness(null), "stale");
});

/* ------------------------------------------------------------------ */
/* Provider chain configuration                                        */
/* ------------------------------------------------------------------ */

test("excludes Binance from the provider chain unless explicitly enabled", () => {
  const previous = process.env.MARKET_BINANCE_ENABLED;
  const previousChain = process.env.MARKET_PROVIDER_CHAIN;
  delete process.env.MARKET_BINANCE_ENABLED;
  delete process.env.MARKET_PROVIDER_CHAIN;

  const ids = () => resolveProviderChain().map((provider) => provider.id);
  assert.deepEqual(ids(), ["coingecko", "kraken", "coinbase"]);

  process.env.MARKET_PROVIDER_CHAIN = "coingecko,binance";
  assert.deepEqual(ids(), ["coingecko"]);

  process.env.MARKET_BINANCE_ENABLED = "true";
  assert.deepEqual(ids(), ["coingecko", "binance"]);

  if (previous === undefined) {
    delete process.env.MARKET_BINANCE_ENABLED;
  } else {
    process.env.MARKET_BINANCE_ENABLED = previous;
  }
  if (previousChain === undefined) {
    delete process.env.MARKET_PROVIDER_CHAIN;
  } else {
    process.env.MARKET_PROVIDER_CHAIN = previousChain;
  }
});

test("refresh interval is environment-configurable", () => {
  const previous = process.env.MARKET_REFRESH_INTERVAL_MS;
  delete process.env.MARKET_REFRESH_INTERVAL_MS;
  assert.equal(getMarketRefreshIntervalMs(), 60_000);

  process.env.MARKET_REFRESH_INTERVAL_MS = "15000";
  assert.equal(getMarketRefreshIntervalMs(), 15_000);

  process.env.MARKET_REFRESH_INTERVAL_MS = "not-a-number";
  assert.equal(getMarketRefreshIntervalMs(), 60_000);

  if (previous === undefined) {
    delete process.env.MARKET_REFRESH_INTERVAL_MS;
  } else {
    process.env.MARKET_REFRESH_INTERVAL_MS = previous;
  }
});
