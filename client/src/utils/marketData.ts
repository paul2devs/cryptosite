import axios from "axios";
import { resolveApiBaseUrl } from "./apiBase";

export type MarketSymbol = "BTC" | "ETH" | "SOL" | "USDT" | "BNB" | "XRP";

export interface PublicMarketPoint {
  symbol: MarketSymbol;
  price: number;
  change24h: number;
  marketCap: number;
  lastUpdated: string;
}

export type PublicMarketSnapshot = Partial<Record<MarketSymbol, PublicMarketPoint>>;

/**
 * Market data is fetched from NexaCrypto's own backend (`GET /api/market/prices`)
 * instead of from a market-data provider directly.
 *
 * The backend owns the provider chain, the shared cache and all rate-limit
 * handling. Calling a provider from the browser would make every visitor compete
 * with the server for the same upstream rate limit (a cause of HTTP 429) and
 * would risk shipping a provider API key to the client. A plain `axios` call is
 * used deliberately: this endpoint is public, so it must not run the
 * authenticated client's session-refresh interceptor.
 */
export async function fetchPublicMarketSnapshot(): Promise<PublicMarketSnapshot> {
  const response = await axios.get<PublicMarketSnapshot>(
    `${resolveApiBaseUrl()}/market/prices`,
    { timeout: 10_000 }
  );
  return response.data ?? {};
}
