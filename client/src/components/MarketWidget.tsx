import { useEffect, useState } from "react";
import { api } from "../utils/api";
import btcLogo from "../assets/crypto/btc.svg";
import ethLogo from "../assets/crypto/eth.svg";
import solLogo from "../assets/crypto/sol.svg";
import usdtLogo from "../assets/crypto/usdt.svg";
import bnbLogo from "../assets/crypto/bnb.svg";
import xrpLogo from "../assets/crypto/xrp.svg";

type SupportedSymbol = "BTC" | "ETH" | "SOL" | "USDT" | "BNB" | "XRP";

interface MarketDataPoint {
  symbol: SupportedSymbol;
  price: number;
  change24h: number;
  marketCap: number;
  lastUpdated: string;
}

type MarketResponse = Record<string, MarketDataPoint>;

const MARKET_META: Record<
  SupportedSymbol,
  { name: string; logo: string; color: string }
> = {
  BTC: {
    name: "Bitcoin",
    logo: btcLogo,
    color: "#F7931A"
  },
  ETH: {
    name: "Ethereum",
    logo: ethLogo,
    color: "#627EEA"
  },
  SOL: {
    name: "Solana",
    logo: solLogo,
    color: "#00FFA3"
  },
  USDT: {
    name: "Tether",
    logo: usdtLogo,
    color: "#26A17B"
  },
  BNB: {
    name: "BNB",
    logo: bnbLogo,
    color: "#F3BA2F"
  },
  XRP: {
    name: "XRP",
    logo: xrpLogo,
    color: "#23292F"
  },
};

const symbols: SupportedSymbol[] = [
  "BTC",
  "ETH",
  "SOL",
  "USDT",
  "BNB",
  "XRP",
];

export function MarketWidget() {
  const [data, setData] = useState<MarketResponse>({});

  const load = async () => {
    try {
      const res = await api.get<MarketResponse>("/market/prices");
      setData(res.data);
    } catch {
      setData({});
    }
  };

  useEffect(() => {
    let interval: number | null = null;
    let cancelled = false;

    const start = () => {
      if (interval !== null) return;
      void load();
      interval = window.setInterval(() => {
        if (!cancelled && document.visibilityState === "visible") {
          void load();
        }
      }, 15000);
    };

    const stop = () => {
      if (interval !== null) {
        window.clearInterval(interval);
        interval = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  return (
    <div className="rounded-3xl bg-[#17181A]/60 px-4 py-4 sm:px-5 sm:py-5 space-y-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-sm font-medium text-[#F5F5F7]">
            Live Market
          </span>
          <span className="text-[11px] text-[#9CA3AF]">
            BTC · ETH · SOL · USDT · and more
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#9CA3AF]">
          15s auto refresh
        </span>
      </div>
      <div className="space-y-1 text-[10px] text-[#9CA3AF]">
        <span>Prices update continuously to mirror live market conditions.</span>
      </div>
      <div className="mt-2 space-y-1">
        {symbols.map((symbol) => {
          const item = data[symbol];
          const change = item?.change24h ?? 0;
          const isUp = change >= 0;
          const meta = MARKET_META[symbol];

          return (
            <div
              key={symbol}
              className="flex items-center justify-between rounded-2xl bg-[#17181A]/80 px-3 py-2.5 text-xs text-[#F5F5F7] transition-colors hover:bg-[#1F2023]"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-[#0F0F10] flex items-center justify-center overflow-hidden">
                  <img
                    src={meta.logo}
                    alt={meta.name}
                    className="h-5 w-5"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-[#F5F5F7]">
                    {meta.name}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF]">{symbol}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-medium">
                  {item?.price
                    ? `$${item.price.toLocaleString(undefined, {
                        maximumFractionDigits: 2
                      })}`
                    : "--"}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      isUp ? "text-[#16C784] text-[11px]" : "text-[#EA3943] text-[11px]"
                    }
                  >
                    {item
                      ? `${isUp ? "+" : ""}${change.toFixed(2)}%`
                      : "--"}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF]">
                    {item?.marketCap
                      ? `MC $${(item.marketCap / 1_000_000_000).toFixed(1)}B`
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

