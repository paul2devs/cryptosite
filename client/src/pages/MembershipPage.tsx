import { RefreshCw } from "lucide-react";
import { Seo } from "../components/Seo";
import { EmptyState, ErrorRow, LoadingRow, Panel } from "../components/dashboard/primitives";
import { MembershipOverviewPanel } from "../components/membership/MembershipOverviewPanel";
import { TierProgression } from "../components/membership/TierProgression";
import { ProgressToNextTier } from "../components/membership/ProgressToNextTier";
import { BenefitsSection } from "../components/membership/BenefitsSection";
import { TierComparison } from "../components/membership/TierComparison";
import { MembershipHistoryPanel } from "../components/membership/MembershipHistoryPanel";
import { useMembershipData } from "../hooks/useMembershipData";

export function MembershipPage() {
  const { data, loading, error, reload, activatingBenefitId, activationError, activateBenefit } =
    useMembershipData();

  return (
    <div className="page-responsive space-y-6 pb-16">
      <Seo
        title="Membership"
        description="Your NexaCrypto membership tier, tier progression, benefits, tier comparison, and membership history based on confirmed, verified deposits."
        path="/membership"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">Growth</p>
          <h1 className="display-font text-2xl font-semibold text-[#F5F5F7]">Membership</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#9CA3AF]">
            Membership is derived from confirmed, verified deposits. It stays separate from your
            investment level, portfolio value, and daily performance.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#26272B] px-3 py-1.5 text-[11px] font-medium text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading && !data ? (
        <Panel>
          <LoadingRow label="Loading membership…" />
        </Panel>
      ) : error && !data ? (
        <Panel>
          <ErrorRow message={error} onRetry={reload} />
        </Panel>
      ) : !data ? (
        <Panel>
          <EmptyState
            title="Membership information is unavailable"
            description="We could not load your membership details. Try refreshing the page."
          />
        </Panel>
      ) : (
        <>
          <MembershipOverviewPanel data={data} />
          <ProgressToNextTier data={data} />
          <TierProgression data={data} />
          <BenefitsSection
            data={data}
            activatingBenefitId={activatingBenefitId}
            activationError={activationError}
            onActivate={(benefitId) => {
              void activateBenefit(benefitId);
            }}
            onRetry={reload}
          />
          <TierComparison data={data} />
          <MembershipHistoryPanel data={data} />
        </>
      )}
    </div>
  );
}
