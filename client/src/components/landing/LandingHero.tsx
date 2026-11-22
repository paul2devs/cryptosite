import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { scrollToLandingSection } from "./landingPrimitives";
import { Atmosphere, GlowOrb } from "./landingArtwork";
import { InvestmentDashboardPreview } from "./InvestmentDashboardPreview";

/**
 * Opening experience of the public landing page.
 *
 * The composition is deliberately asymmetrical and editorial: a wide left
 * column carrying the investment proposition and a dominant right column
 * presenting a public-safe preview of the real investment dashboard. Copy and
 * figures never promise a return. Every product fact below mirrors what the
 * platform actually implements (see components/landing/landingContent.ts).
 */

const EASE = [0.22, 1, 0.36, 1] as const;

function HeroReveal({
  children,
  delay = 0,
  y = 16,
  className = ""
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function LandingHero() {
  return (
    <section id="home" className="nx-hero relative scroll-mt-20 overflow-hidden">
      <Atmosphere variant="gold" />

      <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-20 pt-24 sm:px-8 sm:pb-24 sm:pt-32 lg:px-12 lg:pb-28 lg:pt-36">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,44fr)_minmax(0,56fr)] lg:gap-16">
          <div className="min-w-0">
            <HeroReveal>
              <p className="nx-eyebrow">Digital Asset Investment Platform</p>
            </HeroReveal>

            <HeroReveal delay={0.08}>
              <h1 className="display-font mt-6 text-[42px] font-medium leading-[1.04] tracking-[-0.02em] text-[#F5F5F7] sm:text-[56px] lg:text-[72px] xl:text-[78px]">
                Put your capital
                <br />
                to work with purpose.
              </h1>
            </HeroReveal>

            <HeroReveal delay={0.16}>
              <p className="mt-7 max-w-[34rem] text-[15px] leading-relaxed text-[#B4B7BF] sm:text-[17px]">
                NexaCrypto is a digital asset investment platform. Explore managed investment
                options built on your confirmed deposits, track your digital asset portfolio
                across ten investment levels, and follow current value, accrued earnings and
                membership progress from one place.
              </p>
            </HeroReveal>

            <HeroReveal delay={0.24}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link to="/register" className="nx-cta nx-cta-primary group">
                  Start investing
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
                <button
                  type="button"
                  onClick={() => scrollToLandingSection("membership")}
                  className="nx-cta nx-cta-secondary group"
                >
                  Explore investment levels
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </HeroReveal>

            <HeroReveal delay={0.32}>
              <p className="mt-7 text-[11px] leading-relaxed text-[#6B7280]">
                Verified deposits, tracked in one place.
              </p>
            </HeroReveal>
          </div>

          <div className="min-w-0">
            <HeroReveal delay={0.2} y={26}>
              <div className="relative mx-auto w-full max-w-[640px] lg:mx-0 lg:max-w-none">
                <GlowOrb
                  tone="gold"
                  className="-left-24 -top-20 h-80 w-80 opacity-40 lg:h-[26rem] lg:w-[26rem]"
                />
                <InvestmentDashboardPreview className="relative lg:-mr-16 xl:-mr-24" />
              </div>
            </HeroReveal>

          </div>
        </div>
      </div>
    </section>
  );
}
