import { DISCLOSURES } from "../../constants/copy";
import { GROWTH_LAYERS } from "./landingContent";
import { LandingSection, Reveal } from "./landingPrimitives";

const NOT_CLAIMED = [
  "No guaranteed returns, and no fixed income.",
  "Promotional credits are never presented as trading profit.",
  "Unrealised market value is not withdrawable cash.",
  "No audit, insurance or regulatory status we cannot evidence.",
  "No published performance figures unless they are verified."
];

/**
 * SECTION C — Understand the growth mechanism.
 *
 * Explains how the platform separates principal, allocated capital, recorded
 * performance, promotional credits and withdrawable funds. It deliberately
 * publishes no performance numbers, because none can be verified here — and
 * states that openly rather than inventing a chart.
 */
export function GrowthMechanismSection() {
  return (
    <LandingSection
      id="growth"
      eyebrow="Growth, explained"
      title="Know exactly what every number means."
      lede="Principal, allocated capital, recorded performance, promotional credits and withdrawable funds are tracked as separate values — so a deposit is never mistaken for a gain, and a credit is never mistaken for a return."
      className="landing-band-deep"
      headerClassName="max-w-2xl"
    >
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          {GROWTH_LAYERS.map((layer, index) => (
            <Reveal key={layer.label} delay={index * 0.04}>
              <div className="grid gap-y-2 border-b border-[#1F2023] py-6 first:pt-0 sm:grid-cols-[1fr_auto] sm:gap-x-10">
                <div className="min-w-0">
                  <h3 className="display-font text-[16px] font-medium tracking-tight text-[#F5F5F7]">
                    {layer.label}
                  </h3>
                  <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-[#9CA3AF]">
                    {layer.detail}
                  </p>
                </div>
                <p className="financial-figure text-[11px] uppercase tracking-[0.14em] text-[#C6A15B] sm:pt-1.5 sm:text-right">
                  {layer.value}
                </p>
              </div>
            </Reveal>
          ))}

          <Reveal delay={0.1}>
            <p className="mt-6 text-[10px] leading-relaxed text-[#6B7280]">
              {DISCLOSURES.illustrativeProjectionOnly}
            </p>
          </Reveal>
        </div>

        <div className="lg:col-span-5">
          <Reveal className="lg:sticky lg:top-24">
            <div className="card p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                What we will not claim
              </p>
              <ul className="mt-4 space-y-3">
                {NOT_CLAIMED.map((item) => (
                  <li key={item} className="flex gap-3 text-xs leading-relaxed text-[#9CA3AF]">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#C6A15B]"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-[#1F2023] pt-4 text-[10px] leading-relaxed text-[#6B7280]">
                {DISCLOSURES.noGuarantee}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </LandingSection>
  );
}
