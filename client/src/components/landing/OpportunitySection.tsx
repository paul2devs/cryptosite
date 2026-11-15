import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { OPPORTUNITY_PILLARS } from "./landingContent";
import { Eyebrow, LandingSection, Reveal } from "./landingPrimitives";
import { GlowOrb, NetworkGraphic } from "./landingArtwork";

/**
 * SECTION B — The Opportunity.
 *
 * The most important content section: it explains how the platform's parts fit
 * together as one system instead of listing features. Laid out as an editorial
 * rail plus large statement blocks separated by hairlines — deliberately not a
 * grid of feature cards.
 */
export function OpportunitySection() {
  return (
    <LandingSection
      id="opportunity"
      eyebrow="The opportunity"
      title="One deposit. Four parts of the platform working together."
      lede="NexaCrypto is not a single feature. Participation, progression, rewards and oversight depend on each other — and each one is built on records you can inspect."
      headerClassName="max-w-2xl"
    >
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <Reveal className="lg:sticky lg:top-24">
            <div className="relative">
              <GlowOrb tone="emerald" className="-left-20 top-4 h-56 w-56 opacity-40" />
              <NetworkGraphic className="pointer-events-none absolute -right-10 top-24 h-56 w-56 opacity-20" />
              <div className="relative">
                <Eyebrow>The system</Eyebrow>
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#9CA3AF]">
                  Each part builds on the one above it. Nothing here is a market promise — it is
                  how the platform is structured.
                </p>

                <div className="relative mt-8 pl-6">
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-[#C6A15B] via-[#C6A15B]/30 to-transparent"
                  />
                  <ul className="space-y-6">
                    {OPPORTUNITY_PILLARS.map((pillar) => (
                      <li key={pillar.index} className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute -left-6 top-1.5 h-2.5 w-2.5 rounded-full bg-[#C6A15B] shadow-[0_0_0_4px_rgba(198,161,91,0.14)]"
                        />
                        <p className="display-font text-[13px] font-medium tracking-tight text-[#F5F5F7]">
                          {pillar.label}
                        </p>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#6B7280]">
                          {pillar.index}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-8">
          {OPPORTUNITY_PILLARS.map((pillar, index) => (
            <Reveal key={pillar.index} delay={index * 0.04}>
              <div className="grid gap-y-3 border-b border-[#1F2023] py-8 first:pt-0 sm:grid-cols-[64px_1fr] sm:gap-x-8">
                <span className="display-font text-[13px] tracking-[0.2em] text-[#C6A15B]">
                  {pillar.index}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#6B7280]">
                    {pillar.label}
                  </p>
                  <h3 className="display-font mt-2 text-[22px] font-semibold leading-snug tracking-tight text-[#F5F5F7] sm:text-[26px]">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#9CA3AF]">
                    {pillar.detail}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}

          <Reveal delay={0.1}>
            <Link
              to="/register"
              className="mt-8 inline-flex items-center gap-1.5 text-xs font-medium text-[#C6A15B] transition-colors hover:text-[#D4B070]"
            >
              Open an account to see how the parts fit together
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </div>
    </LandingSection>
  );
}
