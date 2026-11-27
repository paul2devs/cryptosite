import {
  Divider,
  Panel,
  SkeletonBlock,
  Stat,
  StatStrip,
  StatusBadge,
  type Tone
} from "../dashboard/primitives";
import { formatPercent, formatSignedUsd, formatUsd, parseDecimalString } from "../../utils/format";
import type { PerformanceMetrics, PerformanceMethodology } from "../../hooks/useDashboardData";

function toneFromValue(value: number | null): Tone {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function MetricSkeleton() {
  return (
    <div className="min-w-0 space-y-1 py-1">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="mt-3 h-5 w-20" />
    </div>
  );
}

export function PerformanceMetricsGrid({
  metrics,
  methodology,
  loading
}: {
  metrics: PerformanceMetrics | null;
  methodology: PerformanceMethodology | null;
  loading: boolean;
}) {
  if (loading && !metrics) {
    return (
      <Panel>
        <StatStrip>
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricSkeleton key={`loading-a-${index}`} />
          ))}
        </StatStrip>
        <Divider className="my-4" />
        <StatStrip>
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricSkeleton key={`loading-b-${index}`} />
          ))}
        </StatStrip>
      </Panel>
    );
  }

  const currentValue = parseDecimalString(metrics?.currentInvestmentValue ?? null);
  const principal = parseDecimalString(metrics?.investedPrincipal ?? null);
  const todayPl = parseDecimalString(metrics?.todayProfitLoss ?? null);
  const todayRoi = parseDecimalString(metrics?.todayRoiPercent ?? null);
  const realized = parseDecimalString(metrics?.totalRealizedProfitLoss ?? null);
  const unrealized = parseDecimalString(metrics?.totalUnrealizedProfitLoss ?? null);
  const overallRoi = parseDecimalString(metrics?.overallReturnPercent ?? null);
  const periodRoi = parseDecimalString(metrics?.periodReturnPercent ?? null);
  const periodPl = parseDecimalString(metrics?.periodProfitLoss ?? null);
  const valuationComplete = metrics?.valuationComplete ?? false;

  return (
    <Panel>
      <StatStrip>
        <Stat
          label="Current investment value"
          value={currentValue === null ? "Unavailable" : formatUsd(currentValue)}
          hint={valuationComplete ? "All positions valued" : "Includes unverified positions at cost"}
        />
        <Stat
          label="Invested principal"
          value={principal === null ? "Unavailable" : formatUsd(principal)}
          hint="Cost basis of active positions"
        />
        <Stat
          label="Today's profit / loss"
          value={todayPl === null ? "Unavailable" : formatSignedUsd(todayPl)}
          tone={todayPl === null ? "neutral" : toneFromValue(todayPl)}
          hint={
            metrics?.todayStatus === "verified" ? "Verified valuation" : "Awaiting verified valuation"
          }
        />
        <Stat
          label="Today's ROI"
          value={todayRoi === null ? "Unavailable" : formatPercent(todayRoi, { signed: true })}
          tone={todayRoi === null ? "neutral" : toneFromValue(todayRoi)}
          hint={metrics?.todayStatus === "verified" ? "Time-weighted, daily" : "Awaiting verified valuation"}
        />
      </StatStrip>

      <Divider className="my-4" />

      <StatStrip>
        <Stat
          label="Total realised P/L"
          value={realized === null ? "Unavailable" : formatSignedUsd(realized)}
          tone={realized === null ? "neutral" : toneFromValue(realized)}
          hint="Settled to the ledger"
        />
        <Stat
          label="Total unrealised P/L"
          value={unrealized === null ? "Unavailable" : formatSignedUsd(unrealized)}
          tone={unrealized === null ? "neutral" : toneFromValue(unrealized)}
          hint={
            unrealized === null
              ? "Awaiting a verified valuation"
              : unrealized > 0
                ? "Unrealised gain · not yet settled"
                : unrealized < 0
                  ? "Unrealised loss · not yet settled"
                  : "Unrealised · no movement"
          }
        />
        <Stat
          label="Overall return"
          value={overallRoi === null ? "Unavailable" : formatPercent(overallRoi, { signed: true })}
          tone={overallRoi === null ? "neutral" : toneFromValue(overallRoi)}
          hint="Capital-weighted (money-weighted)"
        />
        <Stat
          label="Selected period ROI"
          value={periodRoi === null ? "Unavailable" : formatPercent(periodRoi, { signed: true })}
          tone={periodRoi === null ? "neutral" : toneFromValue(periodRoi)}
          hint={
            periodPl === null ? "Awaiting verified data" : `${formatSignedUsd(periodPl)} P/L in period`
          }
        />
      </StatStrip>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StatusBadge tone="gold" label={`Methodology ${methodology?.version ?? "twr-mwr"}`} />
        <span className="max-w-2xl text-[11px] leading-relaxed text-[#9CA3AF]">
          
        </span>
      </div>
    </Panel>
  );
}
