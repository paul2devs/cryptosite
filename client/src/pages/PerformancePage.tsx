import { RefreshCw } from "lucide-react";
import { Seo } from "../components/Seo";
import { BalanceToggle } from "../components/BalanceVisibilityProvider";
import { Section, SectionHeader } from "../components/dashboard/primitives";
import { usePerformancePageData } from "../hooks/usePerformancePageData";
import { PerformanceMetricsGrid } from "../components/performance/PerformanceMetricsGrid";
import { PerformanceValueChart } from "../components/performance/PerformanceValueChart";
import { DailyPerformanceTable } from "../components/performance/DailyPerformanceTable";
import { DailyPerformanceDetailDrawer } from "../components/performance/DailyPerformanceDetail";

export function PerformancePage() {
  const {
    loading,
    rangeLoading,
    error,
    performance,
    range,
    setRange,
    refresh,
    detail,
    detailLoading,
    detailError,
    activeDate,
    openDay,
    closeDay
  } = usePerformancePageData("30d");

  return (
    <div className="page-responsive borderless-ui space-y-8 sm:space-y-10">
      <Seo
        title="Daily performance & ROI – verified investment reporting"
        description="Track verified daily profit and loss, time-weighted and money-weighted ROI, portfolio value over time and full daily performance history."
        path="/performance"
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="display-font text-2xl font-semibold tracking-tight text-[#F5F5F7] sm:text-3xl">
            Daily performance
          </h1>
          <p className="max-w-2xl text-sm text-[#9CA3AF]">
            Verified profit, loss and ROI derived from real position valuations and ledger cash
            flows. Nothing here is estimated or guaranteed.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading || rangeLoading}
            aria-label="Refresh performance"
            className="btn btn-sm btn-secondary"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading || rangeLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Refresh
          </button>
          <BalanceToggle />
        </div>
      </header>

      <PerformanceMetricsGrid
        metrics={performance?.metrics ?? null}
        methodology={performance?.methodology ?? null}
        loading={loading}
      />

      <PerformanceValueChart
        performance={performance}
        range={range}
        onRangeChange={setRange}
        loading={loading}
        busy={rangeLoading}
        error={error}
        onRetry={refresh}
      />

      <Section id="performance-history">
        <SectionHeader
          title="Daily performance history"
          description="Each row separates opening and closing valuations, external cash flows, realised and unrealised results, fees and the resulting net daily profit or loss. Select a day to inspect it."
        />
        <div className="mt-4">
          <DailyPerformanceTable
            rows={performance?.dailyHistory ?? []}
            loading={loading}
            error={error}
            onRetry={refresh}
            onSelect={openDay}
          />
        </div>
      </Section>

      <DailyPerformanceDetailDrawer
        date={activeDate}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDay}
      />
    </div>
  );
}
