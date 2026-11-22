import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { TERMINOLOGY } from "../../constants/copy";
import { INVESTMENT_LEVEL_FACTS, MEMBERSHIP_TIERS } from "./landingContent";
import { LandingSection, Reveal } from "./landingPrimitives";
import { GlowOrb, TierEmblem } from "./landingArtwork";

/**
 * Tier initials sit on faceted metal plates, so each tier needs a text tone
 * that stays legible against its own metal. Mirrors the emblem finishes
 * defined in the global stylesheet.
 */
const EMBLEM_TEXT: Record<string, string> = {
  "emblem-bronze": "text-white/90",
  "emblem-silver": "text-[#0F0F10]",
  "emblem-gold": "text-[#0F0F10]",
  "emblem-platinum": "text-[#0F0F10]",
  "emblem-diamond": "text-white/90",
  "emblem-private": "text-white/90"
};

export function MembershipPreview() {
  return (
    <LandingSection
      id="membership"
      eyebrow="Rewards & membership"
      title="Progress that follows what you deposit."
      lede="Your tier is set by the USD value of your confirmed deposits, and your progress to the next tier is always visible in your account."
      className="landing-band-gold"
    >
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="relative lg:col-span-6">
          <GlowOrb tone="gold" className="-left-24 top-6 h-64 w-64 opacity-50" />
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute bottom-8 left-[26px] top-8 w-px bg-gradient-to-b from-[#C6A15B]/50 via-white/[0.08] to-transparent"
            />
            <div className="space-y-1">
              {MEMBERSHIP_TIERS.map((tier, index) => (
                <Reveal key={tier.name} delay={index * 0.04}>
                  <div className="flex items-start gap-4 py-3">
                    <TierEmblem
                      emblemClass={tier.emblemClass}
                      label={tier.name.charAt(0)}
                      textClass={EMBLEM_TEXT[tier.emblemClass] ?? "text-white/90"}
                      size={54}
                    />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="display-font text-[15px] font-medium tracking-tight text-[#F5F5F7]">
                          {tier.name}
                        </p>
                        <p className="financial-figure text-[11px] text-[#C6A15B]">
                          {tier.thresholdLabel}
                        </p>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#9CA3AF]">{tier.summary}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-6">
          <Reveal>
            <div className="glass-quiet relative overflow-hidden rounded-3xl p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                Investment levels
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                Separate from membership, investment levels track invested principal across ten
                stages.
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
                {INVESTMENT_LEVEL_FACTS.map((fact) => (
                  <div key={fact.label} className="min-w-0">
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                      {fact.label}
                    </dt>
                    <dd className="financial-figure mt-1 text-[13px] font-medium text-[#F5F5F7]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="glass-quiet relative overflow-hidden rounded-3xl p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">Rewards</p>
              <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                Promotional and referral rewards are earned under their published conditions,
                credited to your rewards balance when they qualify, and redeemed into your account
                balance on request.
              </p>
              <p className="mt-4 rounded-xl bg-[#0F0F10]/60 px-3 py-2.5 text-[11px] leading-relaxed text-[#9CA3AF] ring-1 ring-inset ring-white/[0.05]">
                {TERMINOLOGY.promotionalBonus}s are promotional credits you can redeem into your
                account balance.
              </p>
              <Link
                to="/register"
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-[#C6A15B] transition-colors hover:text-[#D4B070]"
              >
                Create an account to see your rewards
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </LandingSection>
  );
}
