import { RefreshCw } from "lucide-react";
import { Seo } from "../components/Seo";
import { usePortfolioData } from "../hooks/usePortfolioData";
import { PortfolioSummary } from "../components/portfolio/PortfolioSummary";
import { PerformanceBreakdown } from "../components/portfolio/PerformanceBreakdown";
import { PortfolioPerformanceChart } from "../components/portfolio/PortfolioPerformanceChart";
import { AssetHoldingsTable } from "../components/portfolio/AssetHoldingsTable";
import { AssetAllocation } from "../components/portfolio/AssetAllocation";
import { PortfolioHistory } from "../components/portfolio/PortfolioHistory";
import { PortfolioEmptyState } from "../components/portfolio/PortfolioEmptyState";

export function PortfolioPage() {
  const {
    loading,
    rangeLoading,
    error,
    overview,
    transactions,
    transactionsLoading,
    transactionsError,
    range,
    setRange,
    refresh
  } = usePortfolioData("30d");

  const busy = loading || rangeLoading;

  return (
    <div className="page-responsive borderless-ui space-y-8 sm:space-y-10">
      <Seo
        title="Portfolio – holdings, value and performance"
        description="Track your digital asset holdings, portfolio value, available balance, verified investment performance, asset allocation and full portfolio history."
        path="/portfolio"
        robots="noindex,nofollow"
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="display-font text-2xl font-semibold tracking-tight text-[#F5F5F7]">
            Portfolio
          </h1>
          <p className="max-w-2xl text-sm text-[#9CA3AF]">
            Track your holdings, portfolio value, and investment performance.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            aria-label="Refresh portfolio"
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {error && !overview ? (
        <PortfolioEmptyState
          title="We couldn't load your portfolio"
          description={error}
          action={
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center rounded-full bg-[#C6A15B] px-4 py-1.5 text-xs font-medium text-[#0F0F10]"
            >
              Try again
            </button>
          }
        />
      ) : (
        <>
          <PortfolioSummary
            totals={overview?.totals ?? null}
            loading={loading}
            error={error}
            onRetry={refresh}
          />

          <PerformanceBreakdown
            totals={overview?.totals ?? null}
            performance={overview?.performance ?? null}
            loading={loading}
          />

          <PortfolioPerformanceChart
            performance={overview?.performance ?? null}
            range={range}
            onRangeChange={setRange}
            loading={loading}
            busy={rangeLoading}
            error={error}
            onRetry={refresh}
          />

          <AssetHoldingsTable
            holdings={overview?.holdings ?? []}
            loading={loading}
            error={error}
            onRetry={refresh}
          />

          <AssetAllocation
            allocation={overview?.allocation ?? []}
            loading={loading}
            total={overview?.totals.totalValue ?? 0}
          />

          <PortfolioHistory
            transactions={transactions}
            performance={overview?.performance ?? null}
            loading={transactionsLoading}
            error={transactionsError}
            onRetry={refresh}
          />
        </>
      )}
    </div>
  );
}
