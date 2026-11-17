import axios from "axios";
import { getCachedJson, getCacheStatus, setCachedJson } from "../config/cache";

export type SupportedSymbol = "BTC" | "ETH" | "SOL" | "USDT" | "BNB" | "XRP";

/**
 * The upstream provider that produced a price point. Every quote is traceable
 * to a configured provider so the deposit flow can disclose the rate source.
 * The platform never fabricates prices.
 */
export type MarketDataSource = "coingecko" | "kraken" | "coinbase" | "binance";

export interface MarketDataPoint {
  symbol: SupportedSymbol;
  /** Price of one unit of the asset in USD. Always finite and strictly positive. */
  price: number;
  /** 24h change in percent; 0 when the provider does not report it. */
  change24h: number;
  /** Market capitalisation in USD; 0 when the provider does not report it. */
  marketCap: number;
  /** ISO timestamp of the provider response this point came from. */
  lastUpdated: string;
  source: MarketDataSource;
}

/**
 * A price snapshot keyed by symbol. A symbol a provider failed to return is
 * absent: callers must treat a missing key as "no usable rate" instead of
 * inventing a value.
 */
export type MarketCache = Partial<Record<SupportedSymbol, MarketDataPoint>>;

export const SUPPORTED_MARKET_SYMBOLS: SupportedSymbol[] = [
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
const COINGECKO_IDS: Record<SupportedSymbol, string> = {
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
const KRAKEN_PAIRS: Record<SupportedSymbol, string> = {
  BTC: "XXBTZUSD",
  ETH: "XETHZUSD",
  SOL: "SOLUSD",
  USDT: "USDTZUSD",
  BNB: "BNBUSD",
  XRP: "XXRPZUSD"
};

/** Extra result keys Kraken may return for a pair, in case of alias drift. */
const KRAKEN_PAIR_ALIASES: Record<SupportedSymbol, string[]> = {
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
const COINBASE_RATE_CODES: Record<SupportedSymbol, string> = {
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
const BINANCE_PAIRS: Record<SupportedSymbol, string | null> = {
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

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || String(raw).trim().length === 0) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw || String(raw).trim().length === 0) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

/** How often the central refresh runs. */
export function getMarketRefreshIntervalMs(): number {
  return readPositiveInt("MARKET_REFRESH_INTERVAL_MS", 60_000);
}

function cacheTtlSeconds(): number {
  return readPositiveInt("MARKET_CACHE_TTL_SECONDS", 1_800);
}

function requestTimeoutMs(): number {
  return readPositiveInt("MARKET_REQUEST_TIMEOUT_MS", 7_000);
}

function retryAttempts(): number {
  return readPositiveInt("MARKET_RETRY_ATTEMPTS", 2);
}

function retryBackoffMs(): number {
  return readPositiveInt("MARKET_RETRY_BACKOFF_MS", 400);
}

/** A rate older than this can never price a new conversion. */
export const MARKET_STALE_MS = 5 * 60 * 1000;

/** A price at or below this age is treated as live. */
export function getMarketLiveMs(): number {
  return Math.max(getMarketRefreshIntervalMs(), 90_000);
}

/** Default cool-down after an HTTP 429 when the provider sends no Retry-After. */
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;
/** Cool-down after an access-restricted response (HTTP 451). */
const ACCESS_RESTRICTED_COOLDOWN_MS = 30 * 60 * 1000;
/** Upper bound for any provider cool-down so a bad header cannot park a provider for a day. */
const MAX_PROVIDER_COOLDOWN_MS = 15 * 60 * 1000;

export type PriceFreshness = "live" | "cached" | "stale";

/** Classify a snapshot's age into the three freshness buckets. */
export function classifyPriceFreshness(ageMs: number | null): PriceFreshness {
  if (ageMs === null || !Number.isFinite(ageMs)) {
    return "stale";
  }
  if (ageMs <= getMarketLiveMs()) {
    return "live";
  }
  if (ageMs <= MARKET_STALE_MS) {
    return "cached";
  }
  return "stale";
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let inMemoryCache: MarketCache | null = null;
let lastRefreshAttemptAt = 0;
let lastSuccessfulRefreshAt = 0;
let lastRefreshError: string | null = null;
let lastProviderWarnings: string[] = [];
let lastRateLimited = false;
let lastAccessRestricted = false;
let lastLoggedError: string | null = null;
let refreshInFlight: Promise<void> | null = null;

const providerCooldownUntil: Partial<Record<MarketDataSource, number>> = {};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Accept a price only when it is a finite, strictly positive number. This
 * rejects missing, zero, negative, NaN and non-numeric values. Anything that
 * cannot be trusted as a real price is dropped rather than defaulted.
 */
export function isUsablePrice(value: unknown): value is number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0;
}

function toPositiveNumber(value: unknown): number | null {
  return isUsablePrice(value) ? Number(value) : null;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function statusOf(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }
  return null;
}

function describeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status) {
      return `HTTP ${status}`;
    }
    return error.code ? `${error.code}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Rate limited (HTTP 429) or access restricted (HTTP 451) responses. */
export function isRateLimited(error: unknown): boolean {
  return statusOf(error) === 429;
}

/** HTTP 451: the provider is unreachable from this environment (geo/legal). */
export function isAccessRestricted(error: unknown): boolean {
  return statusOf(error) === 451;
}

/**
 * A transient failure worth one retry. HTTP 429 is deliberately excluded: the
 * provider asked us to slow down, so the caller parks the provider for the
 * Retry-After window and fails over instead of retrying immediately.
 */
export function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
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
export function retryAfterMs(error: unknown): number | null {
  if (!axios.isAxiosError(error)) {
    return null;
  }
  const headers = error.response?.headers as Record<string, unknown> | undefined;
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

function logMarketWarning(message: string): void {
  if (lastLoggedError === message) {
    return;
  }
  lastLoggedError = message;
  // eslint-disable-next-line no-console
  console.warn(`[market] ${message}`);
}

function logMarketInfo(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[market] ${message}`);
}

async function requestWithRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  const attempts = retryAttempts();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
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
export function normalizeCoinGecko(
  payload: unknown,
  now: string = new Date().toISOString()
): MarketCache {
  if (!payload || typeof payload !== "object") {
    throw new Error("CoinGecko returned an unexpected payload");
  }
  const record = payload as Record<string, Record<string, unknown>>;
  const result: MarketCache = {};

  for (const symbol of SUPPORTED_MARKET_SYMBOLS) {
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
export function normalizeKraken(
  payload: unknown,
  now: string = new Date().toISOString()
): MarketCache {
  const record = (payload as { result?: Record<string, unknown> } | null)?.result;
  if (!record || typeof record !== "object") {
    throw new Error("Kraken returned an unexpected payload");
  }
  const result: MarketCache = {};

  for (const symbol of SUPPORTED_MARKET_SYMBOLS) {
    const aliases = KRAKEN_PAIR_ALIASES[symbol];
    const key = Object.keys(record).find((candidate) => aliases.includes(candidate));
    if (!key) {
      continue;
    }
    const entry = record[key] as { c?: unknown[]; o?: unknown; v?: unknown[] } | undefined;
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
export function normalizeCoinbase(
  payload: unknown,
  now: string = new Date().toISOString()
): MarketCache {
  const rates = (payload as { data?: { rates?: Record<string, unknown> } } | null)?.data?.rates;
  if (!rates || typeof rates !== "object") {
    throw new Error("Coinbase returned an unexpected payload");
  }
  const result: MarketCache = {};

  for (const symbol of SUPPORTED_MARKET_SYMBOLS) {
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

/* ------------------------------------------------------------------ */
/* Provider implementations                                            */
/* ------------------------------------------------------------------ */

interface ProviderDefinition {
  id: MarketDataSource;
  label: string;
  fetch(): Promise<MarketCache>;
}

function coingeckoUrl(): string {
  return (process.env.COINGECKO_API_BASE || "https://api.coingecko.com/api/v3").replace(/\/+$/, "");
}

async function fetchFromCoinGecko(): Promise<MarketCache> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const apiKey = (process.env.COINGECKO_API_KEY || "").trim();
  const keyType = (process.env.COINGECKO_API_KEY_TYPE || "demo").trim().toLowerCase();
  const headers: Record<string, string> = {};
  if (apiKey) {
    // A demo/pro key removes the aggressive anonymous rate limiting that makes
    // the public endpoint unreliable behind shared datacenter IPs.
    headers[keyType === "pro" ? "x-cg-pro-api-key" : "x-cg-demo-api-key"] = apiKey;
  }

  const response = await requestWithRetry("CoinGecko", () =>
    axios.get(`${coingeckoUrl()}/simple/price`, {
      params: {
        ids,
        vs_currencies: "usd",
        include_24hr_change: "true",
        include_market_cap: "true"
      },
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      timeout: requestTimeoutMs()
    })
  );

  const cache = normalizeCoinGecko(response.data);
  if (Object.keys(cache).length === 0) {
    throw new Error("CoinGecko returned no usable prices");
  }
  return cache;
}

async function fetchFromKraken(): Promise<MarketCache> {
  const baseUrl = (process.env.KRAKEN_API_BASE || "https://api.kraken.com").replace(/\/+$/, "");
  const pairs = SUPPORTED_MARKET_SYMBOLS.map((symbol) => KRAKEN_PAIRS[symbol]).join(",");

  const response = await requestWithRetry("Kraken", () =>
    axios.get(`${baseUrl}/0/public/Ticker`, {
      params: { pair: pairs },
      timeout: requestTimeoutMs()
    })
  );

  const cache = normalizeKraken(response.data);
  if (Object.keys(cache).length === 0) {
    throw new Error("Kraken returned no usable prices");
  }
  return cache;
}

async function fetchFromCoinbase(): Promise<MarketCache> {
  const baseUrl = (process.env.COINBASE_API_BASE || "https://api.coinbase.com/v2/exchange-rates").replace(
    /\/+$/,
    ""
  );

  const response = await requestWithRetry("Coinbase", () =>
    axios.get(baseUrl, {
      params: { currency: "USD" },
      timeout: requestTimeoutMs()
    })
  );

  const cache = normalizeCoinbase(response.data);
  if (Object.keys(cache).length === 0) {
    throw new Error("Coinbase returned no usable prices");
  }
  return cache;
}

async function fetchBinancePair(
  baseUrl: string,
  pair: string
): Promise<{ lastPrice: number; priceChangePercent: number; quoteVolume: number }> {
  const response = await requestWithRetry(`Binance ${pair}`, () =>
    axios.get(baseUrl, {
      params: { symbol: pair },
      timeout: requestTimeoutMs()
    })
  );
  const data = response.data as {
    lastPrice?: string;
    priceChangePercent?: string;
    quoteVolume?: string;
  };
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

async function fetchFromBinance(): Promise<MarketCache> {
  const baseUrl = process.env.BINANCE_API_BASE || "https://api.binance.com/api/v3/ticker/24hr";
  const now = new Date().toISOString();
  const result: MarketCache = {};

  const pairs = SUPPORTED_MARKET_SYMBOLS.map(
    (symbol) => [symbol, BINANCE_PAIRS[symbol]] as const
  ).filter((entry): entry is readonly [SupportedSymbol, string] => entry[1] !== null);

  // `allSettled`, not `all`: one unsupported or delisted pair must not discard
  // the prices that did come back.
  const settled = await Promise.allSettled(
    pairs.map(async ([symbol, pair]) => {
      const ticker = await fetchBinancePair(baseUrl, pair);
      return [symbol, ticker] as const;
    })
  );

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
  } catch {
    // USDT simply stays unavailable from this provider.
  }

  if (Object.keys(result).length === 0) {
    throw new Error("Binance returned no usable prices");
  }
  return result;
}

const PROVIDERS: Record<MarketDataSource, ProviderDefinition> = {
  coingecko: { id: "coingecko", label: "CoinGecko", fetch: fetchFromCoinGecko },
  kraken: { id: "kraken", label: "Kraken", fetch: fetchFromKraken },
  coinbase: { id: "coinbase", label: "Coinbase", fetch: fetchFromCoinbase },
  binance: { id: "binance", label: "Binance", fetch: fetchFromBinance }
};

const DEFAULT_PROVIDER_CHAIN: MarketDataSource[] = ["coingecko", "kraken", "coinbase"];

function isProviderId(value: string): value is MarketDataSource {
  return value === "coingecko" || value === "kraken" || value === "coinbase" || value === "binance";
}

/**
 * Resolve the ordered provider chain. Binance is only included when explicitly
 * enabled, because it answers HTTP 451 from restricted (for example, US)
 * deployment environments and must not be treated as a working source there.
 */
export function resolveProviderChain(): ProviderDefinition[] {
  const raw = (process.env.MARKET_PROVIDER_CHAIN || "").trim();
  let ids: MarketDataSource[] = raw
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

function isSnapshotComplete(prices: MarketCache): boolean {
  return SUPPORTED_MARKET_SYMBOLS.every((symbol) => Boolean(prices[symbol]));
}

interface CollectResult {
  prices: MarketCache;
  errors: string[];
  rateLimited: boolean;
  accessRestricted: boolean;
}

/**
 * Walk the provider chain and fill any symbol still missing. Providers are
 * consumed only until the snapshot is complete, so a healthy primary costs a
 * single upstream request. A provider on cool-down is skipped without a request
 * — this is what stops the pipeline from hammering a rate-limited CoinGecko.
 */
async function collectFromProviders(): Promise<CollectResult> {
  const prices: MarketCache = {};
  const errors: string[] = [];
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
      for (const symbol of SUPPORTED_MARKET_SYMBOLS) {
        const point = data[symbol];
        if (point && !prices[symbol]) {
          prices[symbol] = point;
        }
      }
    } catch (error) {
      errors.push(`${provider.label}: ${describeError(error)}`);
      if (isRateLimited(error)) {
        rateLimited = true;
        const wait = retryAfterMs(error) ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS;
        providerCooldownUntil[provider.id] = Date.now() + wait;
        logMarketWarning(
          `${provider.label} rate limited; pausing this provider for ${Math.round(wait / 1000)}s`
        );
      } else if (isAccessRestricted(error)) {
        accessRestricted = true;
        providerCooldownUntil[provider.id] = Date.now() + ACCESS_RESTRICTED_COOLDOWN_MS;
        logMarketWarning(
          `${provider.label} is not reachable from this environment (HTTP 451); pausing this provider`
        );
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
export async function refreshMarketData(force = false): Promise<void> {
  const now = Date.now();
  const interval = lastRefreshError
    ? Math.max(getMarketRefreshIntervalMs(), 30_000)
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
      logMarketWarning(
        `live pricing unavailable (${lastRefreshError}). Keeping the previous snapshot if any.`
      );
      return;
    }

    inMemoryCache = collected.prices;
    lastSuccessfulRefreshAt = Date.now();
    lastRefreshError = null;

    await setCachedJson(
      MARKET_CACHE_KEY,
      { refreshedAt: new Date(lastSuccessfulRefreshAt).toISOString(), points: collected.prices },
      cacheTtlSeconds()
    );

    if (!isSnapshotComplete(collected.prices)) {
      const missing = SUPPORTED_MARKET_SYMBOLS.filter((symbol) => !collected.prices[symbol]);
      logMarketWarning(
        `partial pricing; missing ${missing.join(", ")}${
          collected.errors.length ? ` (${collected.errors.join(", ")})` : ""
        }`
      );
    } else if (collected.errors.length > 0) {
      logMarketWarning(
        `served from the provider chain with a degraded upstream (${collected.errors.join(", ")})`
      );
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/* ------------------------------------------------------------------ */
/* Cache access                                                        */
/* ------------------------------------------------------------------ */

interface SnapshotPayload {
  refreshedAt: string;
  points: MarketCache;
}

async function loadFromCache(): Promise<MarketCache | null> {
  if (inMemoryCache) {
    return inMemoryCache;
  }
  const cached = await getCachedJson<SnapshotPayload | MarketCache>(MARKET_CACHE_KEY);
  if (!cached || typeof cached !== "object") {
    return null;
  }
  const wrapped = "points" in cached;
  const points = (wrapped ? (cached as SnapshotPayload).points : cached) as MarketCache;
  if (!points || typeof points !== "object" || Object.keys(points).length === 0) {
    return null;
  }
  inMemoryCache = points;
  if (wrapped) {
    const refreshedAt = Date.parse((cached as SnapshotPayload).refreshedAt);
    if (Number.isFinite(refreshedAt)) {
      lastSuccessfulRefreshAt = refreshedAt;
    }
  }
  return points;
}

/** Age of the newest point in a snapshot, or null when it cannot be determined. */
export function snapshotAgeMs(cache: MarketCache | null): number | null {
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
export async function getAllMarketPrices(): Promise<MarketCache> {
  const cached = await loadFromCache();
  const ageMs = snapshotAgeMs(cached);

  if (ageMs !== null && ageMs < getMarketRefreshIntervalMs()) {
    return cached as MarketCache;
  }

  await refreshMarketData();

  const refreshed = await loadFromCache();
  return refreshed ?? cached ?? {};
}

export async function getMarketPriceForSymbol(
  symbol: SupportedSymbol
): Promise<MarketDataPoint | null> {
  const cache = await getAllMarketPrices();
  return cache[symbol] || null;
}

/* ------------------------------------------------------------------ */
/* Diagnostics                                                         */
/* ------------------------------------------------------------------ */

export interface MarketProviderStatus {
  id: MarketDataSource;
  label: string;
  inChain: boolean;
  coolingDown: boolean;
}

/** Operator-facing status of the pricing pipeline. Never exposed to end users. */
export interface MarketDataStatus {
  /** live / cached / stale / unavailable */
  health: PriceFreshness | "unavailable";
  hasData: boolean;
  source: MarketDataSource | null;
  providerSources: MarketDataSource[];
  lastUpdatedAt: string | null;
  ageSeconds: number | null;
  lastSuccessfulRefreshAt: string | null;
  lastAttemptAt: string | null;
  refreshing: boolean;
  rateLimited: boolean;
  accessRestricted: boolean;
  providers: MarketProviderStatus[];
  cache: { backend: string; redisConfigured: boolean; degraded: boolean };
  lastError: string | null;
  lastProviderWarnings: string[];
}

export async function getMarketDataStatus(): Promise<MarketDataStatus> {
  const cache = await loadFromCache();
  const ageMs = snapshotAgeMs(cache);
  const points = cache ? Object.values(cache).filter(Boolean) : [];
  const sources = Array.from(
    new Set(points.map((point) => point!.source).filter(Boolean) as MarketDataSource[])
  );
  const freshness = classifyPriceFreshness(ageMs);
  const chain = resolveProviderChain().map((provider) => provider.id);

  return {
    health: points.length === 0 ? "unavailable" : freshness,
    hasData: points.length > 0,
    source: sources[0] ?? null,
    providerSources: sources,
    lastUpdatedAt: ageMs === null ? null : new Date(Date.now() - ageMs).toISOString(),
    ageSeconds: ageMs === null ? null : Math.round(ageMs / 1000),
    lastSuccessfulRefreshAt:
      lastSuccessfulRefreshAt === 0 ? null : new Date(lastSuccessfulRefreshAt).toISOString(),
    lastAttemptAt: lastRefreshAttemptAt === 0 ? null : new Date(lastRefreshAttemptAt).toISOString(),
    refreshing: refreshInFlight !== null,
    rateLimited: lastRateLimited,
    accessRestricted: lastAccessRestricted,
    providers: (Object.keys(PROVIDERS) as MarketDataSource[]).map((id) => ({
      id,
      label: PROVIDERS[id].label,
      inChain: chain.includes(id),
      coolingDown: (providerCooldownUntil[id] ?? 0) > Date.now()
    })),
    cache: getCacheStatus(),
    lastError: lastRefreshError,
    lastProviderWarnings
  };
}

/**
 * Validate the pricing configuration at startup and log which providers are in
 * the chain. Returns human-readable warnings for anything misconfigured.
 */
export function validateMarketDataConfig(): string[] {
  const warnings: string[] = [];
  const chain = resolveProviderChain();
  logMarketInfo(
    `provider chain: ${chain.map((provider) => provider.label).join(" → ")} (fallback: last-known-good snapshot)`
  );
  if (!chain.some((provider) => provider.id === "coingecko")) {
    warnings.push("CoinGecko is not in the provider chain; verify MARKET_PROVIDER_CHAIN.");
  }
  if (!readBoolean("MARKET_BINANCE_ENABLED", false)) {
    logMarketInfo("Binance is disabled (set MARKET_BINANCE_ENABLED=true only where Binance is reachable).");
  }
  if (chain.length < 2) {
    warnings.push(
      "Only one live pricing provider is configured; a single provider outage will fall back straight to the last-known-good snapshot."
    );
  }
  if (!process.env.REDIS_URL) {
    warnings.push(
      "REDIS_URL is not set: market prices are cached in memory only and are not shared between instances."
    );
  }
  for (const warning of warnings) {
    logMarketWarning(warning);
  }
  return warnings;
}

/** Force an initial refresh so the first user never waits on an empty cache. */
export async function primeMarketData(): Promise<void> {
  await refreshMarketData(true);
}
