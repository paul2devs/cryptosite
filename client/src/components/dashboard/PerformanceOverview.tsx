import { Section, SectionHeader, SegmentedControl, EmptyState, ErrorRow, LoadingRow } from "./primitives";
import { PerformanceChart } from "./PerformanceChart";
import {
  parseDecimalString,
  formatPercent,
  formatSignedUsd,
  formatUsd
} from "../../utils/format";
import type { PerformanceRange, PerformanceView } from "../../hooks/useDashboardData";

const RANGE_OPTIONS: Array<{ value: PerformanceRange; label: string }> = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "ALL" }
];

function toneClass(value: number | null): string {
  if (value === null || value === 0) {
    return "text-[#F5F5F7]";
  }
  return value > 0 ? "text-[#16C784]" : "text-[#EA3943]";
}

function moneyCell(value: string | null | undefined): { text: string; className: string } {
  const parsed = parseDecimalString(value ?? null);
  if (parsed === null) {
    return { text: "Unavailable", className: "text-[#6B7280]" };
  }
  return { text: formatUsd(parsed), className: "text-[#F5F5F7]" };
}

function signedCell(value: string | null | undefined): { text: string; className: string } {
  const parsed = parseDecimalString(value ?? null);
  if (parsed === null) {
    return { text: "Unavailable", className: "text-[#6B7280]" };
  }
  return { text: formatSignedUsd(parsed), className: toneClass(parsed) };
}

function percentCell(value: string | null | undefined): { text: string; className: string } {
  const parsed = parseDecimalString(value ?? null);
  if (parsed === null) {
    return { text: "Unavailable", className: "text-[#6B7280]" };
  }
  return { text: formatPercent(parsed, { signed: true }), className: toneClass(parsed) };
}

function MetricCell({
  label,
  value,
  valueClassName = "text-[#F5F5F7]",
  hint
}: {
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
      <p className={`financial-figure truncate text-sm font-medium ${valueClassName}`}>{value}</p>
      {hint ? <p className="truncate text-[10px] text-[#6B7280]">{hint}</p> : null}
    </div>
  );
}

export function PerformanceOverview({
  performance,
  loading,
  error,
  range,
  onRangeChange,
  onRetry
}: {
  performance: PerformanceView | null;
  loading: boolean;
  error: string | null;
  range: PerformanceRange;
  onRangeChange: (range: PerformanceRange) => void;
  onRetry?: () => void;
}) {
  const metrics = performance?.metrics ?? null;

  const currentValue = moneyCell(metrics?.currentInvestmentValue);
  const principal = moneyCell(metrics?.investedPrincipal);
  const todayPl = signedCell(metrics?.todayProfitLoss);
  const todayRoi = percentCell(metrics?.todayRoiPercent);
  const realized = signedCell(metrics?.totalRealizedProfitLoss);
  const unrealized = signedCell(metrics?.totalUnrealizedProfitLoss);
  const unrealizedValue = parseDecimalString(metrics?.totalUnrealizedProfitLoss ?? null);
  // An unrealised result is a valuation movement, not settled cash. The status
  // says exactly that instead of implying the balance is simply "not
  // withdrawable" (which wrongly suggested it was already settled).
  const unrealizedStatus =
    unrealizedValue === null
      ? "Awaiting a verified valuation"
      : unrealizedValue > 0
        ? "Unrealised gain · not yet settled"
        : unrealizedValue < 0
          ? "Unrealised loss · not yet settled"
          : "Unrealised · no movement";
  const overall = percentCell(metrics?.overallReturnPercent);
  const periodRoi = percentCell(metrics?.periodReturnPercent);
  const periodPl = signedCell(metrics?.periodProfitLoss);

  const hasAnyVerified =
    metrics?.periodStatus === "verified" ||
    metrics?.todayStatus === "verified" ||
    parseDecimalString(metrics?.totalRealizedProfitLoss ?? null) !== null;

  return (
    <Section>
      <SectionHeader
        title="Performance"
        description="Verified results only. Investment value, invested principal, realised and unrealised results are reported separately. Nothing is estimated or simulated."
        action={
          <SegmentedControl
            ariaLabel="Performance range"
            options={RANGE_OPTIONS}
            value={range}
            onChange={onRangeChange}
          />
        }
      />

      <div className="card mt-4 px-4 py-5 sm:px-5">
        {loading && !performance ? (
          <LoadingRow label="Loading verified performance…" />
        ) : error && !performance ? (
          <ErrorRow message={error} onRetry={onRetry} />
        ) : (
          <>
            <div className="stat-strip">
              <MetricCell
                label="Current investment value"
                value={currentValue.text}
                valueClassName={currentValue.className}
                hint={metrics && !metrics.valuationComplete ? "Includes positions at cost" : undefined}
              />
              <MetricCell
                label="Invested principal"
                value={principal.text}
                valueClassName={principal.className}
              />
              <MetricCell
                label="Today's P/L"
                value={todayPl.text}
                valueClassName={todayPl.className}
              />
              <MetricCell
                label="Today's ROI"
                value={todayRoi.text}
                valueClassName={todayRoi.className}
              />
            </div>

            <div className="stat-strip mt-2 border-t border-[#1F2023] pt-2">
              <MetricCell
                label="Total realised P/L"
                value={realized.text}
                valueClassName={realized.className}
                hint="Settled to ledger"
              />
              <MetricCell
                label="Total unrealised P/L"
                value={unrealized.text}
                valueClassName={unrealized.className}
                hint={unrealizedStatus}
              />
              <MetricCell
                label="Overall return"
                value={overall.text}
                valueClassName={overall.className}
                hint="Capital-weighted"
              />
              <MetricCell
                label="Period ROI"
                value={periodRoi.text}
                valueClassName={periodRoi.className}
                hint={periodPl.text === "Unavailable" ? undefined : `${periodPl.text} P/L`}
              />
            </div>

            <div className="mt-5">
              <PerformanceChart
                history={performance?.history ?? []}
                loading={loading}
                range={range}
              />
            </div>

            {performance?.methodology ? (
              <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
                {performance.methodology.note}
              </p>
            ) : null}
            {performance?.note ? (
              <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">{performance.note}</p>
            ) : null}
            {!hasAnyVerified && !loading ? (
              <div className="mt-3">
                <EmptyState
                  title="No verified performance data for this range"
                  description="Performance is reported only from verified snapshots. Nothing is simulated."
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </Section>
  );
}
