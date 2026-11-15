import type { LiveMarketSnapshot } from "../../hooks/useLiveMarket";
import { SkeletonBlock } from "../dashboard/primitives";
import { SUPPORTED_ASSETS } from "./landingContent";
import { TrendIndicator } from "./landingArtwork";
import { changeTone, formatChange, formatLivePrice } from "./landingPrimitives";

function toneClass(tone: "up" | "down" | "flat"): string {
  if (tone === "up") return "text-[#16C784]";
  if (tone === "down") return "text-[#EA3943]";
  return "text-[#9CA3AF]";
}

/**
 * Compact live price for a single market point. Never invents a value: when the
 * feed has no data for the symbol it shows a muted dash instead of a number.
 */
export function LivePrice({
  price,
  change24h,
  loading,
  align = "right"
}: {
  price: number | undefined;
  change24h: number | undefined;
  loading: boolean;
  align?: "left" | "right";
}) {
  const alignment = align === "right" ? "text-right" : "text-left";

  if (loading && price === undefined) {
    return (
      <div className={alignment}>
        <SkeletonBlock className="ml-auto h-4 w-16" />
      </div>
    );
  }

  if (price === undefined) {
    return (
      <div className={`${alignment}`}>
        <p className="financial-figure text-sm font-medium text-[#6B7280]">-</p>
      </div>
    );
  }

  const tone = changeTone(change24h ?? 0);

  return (
    <div className={alignment}>
      <p className="financial-figure text-sm font-medium text-[#F5F5F7]">
        {formatLivePrice(price)}
      </p>
      <p className={`financial-figure text-[11px] ${toneClass(tone)}`}>
        {formatChange(change24h ?? 0)}
        <span className="ml-1 text-[#6B7280]">24h</span>
      </p>
    </div>
  );
}

/**
 * The live market panel used in the hero. It lists exactly the assets the
 * platform accepts deposits in and streams their current price, with a bar
 * whose length encodes the real magnitude of the 24h move.
 */
export function LiveMarketPanel({
  data,
  loading,
  error,
  className = ""
}: {
  data: LiveMarketSnapshot;
  loading: boolean;
  error: string | null;
  className?: string;
}) {
  return (
    <div className={`glass relative overflow-hidden rounded-3xl p-5 sm:p-6 ${className}`}>
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#9CA3AF]">Live market</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0F0F10]/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9CA3AF]">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${error ? "bg-[#6B7280]" : "bg-[#16C784] nx-pulse"}`}
          />
          {error ? "Paused" : "Streaming"}
        </span>
      </div>

      <div className="relative mt-3 space-y-3">
        {SUPPORTED_ASSETS.map((asset) => {
          const point = data[asset.symbol];
          return (
            <div
              key={asset.symbol}
              className="rounded-2xl bg-[#0F0F10]/45 px-3.5 py-3 ring-1 ring-inset ring-white/[0.04]"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={asset.logo}
                    alt=""
                    aria-hidden="true"
                    className="h-7 w-7 shrink-0 object-contain"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[#F5F5F7]">{asset.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                      {asset.symbol}
                    </p>
                  </div>
                </div>
                <LivePrice
                  price={point?.price}
                  change24h={point?.change24h}
                  loading={loading}
                />
              </div>
              <div className="mt-2.5">
                <TrendIndicator change={point?.change24h ?? 0} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="relative mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-[#6B7280]">
        {error
          ? "Live pricing is unavailable right now. Prices resume automatically when the feed reconnects."
          : "Prices refresh automatically from the platform's configured market data provider. Market data is informational and is not investment advice."}
      </p>
    </div>
  );
}
