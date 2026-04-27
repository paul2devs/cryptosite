export type MarketSymbol = "BTC" | "ETH" | "SOL" | "USDT" | "BNB" | "XRP";

export interface PublicMarketPoint {
  symbol: MarketSymbol;
  price: number;
  change24h: number;
  marketCap: number;
  lastUpdated: string;
}

export type PublicMarketSnapshot = Partial<Record<MarketSymbol, PublicMarketPoint>>;

const FALLBACK_MARKET_API_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether,binancecoin,ripple&vs_currencies=usd&include_market_cap=true&include_24hr_change=true";

const symbolToCoinId: Record<MarketSymbol, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDT: "tether",
  BNB: "binancecoin",
  XRP: "ripple"
};

type CoinGeckoEntry = {
  usd?: number;
  usd_24h_change?: number;
  usd_market_cap?: number;
};

type CoinGeckoResponse = Record<string, CoinGeckoEntry>;

function getMarketApiUrl(): string {
  const configured = import.meta.env.VITE_MARKET_API_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim();
  }
  return FALLBACK_MARKET_API_URL;
}

export async function fetchPublicMarketSnapshot(): Promise<PublicMarketSnapshot> {
  const apiUrl = getMarketApiUrl();
  const apiKey = import.meta.env.VITE_MARKET_API_KEY;
  const headers: HeadersInit = {};
  if (typeof apiKey === "string" && apiKey.trim().length > 0) {
    headers["x-cg-demo-api-key"] = apiKey.trim();
  }

  const response = await fetch(apiUrl, {
    method: "GET",
    headers
  });

  if (!response.ok) {
    throw new Error(`Market API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as CoinGeckoResponse;
  const now = new Date().toISOString();
  const normalized: PublicMarketSnapshot = {};

  (Object.keys(symbolToCoinId) as MarketSymbol[]).forEach((symbol) => {
    const coinId = symbolToCoinId[symbol];
    const item = payload?.[coinId];
    const price = item?.usd;
    if (!Number.isFinite(price)) {
      return;
    }

    normalized[symbol] = {
      symbol,
      price: Number(price),
      change24h: Number.isFinite(item?.usd_24h_change) ? Number(item?.usd_24h_change) : 0,
      marketCap: Number.isFinite(item?.usd_market_cap) ? Number(item?.usd_market_cap) : 0,
      lastUpdated: now
    } satisfies PublicMarketPoint;
  });

  return normalized;
}
