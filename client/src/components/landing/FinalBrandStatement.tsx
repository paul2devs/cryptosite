import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { DISCLOSURES } from "../../constants/copy";
import { Eyebrow, landingContainer, Reveal } from "./landingPrimitives";
import { Atmosphere, GlowOrb, NetworkGraphic } from "./landingArtwork";

/**
 * SECTION G. Final brand statement.
 *
 * The closing moment of the narrative: short, confident, and free of fake
 * urgency, countdowns or financial promises. It sets a single obvious next
 * step and echoes the opening headline rather than restating features.
 */
export function FinalBrandStatement() {
  return (
    <section className="relative scroll-mt-20 overflow-hidden border-t border-[#1B1C1F]">
      <Atmosphere variant="dual" />
      <GlowOrb tone="gold" className="left-1/2 top-0 h-80 w-80 -translate-x-1/2 opacity-50" />
      <NetworkGraphic
        mode="draw"
        className="pointer-events-none absolute -right-24 top-8 hidden h-[26rem] w-[26rem] opacity-20 lg:block"
      />

      <div className={`${landingContainer} relative py-24 sm:py-32 lg:py-36`}>
        <Reveal className="max-w-3xl">
          <Eyebrow>Your next move</Eyebrow>
          <h2 className="display-font mt-5 text-[34px] font-semibold leading-[1.02] tracking-tight text-[#F5F5F7] sm:text-[52px] lg:text-[62px]">
            The structure is ready.
            <br />
            <span className="text-gradient-gold">The next chapter is yours.</span>
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[#9CA3AF] sm:text-base">
            Open an account and move supported crypto into a platform built around clarity:
            membership progression, investment levels, redeemable rewards and performance you can
            actually inspect.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/register" className="btn btn-primary btn-lg group">
              Create your account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/login" className="btn btn-secondary btn-lg">
              Sign in
            </Link>
          </div>
          <p className="mt-8 max-w-xl text-[10px] leading-relaxed text-[#6B7280]">
            {DISCLOSURES.noGuarantee}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
