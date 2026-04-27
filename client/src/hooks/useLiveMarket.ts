import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicMarketSnapshot,
  type MarketSymbol as LiveMarketSymbol,
  type PublicMarketPoint as LiveMarketPoint,
  type PublicMarketSnapshot as LiveMarketSnapshot
} from "../utils/marketData";

export type { LiveMarketSymbol, LiveMarketPoint, LiveMarketSnapshot };

type Listener = (snapshot: LiveMarketSnapshot) => void;

const STORAGE_KEY = "liveMarketCache.v2";
const REFRESH_MS = 12_000;
const FRESH_CACHE_MS = 90_000;
const listeners = new Set<Listener>();
const supportedSymbols: LiveMarketSymbol[] = ["BTC", "ETH", "SOL", "USDT", "BNB", "XRP"];
let marketSnapshot: LiveMarketSnapshot = readCachedSnapshot();
let inflightPromise: Promise<LiveMarketSnapshot> | null = null;
let refreshTimer: number | null = null;

function readCachedSnapshot(): LiveMarketSnapshot {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as {
      timestamp?: number;
      data?: Record<string, LiveMarketPoint>;
    };
    if (!parsed || typeof parsed !== "object" || !parsed.data || !parsed.timestamp) {
      return {};
    }
    if (Date.now() - parsed.timestamp > FRESH_CACHE_MS) {
      return {};
    }
    return parsed.data as LiveMarketSnapshot;
  } catch {
    return {};
  }
}

function persistSnapshot(data: LiveMarketSnapshot) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data
      })
    );
  } catch {
    return;
  }
}

function notify(snapshot: LiveMarketSnapshot) {
  listeners.forEach((listener) => {
    listener(snapshot);
  });
}

function normalizeResponse(data: Record<string, LiveMarketPoint>): LiveMarketSnapshot {
  const normalized: LiveMarketSnapshot = {};
  supportedSymbols.forEach((symbol) => {
    const point = data[symbol];
    if (!point || !Number.isFinite(point.price)) {
      return;
    }
    normalized[symbol] = {
      symbol,
      price: point.price,
      change24h: Number.isFinite(point.change24h) ? point.change24h : 0,
      marketCap: Number.isFinite(point.marketCap) ? point.marketCap : 0,
      lastUpdated: point.lastUpdated || new Date().toISOString()
    };
  });
  return normalized;
}

async function fetchSnapshot(): Promise<LiveMarketSnapshot> {
  if (inflightPromise) {
    return inflightPromise;
  }
  inflightPromise = fetchPublicMarketSnapshot()
    .then((marketResponse) => {
      const next = normalizeResponse(marketResponse as Record<string, LiveMarketPoint>);
      if (Object.keys(next).length > 0) {
        marketSnapshot = next;
        persistSnapshot(next);
        notify(next);
      }
      return marketSnapshot;
    })
    .catch(() => marketSnapshot)
    .finally(() => {
      inflightPromise = null;
    });
  return inflightPromise;
}

function startGlobalRefresh() {
  if (typeof window === "undefined") {
    return;
  }
  if (refreshTimer !== null) {
    return;
  }
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void fetchSnapshot();
    }
  }, REFRESH_MS);
}

export function primeLiveMarketCache() {
  void fetchSnapshot();
  startGlobalRefresh();
}

export function useLiveMarket(symbols: LiveMarketSymbol[]) {
  const [data, setData] = useState<LiveMarketSnapshot>(marketSnapshot);
  const [loading, setLoading] = useState(Object.keys(marketSnapshot).length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onSnapshot: Listener = (snapshot) => {
      setData(snapshot);
      setLoading(false);
      setError(null);
    };
    listeners.add(onSnapshot);
    primeLiveMarketCache();
    void fetchSnapshot()
      .catch(() => {
        setError("Unable to load live market data right now.");
      })
      .finally(() => setLoading(false));
    return () => {
      listeners.delete(onSnapshot);
    };
  }, []);

  const filtered = useMemo(() => {
    const subset: LiveMarketSnapshot = {};
    symbols.forEach((symbol) => {
      if (data[symbol]) {
        subset[symbol] = data[symbol];
      }
    });
    return subset;
  }, [data, symbols]);

  return {
    data: filtered,
    loading,
    error
  };
}

