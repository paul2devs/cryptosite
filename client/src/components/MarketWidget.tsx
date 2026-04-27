import { useMemo } from "react";
import { motion } from "framer-motion";
import btcLogo from "../assets/crypto/btc.svg";
import ethLogo from "../assets/crypto/eth.svg";
import solLogo from "../assets/crypto/sol.svg";
import usdtLogo from "../assets/crypto/usdt.svg";
import bnbLogo from "../assets/crypto/bnb.svg";
import xrpLogo from "../assets/crypto/xrp.svg";
import { LiveMarketSymbol, useLiveMarket } from "../hooks/useLiveMarket";

type SupportedSymbol = LiveMarketSymbol;

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
  const { data, loading, error } = useLiveMarket(symbols);
  const hasAnyData = useMemo(() => symbols.some((symbol) => !!data[symbol]), [data]);

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
          12s auto refresh
        </span>
      </div>
      <div className="space-y-1 text-[10px] text-[#9CA3AF]">
        <span>Prices update continuously to mirror live market conditions.</span>
        {error && !hasAnyData ? <span className="text-[#EA3943]">{error}</span> : null}
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
                {loading && !hasAnyData ? (
                  <div className="h-5 w-20 animate-pulse rounded bg-[#26272B]" />
                ) : (
                  <motion.span
                    key={`${symbol}-price-${item?.price ?? 0}`}
                    initial={{ opacity: 0.5, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm font-medium"
                  >
                    {item?.price
                      ? `$${item.price.toLocaleString(undefined, {
                          maximumFractionDigits: 2
                        })}`
                      : "--"}
                  </motion.span>
                )}
                <div className="flex items-center gap-2">
                  {loading && !hasAnyData ? (
                    <div className="h-4 w-12 animate-pulse rounded bg-[#26272B]" />
                  ) : (
                    <motion.span
                      key={`${symbol}-change-${item?.change24h ?? 0}`}
                      initial={{ opacity: 0.4, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className={
                        isUp ? "text-[#16C784] text-[11px]" : "text-[#EA3943] text-[11px]"
                      }
                    >
                      {item ? `${isUp ? "+" : ""}${change.toFixed(2)}%` : "--"}
                    </motion.span>
                  )}
                  <span className="text-[10px] text-[#9CA3AF]">
                    {loading && !hasAnyData
                      ? "MC --"
                      : item?.marketCap
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

