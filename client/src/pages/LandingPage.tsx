import { Seo } from "../components/Seo";
import { LandingHero } from "../components/landing/LandingHero";
import { OpportunitySection } from "../components/landing/OpportunitySection";
import { GrowthMechanismSection } from "../components/landing/GrowthMechanismSection";
import { PlatformExperienceSection } from "../components/landing/PlatformExperienceSection";
import { MembershipPreview } from "../components/landing/MembershipPreview";
import { AssetEcosystemSection } from "../components/landing/AssetEcosystemSection";
import { LandingFaq } from "../components/landing/LandingFaq";
import { FinalBrandStatement } from "../components/landing/FinalBrandStatement";

/**
 * Public landing page.
 *
 * The page is a thin composition layer over the narrative defined in the
 * creative brief: a cinematic hero, the opportunity, the growth mechanism, the
 * platform experience, membership and rewards, the asset ecosystem, the
 * detailed FAQ and a closing brand statement. Every product fact comes from
 * `components/landing/landingContent.ts`, so the marketing site stays aligned
 * with what the platform actually does. Live figures (market prices) come from
 * the shared live-market feed; nothing here fabricates balances, performance or
 * social proof.
 */
export function LandingPage() {
  return (
    <div className="landing-page page-responsive relative min-h-screen w-full bg-[#0F0F10]">
      <Seo
        title="Digital asset wealth, built on structure"
        description="NexaCrypto is a digital asset wealth platform. Deposit supported crypto into a structured account with membership progression, investment levels, redeemable rewards and performance you can inspect."
        path="/landing"
        keywords={[
          "nexacrypto",
          "digital asset platform",
          "crypto wealth platform",
          "custodial crypto platform",
          "bitcoin",
          "ethereum",
          "solana",
          "usdt",
          "membership tiers",
          "investment levels"
        ]}
      />
      <LandingHero />
      <OpportunitySection />
      <GrowthMechanismSection />
      <PlatformExperienceSection />
      <MembershipPreview />
      <AssetEcosystemSection />
      <LandingFaq />
      <FinalBrandStatement />
    </div>
  );
}
