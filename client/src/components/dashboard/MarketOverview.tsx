import { useMemo } from "react";
import btcLogo from "../../assets/crypto/btc.svg";
import ethLogo from "../../assets/crypto/eth.svg";
import solLogo from "../../assets/crypto/sol.svg";
import usdtLogo from "../../assets/crypto/usdt.svg";
import bnbLogo from "../../assets/crypto/bnb.svg";
import xrpLogo from "../../assets/crypto/xrp.svg";
import { useLiveMarket, type LiveMarketSymbol } from "../../hooks/useLiveMarket";
import { Section, SectionHeader, SkeletonBlock } from "./primitives";
import { formatPercent } from "../../utils/format";

const MARKET_META: Record<LiveMarketSymbol, { name: string; logo: string }> = {
  BTC: { name: "Bitcoin", logo: btcLogo },
  ETH: { name: "Ethereum", logo: ethLogo },
  SOL: { name: "Solana", logo: solLogo },
  USDT: { name: "Tether", logo: usdtLogo },
  BNB: { name: "BNB", logo: bnbLogo },
  XRP: { name: "XRP", logo: xrpLogo }
};

const SYMBOLS: LiveMarketSymbol[] = ["BTC", "ETH", "SOL", "USDT", "BNB", "XRP"];

function formatPrice(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  if (price >= 1) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return `$${price.toLocaleString("en-US", { maximumFractionDigits: 6 })}`;
}

function formatMarketCap(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  return `$${(value / 1_000_000).toFixed(2)}M`;
}

export function MarketOverview() {
  const { data, loading, error } = useLiveMarket(SYMBOLS);
  const hasAny = useMemo(() => SYMBOLS.some((symbol) => Boolean(data[symbol])), [data]);

  return (
    <Section>
      <SectionHeader
        title="Live market"
        description="Reference prices used to value your holdings. Updates automatically."
      />
      <div className="card mt-4 overflow-hidden">
        <div className="hairline-b hidden grid-cols-12 gap-2 px-4 py-2.5 text-[10px] uppercase tracking-[0.14em] text-[#6B7280] sm:grid">
          <span className="col-span-5">Asset</span>
          <span className="col-span-3 text-right">Price</span>
          <span className="col-span-2 text-right">24H</span>
          <span className="col-span-2 text-right">Market cap</span>
        </div>
        <div>
          {SYMBOLS.map((symbol) => {
            const item = data[symbol];
            const meta = MARKET_META[symbol];
            const change = item?.change24h ?? 0;
            const isUp = change >= 0;
            const showSkeleton = loading && !hasAny;
            return (
              <div key={symbol} className="list-row px-4">
                <div className="grid w-full min-w-0 grid-cols-12 items-center gap-2">
                  <div className="col-span-6 flex min-w-0 items-center gap-3 sm:col-span-5">
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0F0F10]">
                      <img
                        src={meta.logo}
                        alt=""
                        className="h-5 w-5"
                        loading="lazy"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-[#F5F5F7]">
                        {meta.name}
                      </span>
                      <span className="block truncate text-[10px] text-[#6B7280]">{symbol}</span>
                    </span>
                  </div>
                  <div className="col-span-3 min-w-0 text-right">
                    {showSkeleton ? (
                      <SkeletonBlock className="ml-auto h-4 w-16" />
                    ) : (
                      <span className="financial-figure block truncate text-xs text-[#F5F5F7] sm:text-sm">
                        {item ? formatPrice(item.price) : "—"}
                      </span>
                    )}
                  </div>
                  <div className="col-span-3 min-w-0 text-right sm:col-span-2">
                    {showSkeleton ? (
                      <SkeletonBlock className="ml-auto h-4 w-12" />
                    ) : (
                      <span
                        className={`financial-figure block truncate text-xs ${
                          item ? (isUp ? "text-[#16C784]" : "text-[#EA3943]") : "text-[#6B7280]"
                        }`}
                      >
                        {item ? formatPercent(change, { signed: true }) : "—"}
                      </span>
                    )}
                  </div>
                  <div className="col-span-3 hidden min-w-0 text-right sm:col-span-2 sm:block">
                    {showSkeleton ? (
                      <SkeletonBlock className="ml-auto h-4 w-14" />
                    ) : (
                      <span className="financial-figure block truncate text-xs text-[#9CA3AF]">
                        {item ? formatMarketCap(item.marketCap) : "—"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {error && !hasAny ? (
        <p className="mt-2 text-[11px] text-[#EA3943]">
          Market prices are temporarily unavailable. Values refresh automatically.
        </p>
      ) : null}
    </Section>
  );
}
