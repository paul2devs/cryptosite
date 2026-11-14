import { RefreshCw } from "lucide-react";
import { Seo } from "../components/Seo";
import { EmptyState, ErrorRow, LoadingRow, Panel } from "../components/dashboard/primitives";
import { InvestmentLevelOverviewPanel } from "../components/investment/InvestmentLevelOverviewPanel";
import { ProgressToNextLevel } from "../components/investment/ProgressToNextLevel";
import { LevelProgression } from "../components/investment/LevelProgression";
import { LevelBenefitsSection } from "../components/investment/LevelBenefitsSection";
import { LevelComparison } from "../components/investment/LevelComparison";
import { InvestmentLevelHistoryPanel } from "../components/investment/InvestmentLevelHistoryPanel";
import { useInvestmentLevelData } from "../hooks/useInvestmentLevelData";

export function InvestmentLevelsPage() {
  const { data, loading, error, reload, activatingBenefitId, activationError, activateBenefit } =
    useInvestmentLevelData();

  return (
    <div className="page-responsive space-y-6 pb-16">
      <Seo
        title="Investment Levels"
        description="Your NexaCrypto investment level, progression, requirements, benefits, level comparison, and investment level history based on approved, verified invested principal."
        path="/investment-levels"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">Growth</p>
          <h1 className="display-font text-2xl font-semibold text-[#F5F5F7]">Investment Levels</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#9CA3AF]">
            Investment level advances as your approved, verified invested principal grows. It stays
            separate from your membership tier, portfolio value, and daily performance.
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
          <LoadingRow label="Loading investment level…" />
        </Panel>
      ) : error && !data ? (
        <Panel>
          <ErrorRow message={error} onRetry={reload} />
        </Panel>
      ) : !data ? (
        <Panel>
          <EmptyState
            title="Investment level information is unavailable"
            description="We could not load your investment level details. Try refreshing the page."
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <InvestmentLevelOverviewPanel data={data} />
            <ProgressToNextLevel data={data} />
          </div>

          <LevelProgression data={data} />

          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <LevelBenefitsSection
              data={data}
              activatingBenefitId={activatingBenefitId}
              activationError={activationError}
              onActivate={(benefitId) => {
                void activateBenefit(benefitId);
              }}
              onRetry={reload}
            />
            <InvestmentLevelHistoryPanel data={data} />
          </div>

          <LevelComparison data={data} />
        </>
      )}
    </div>
  );
}
