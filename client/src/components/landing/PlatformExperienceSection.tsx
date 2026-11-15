import { ArrowDownLeft, ArrowUpRight, Minus } from "lucide-react";
import { PLATFORM_VIEWS, SUPPORTED_ASSETS } from "./landingContent";
import { LandingSection, Reveal, useLandingMarket } from "./landingPrimitives";
import { GlowOrb } from "./landingArtwork";
import { LivePrice } from "./LiveMarketPanel";

const ALLOCATION: Array<{ symbol: string; weight: number; color: string }> = [
  { symbol: "BTC", weight: 46, color: "#C6A15B" },
  { symbol: "ETH", weight: 27, color: "#6C93D6" },
  { symbol: "SOL", weight: 15, color: "#16C784" },
  { symbol: "USDT", weight: 12, color: "#2FB59A" }
];

const ACTIVITY: Array<{
  direction: "in" | "out";
  label: string;
  symbol: string;
  status: string;
  tone: "green" | "gold" | "muted";
}> = [
  { direction: "in", label: "Deposit", symbol: "BTC", status: "Credited", tone: "green" },
  { direction: "in", label: "Deposit", symbol: "ETH", status: "Verifying", tone: "gold" },
  { direction: "out", label: "Withdrawal", symbol: "USDT", status: "Processing", tone: "muted" },
  { direction: "in", label: "Deposit", symbol: "SOL", status: "Requested", tone: "muted" }
];

function InterfaceTag({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-full bg-white/[0.04] px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.1em] text-[#6B7280] ring-1 ring-inset ring-white/[0.06]">
      {label}
    </span>
  );
}

function statusTone(tone: string): string {
  if (tone === "green") return "bg-[#16C784]/12 text-[#16C784]";
  if (tone === "gold") return "bg-[#C6A15B]/12 text-[#C6A15B]";
  return "bg-white/[0.05] text-[#9CA3AF]";
}

/**
 * SECTION D — The platform experience.
 *
 * Three large interface screens composed as one layered, overlapping scene on
 * desktop (stacked on mobile) rather than a row of feature cards. Live prices
 * are real; allocation and transaction rows are explicitly labelled as
 * illustrative, and no performance figures are invented.
 */
export function PlatformExperienceSection() {
  const { data, loading } = useLandingMarket();
  const portfolioView = PLATFORM_VIEWS.find((view) => view.id === "portfolio");
  const performanceView = PLATFORM_VIEWS.find((view) => view.id === "performance");

  return (
    <LandingSection
      id="platform"
      eyebrow="The platform"
      title="An account built to be understood at a glance."
      lede="Prices, balances, transactions and progression live in one place — so you always know what you hold, what moved, and where you stand."
      headerClassName="max-w-2xl"
    >
      <div className="relative lg:min-h-[660px]">
        <GlowOrb tone="gold" className="-left-24 top-0 h-80 w-80 opacity-40" />
        <GlowOrb tone="emerald" className="-right-20 bottom-10 h-72 w-72 opacity-40" />

        {/* Primary screen — portfolio */}
        <Reveal className="relative lg:absolute lg:left-0 lg:top-0 lg:z-10 lg:w-[62%]">
          <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#9CA3AF]">Portfolio</p>
                {portfolioView ? (
                  <p className="display-font mt-1.5 text-[17px] font-medium tracking-tight text-[#F5F5F7]">
                    {portfolioView.title}
                  </p>
                ) : null}
              </div>
              <InterfaceTag label="Illustrative allocation" />
            </div>

            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">Allocation</p>
              <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-[#0F0F10]">
                {ALLOCATION.map((slice) => (
                  <span
                    key={slice.symbol}
                    style={{ width: `${slice.weight}%`, backgroundColor: slice.color }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                {ALLOCATION.map((slice) => (
                  <span
                    key={slice.symbol}
                    className="inline-flex items-center gap-1.5 text-[10px] text-[#9CA3AF]"
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    {slice.symbol}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              {SUPPORTED_ASSETS.map((asset) => (
                <div
                  key={asset.symbol}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-[#0F0F10]/45 px-3.5 py-3 ring-1 ring-inset ring-white/[0.04]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={asset.logo}
                      alt=""
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0 object-contain"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-[#F5F5F7]">{asset.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                        {asset.symbol}
                      </p>
                    </div>
                  </div>
                  <LivePrice
                    price={data[asset.symbol]?.price}
                    change24h={data[asset.symbol]?.change24h}
                    loading={loading}
                  />
                </div>
              ))}
            </div>

            <p className="mt-5 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-[#6B7280]">
              Prices above are live. Allocation is an illustrative layout — your own balances
              appear only inside your signed-in account.
            </p>
          </div>
        </Reveal>

        {/* Secondary screen — transactions, overlapping */}
        <Reveal
          delay={0.08}
          className="relative mt-6 lg:absolute lg:right-0 lg:top-[30%] lg:z-20 lg:mt-0 lg:w-[47%]"
        >
          <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#9CA3AF]">Transactions</p>
              <InterfaceTag label="Example rows" />
            </div>
            <div className="mt-5 space-y-2.5">
              {ACTIVITY.map((row) => (
                <div
                  key={`${row.label}-${row.symbol}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[#0F0F10]/45 px-3.5 py-3 ring-1 ring-inset ring-white/[0.04]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        row.direction === "in"
                          ? "bg-[#16C784]/12 text-[#16C784]"
                          : "bg-[#EA3943]/12 text-[#EA3943]"
                      }`}
                    >
                      {row.direction === "in" ? (
                        <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        {row.label} · {row.symbol}
                      </p>
                      <p className="text-[10px] text-[#6B7280]">Recorded on-chain</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] ${statusTone(
                      row.tone
                    )}`}
                  >
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-[#6B7280]">
              Example rows. Your real transaction history is only visible after you sign in.
            </p>
          </div>
        </Reveal>

        {/* Tertiary screen — performance, overlapping */}
        <Reveal
          delay={0.16}
          className="relative mt-6 lg:absolute lg:bottom-0 lg:left-[10%] lg:z-30 lg:mt-0 lg:w-[42%]"
        >
          <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#9CA3AF]">Performance</p>
              <InterfaceTag label="Illustrative layout" />
            </div>

            <div className="mt-5 flex h-24 items-center justify-center rounded-2xl bg-[#0F0F10]/45 ring-1 ring-inset ring-white/[0.04]">
              <div className="flex items-center gap-2 text-[11px] text-[#6B7280]">
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Verified performance appears here once your account records exist.</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#C6A15B]" />
                Deposited principal
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-[#9CA3AF]">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#16C784]" />
                Recorded performance
              </span>
            </div>

            {performanceView ? (
              <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-[#6B7280]">
                {performanceView.body}
              </p>
            ) : null}
          </div>
        </Reveal>
      </div>

      <Reveal delay={0.1}>
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-[#1B1C1F] sm:grid-cols-2 lg:grid-cols-4 lg:mt-24">
          {PLATFORM_VIEWS.map((view) => (
            <div key={view.id} className="bg-[#0F0F10] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#C6A15B]">{view.label}</p>
              <p className="display-font mt-2 text-[14px] font-medium tracking-tight text-[#F5F5F7]">
                {view.title}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF]">{view.body}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </LandingSection>
  );
}
