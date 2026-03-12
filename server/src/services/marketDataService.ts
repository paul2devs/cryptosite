import axios from "axios";
import { getCachedJson, setCachedJson } from "../config/cache";

export type SupportedSymbol = "BTC" | "ETH" | "SOL" | "USDT" | "BNB" | "XRP" | "MATIC";

export interface MarketDataPoint {
  symbol: SupportedSymbol;
  price: number;
  change24h: number;
  marketCap: number;
  lastUpdated: string;
}

type MarketCache = Record<SupportedSymbol, MarketDataPoint>;

const COINGECKO_IDS: Record<SupportedSymbol, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDT: "tether",
  BNB: "binancecoin",
  XRP: "ripple",
  MATIC: "matic-network"
};

const MARKET_CACHE_KEY = "market:latest";
const MARKET_CACHE_TTL_SECONDS = 20;

let inMemoryCache: MarketCache | null = null;

export async function fetchFromCoinGecko(): Promise<MarketCache> {
  const ids = Object.values(COINGECKO_IDS).join(",");
  const url = `${
    process.env.COINGECKO_API_BASE || "https://api.coingecko.com/api/v3"
  }/simple/price`;

  const response = await axios.get(url, {
    params: {
      ids,
      vs_currencies: "usd",
      include_24hr_change: "true",
      include_market_cap: "true"
    },
    timeout: 5000
  });

  const now = new Date().toISOString();
  const data = response.data as Record<
    string,
    { usd: number; usd_24h_change: number; usd_market_cap: number }
  >;

  const result: MarketCache = {
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
    MATIC: {
      symbol: "MATIC",
      price: data[COINGECKO_IDS.MATIC].usd,
      change24h: data[COINGECKO_IDS.MATIC].usd_24h_change,
      marketCap: data[COINGECKO_IDS.MATIC].usd_market_cap,
      lastUpdated: now
    }
  };

  return result;
}

async function fetchFromBinance(): Promise<MarketCache> {
  const baseUrl =
    process.env.BINANCE_API_BASE || "https://api.binance.com/api/v3/ticker/24hr";

  const symbols: Record<SupportedSymbol, string> = {
    BTC: "BTCUSDT",
    ETH: "ETHUSDT",
    SOL: "SOLUSDT",
    USDT: "USDTUSDT",
    BNB: "BNBUSDT",
    XRP: "XRPUSDT",
    MATIC: "MATICUSDT"
  };

  const now = new Date().toISOString();
  const entries = await Promise.all(
    (Object.keys(symbols) as SupportedSymbol[]).map(async (symbol) => {
      const marketSymbol = symbols[symbol];
      const response = await axios.get(baseUrl, {
        params: { symbol: marketSymbol },
        timeout: 5000
      });
      const data = response.data as {
        lastPrice: string;
        priceChangePercent: string;
        quoteVolume: string;
      };
      const price = Number(data.lastPrice);
      const change24h = Number(data.priceChangePercent);
      const marketCap = Number(data.quoteVolume);
      const point: MarketDataPoint = {
        symbol,
        price,
        change24h,
        marketCap,
        lastUpdated: now
      };
      return [symbol, point] as const;
    })
  );

  const result: MarketCache = {
    BTC: entries.find(([s]) => s === "BTC")![1],
    ETH: entries.find(([s]) => s === "ETH")![1],
    SOL: entries.find(([s]) => s === "SOL")![1],
    USDT: entries.find(([s]) => s === "USDT")![1],
    BNB: entries.find(([s]) => s === "BNB")![1],
    XRP: entries.find(([s]) => s === "XRP")![1],
    MATIC: entries.find(([s]) => s === "MATIC")![1]
  };

  return result;
}

export async function refreshMarketData(): Promise<void> {
  try {
    const data = await fetchFromCoinGecko();
    inMemoryCache = data;
    await setCachedJson(MARKET_CACHE_KEY, data, MARKET_CACHE_TTL_SECONDS);
    return;
  } catch {
    try {
      const fallback = await fetchFromBinance();
      inMemoryCache = fallback;
      await setCachedJson(MARKET_CACHE_KEY, fallback, MARKET_CACHE_TTL_SECONDS);
      return;
    } catch {
      return;
    }
  }
}

async function loadFromCache(): Promise<MarketCache | null> {
  if (inMemoryCache) {
    return inMemoryCache;
  }
  const cached = await getCachedJson<MarketCache>(MARKET_CACHE_KEY);
  if (cached) {
    inMemoryCache = cached;
    return cached;
  }
  return null;
}

export async function getAllMarketPrices(): Promise<MarketCache> {
  const existing = await loadFromCache();
  if (existing) {
    return existing;
  }
  await refreshMarketData();
  return (await loadFromCache()) || ({} as MarketCache);
}

export async function getMarketPriceForSymbol(
  symbol: SupportedSymbol
): Promise<MarketDataPoint | null> {
  const cache = await getAllMarketPrices();
  return cache[symbol] || null;
}

