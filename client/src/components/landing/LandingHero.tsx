import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { DISCLOSURES } from "../../constants/copy";
import { DEPOSIT_USD_MIN } from "./landingContent";
import {
  landingContainer,
  Reveal,
  scrollToLandingSection,
  useLandingMarket
} from "./landingPrimitives";
import { Atmosphere, GlowOrb, NetworkGraphic, TierEmblem } from "./landingArtwork";
import { LiveMarketPanel } from "./LiveMarketPanel";

const HERO_FACTS = [
  { label: "Supported assets", value: "BTC · ETH · SOL · USDT" },
  { label: "Membership from", value: `$${DEPOSIT_USD_MIN} confirmed deposits` },
  { label: "Deposits", value: "Verified on-chain" }
];

export function LandingHero() {
  const { data, loading, error } = useLandingMarket();

  return (
    <section id="home" className="relative scroll-mt-20 overflow-hidden">
      <Atmosphere variant="dual" />
      <div
        aria-hidden="true"
        className="aurora pointer-events-none absolute -top-1/3 left-1/2 h-[46rem] w-[46rem] -translate-x-1/2 opacity-60"
      />

      <div className={`${landingContainer} relative pb-20 pt-20 sm:pb-28 sm:pt-28 lg:pb-32 lg:pt-36`}>
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-1.5 ring-1 ring-inset ring-white/[0.07] backdrop-blur">
                <img src="/logo.png" alt="" className="h-4 w-4 rounded-full object-cover" />
                <span className="text-[11px] font-medium tracking-wide text-[#9CA3AF]">
                  NexaCrypto · Digital asset wealth platform
                </span>
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="display-font mt-7 text-[42px] font-semibold leading-[0.98] tracking-tight text-[#F5F5F7] sm:text-[62px] lg:text-[74px]">
                Digital asset wealth,
                <br />
                <span className="text-gradient-gold">built on structure.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-[#9CA3AF] sm:text-base">
                NexaCrypto turns supported crypto deposits into a structured account — membership
                progression, investment levels, trackable performance and redeemable rewards,
                managed in one place.
              </p>
            </Reveal>

            <Reveal delay={0.15}>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link to="/register" className="btn btn-primary btn-lg group">
                  Create your account
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToLandingSection("platform")}
                  className="btn btn-secondary btn-lg"
                >
                  Explore the platform
                </button>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <dl className="mt-14 grid grid-cols-1 gap-x-10 gap-y-5 border-t border-white/[0.07] pt-7 sm:grid-cols-3">
                {HERO_FACTS.map((fact) => (
                  <div key={fact.label} className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                      {fact.label}
                    </dt>
                    <dd className="financial-figure mt-1 text-[13px] font-medium text-[#F5F5F7]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <Reveal delay={0.15}>
              <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                <GlowOrb tone="gold" className="-left-20 top-2 h-72 w-72 opacity-70" />
                <GlowOrb tone="emerald" className="-right-14 bottom-0 h-64 w-64 opacity-60" />
                <NetworkGraphic
                  mode="draw"
                  className="pointer-events-none absolute -inset-14 h-[132%] w-[132%] opacity-40"
                />

                <div className="relative">
                  <LiveMarketPanel data={data} loading={loading} error={error} />

                  <div className="nx-float absolute -left-6 -top-7 hidden items-center gap-3 rounded-2xl px-4 py-3 glass sm:flex lg:-left-12">
                    <TierEmblem
                      emblemClass="emblem-gold"
                      label="G"
                      size={38}
                      active
                      textClass="text-[#0F0F10]"
                    />
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                        Membership
                      </p>
                      <p className="text-[11px] font-medium text-[#F5F5F7]">
                        Six tiers, Bronze to Private Client
                      </p>
                    </div>
                  </div>

                  <div
                    className="nx-float-soft absolute -bottom-7 right-0 hidden w-56 rounded-2xl p-4 glass sm:block lg:-right-10"
                    style={{ animationDelay: "1.4s" }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                      Investment levels
                    </p>
                    <p className="financial-figure mt-1.5 text-[13px] font-medium text-[#F5F5F7]">
                      Level 1 – 10
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#6B7280]">
                      A separate track that follows your invested principal.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.25}>
              <p className="mt-16 max-w-md text-[10px] leading-relaxed text-[#6B7280] sm:mt-12">
                {DISCLOSURES.custodial}
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
