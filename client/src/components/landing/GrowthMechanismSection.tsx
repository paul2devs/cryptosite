import { GROWTH_LAYERS } from "./landingContent";
import { LandingSection, Reveal } from "./landingPrimitives";

/**
 * SECTION C. Understand the growth mechanism.
 *
 * Explains how the platform separates principal, allocated capital, recorded
 * performance, promotional credits and withdrawable funds. Standing disclosures
 * live on the dedicated disclosures page rather than being repeated inline here.
 */
export function GrowthMechanismSection() {
  return (
    <LandingSection
      id="growth"
      eyebrow="Growth, explained"
      title="Know exactly what every number means."
      lede="Principal, allocated capital, recorded performance, promotional credits and withdrawable funds are tracked as separate values."
      className="landing-band-deep"
      headerClassName="max-w-2xl"
    >
      <div className="max-w-3xl">
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
      </div>
    </LandingSection>
  );
}
