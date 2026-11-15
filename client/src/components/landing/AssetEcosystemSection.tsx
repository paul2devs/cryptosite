import { DISCLOSURES } from "../../constants/copy";
import { formatRelativeTime } from "../../utils/format";
import { SUPPORTED_ASSETS } from "./landingContent";
import {
  changeTone,
  Eyebrow,
  formatChange,
  formatLivePrice,
  landingContainer,
  Reveal,
  useLandingMarket
} from "./landingPrimitives";
import { Atmosphere, DimensionalCoin, TrendIndicator } from "./landingArtwork";

function toneClass(tone: "up" | "down" | "flat"): string {
  if (tone === "up") return "text-[#16C784]";
  if (tone === "down") return "text-[#EA3943]";
  return "text-[#9CA3AF]";
}

function LiveFigure({ loading, price }: { loading: boolean; price: number | undefined }) {
  if (loading && price === undefined) {
    return <span className="inline-block h-6 w-20 animate-pulse rounded bg-white/[0.05]" />;
  }
  if (price === undefined) {
    return <span className="financial-figure text-xl font-semibold text-[#6B7280]">—</span>;
  }
  return (
    <span className="financial-figure text-xl font-semibold text-[#F5F5F7]">
      {formatLivePrice(price)}
    </span>
  );
}

/**
 * SECTION F — The asset ecosystem.
 *
 * A cinematic presentation of the assets the platform actually accepts: an
 * elegant live ticker over a full-width editorial ledger of assets and their
 * networks. Deliberately not another asset-card grid, and no invented prices —
 * a symbol without a feed simply shows a dash.
 */
export function AssetEcosystemSection() {
  const { data, loading, error } = useLandingMarket();

  const newestUpdate = Object.values(data)
    .map((point) => point?.lastUpdated)
    .filter((value): value is string => Boolean(value))
    .sort()
    .pop();

  return (
    <section id="assets" className="relative scroll-mt-20 overflow-hidden border-t border-[#1B1C1F]">
      <Atmosphere variant="emerald" />

      <div className={`${landingContainer} relative py-16 sm:py-24`}>
        <Reveal className="max-w-2xl">
          <Eyebrow>The asset ecosystem</Eyebrow>
          <h2 className="display-font mt-3 text-[26px] font-semibold leading-[1.15] tracking-tight text-[#F5F5F7] sm:text-4xl">
            Four assets. Five networks. One account.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#9CA3AF] sm:text-[15px]">
            NexaCrypto accepts Bitcoin, Ethereum, Solana and Tether. The network your deposit can
            arrive on is stated up front, and every transfer is verified on-chain before it is
            credited to your account.
          </p>
        </Reveal>

        {/* Live ticker — an elegant horizontal rail, not a card row */}
        <Reveal delay={0.05}>
          <div className="edge-fade-x no-scrollbar mt-10 -mx-5 flex overflow-x-auto border-y border-[#1F2023] sm:mx-0 sm:rounded-2xl sm:border">
            {SUPPORTED_ASSETS.map((asset) => {
              const point = data[asset.symbol];
              const tone = changeTone(point?.change24h ?? 0);
              return (
                <div
                  key={asset.symbol}
                  className="flex min-w-[200px] flex-1 shrink-0 items-center gap-3 px-5 py-4 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-[#1F2023]"
                >
                  <DimensionalCoin symbol={asset.symbol} size={30} />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                      {asset.symbol}
                    </p>
                    {loading && point?.price === undefined ? (
                      <span className="mt-1 block h-4 w-16 animate-pulse rounded bg-white/[0.05]" />
                    ) : point?.price !== undefined ? (
                      <p className="financial-figure mt-0.5 text-[13px] font-medium text-[#F5F5F7]">
                        {formatLivePrice(point.price)}
                        <span className={`ml-2 text-[11px] ${toneClass(tone)}`}>
                          {formatChange(point.change24h)}
                        </span>
                      </p>
                    ) : (
                      <p className="financial-figure mt-0.5 text-[13px] font-medium text-[#6B7280]">
                        —
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>

        {/* Full-width editorial ledger */}
        <div className="mt-14 border-t border-[#1F2023]">
          {SUPPORTED_ASSETS.map((asset, index) => {
            const point = data[asset.symbol];
            const tone = changeTone(point?.change24h ?? 0);
            return (
              <Reveal key={asset.symbol} delay={index * 0.04}>
                <div className="grid grid-cols-1 gap-6 border-b border-[#1F2023] py-8 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-8">
                  <DimensionalCoin symbol={asset.symbol} size={62} />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="display-font text-[24px] font-semibold tracking-tight text-[#F5F5F7] sm:text-[30px]">
                        {asset.name}
                      </h3>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                        {asset.symbol}
                      </span>
                    </div>
                    <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#9CA3AF]">
                      {asset.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {asset.networks.map((network) => (
                        <span
                          key={network}
                          className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[10px] text-[#9CA3AF] ring-1 ring-inset ring-white/[0.06]"
                        >
                          {network}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 sm:w-44 sm:text-right">
                    <LiveFigure loading={loading} price={point?.price} />
                    <p className={`financial-figure mt-1 text-[11px] ${toneClass(tone)}`}>
                      {formatChange(point?.change24h ?? 0)}
                      <span className="ml-1 text-[#6B7280]">24h</span>
                    </p>
                    <div className="mt-3 sm:ml-auto sm:w-28">
                      <TrendIndicator change={point?.change24h ?? 0} />
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-6 text-[10px] leading-relaxed text-[#6B7280]">
            {newestUpdate
              ? `Market prices last updated ${formatRelativeTime(newestUpdate)}. `
              : "Market prices update automatically when the feed is available. "}
            {error ? "Live pricing is temporarily unavailable. " : ""}
            {DISCLOSURES.wrongNetworkRisk}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
