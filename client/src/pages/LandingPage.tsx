import { Seo } from "../components/Seo";
import { LandingHero } from "../components/landing/LandingHero";
import { InvestmentPlansSection } from "../components/landing/InvestmentPlansSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
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
 * creative brief: a cinematic hero, the investment opportunities it offers,
 * the investment process, the opportunity, the growth mechanism, the platform
 * experience, membership and rewards, the asset ecosystem, the detailed FAQ
 * and a closing brand statement. Every product fact comes from
 * `components/landing/landingContent.ts`, so the marketing site stays aligned
 * with what the platform actually does. Live figures (market prices) come from
 * the shared live-market feed; nothing here fabricates balances, performance or
 * social proof.
 */
export function LandingPage() {
  return (
    <div className="landing-page page-responsive relative min-h-screen w-full bg-[#0F0F10]">
      <Seo
        title="Digital Asset Investment Platform"
        description="NexaCrypto is a digital asset investment platform designed to help users manage their digital asset portfolios, explore investment opportunities and monitor their account activity."
        path="/landing"
        keywords={[
          "nexacrypto",
          "digital asset investment platform",
          "digital asset portfolio",
          "portfolio management",
          "investment management",
          "digital asset wallet",
          "account security",
          "investment performance"
        ]}
      />
      <LandingHero />
      <InvestmentPlansSection />
      <HowItWorksSection />
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
