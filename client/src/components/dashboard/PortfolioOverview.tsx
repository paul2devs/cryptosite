import { useMemo } from "react";
import { Section, SectionHeader, StatusBadge, ErrorRow, SkeletonBlock, StatStrip } from "./primitives";
import { BalanceToggle, useBalanceVisibility } from "../BalanceVisibilityProvider";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import { formatNumber, formatUsd } from "../../utils/format";
import type { PortfolioSummaryResponse, ProgressionResponse } from "../../hooks/useDashboardData";

function Sparkline({ values }: { values: number[] }) {
  const path = useMemo(() => {
    if (values.length < 2) {
      return null;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 100;
    const height = 32;
    const step = width / (values.length - 1);
    const points = values.map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return {
      line: points.join(" "),
      area: `0,${height} ${points.join(" ")} ${width},${height}`
    };
  }, [values]);

  if (!path) {
    return null;
  }

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-8 w-full"
      role="img"
      aria-label="Thirty day portfolio trend"
    >
      <polygon points={path.area} fill="rgba(198,161,91,0.12)" />
      <polyline
        points={path.line}
        fill="none"
        stroke="#C6A15B"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatBlock({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
      <p className="financial-figure truncate text-sm font-medium text-[#F5F5F7]">{value}</p>
      {hint ? <p className="truncate text-[10px] text-[#9CA3AF]">{hint}</p> : null}
    </div>
  );
}

export function PortfolioOverview({
  portfolio,
  progression,
  loading,
  error,
  onRetry
}: {
  portfolio: PortfolioSummaryResponse | null;
  progression: ProgressionResponse | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const { hidden, mask } = useBalanceVisibility();
  const totalValue = portfolio?.totalCurrentValue ?? 0;
  const animatedValue = useAnimatedNumber(totalValue);

  const growthValues = useMemo(
    () => (portfolio?.growthSeries ?? []).map((point) => point.value),
    [portfolio]
  );

  const approvedDeposits = progression?.totalDepositedUsd ?? 0;
  const pendingEarnings = portfolio?.pendingEarnings ?? 0;
  const withdrawable = progression?.withdrawableBalance ?? 0;
  const locked = progression?.lockedBalance ?? 0;

  return (
    <Section>
      <SectionHeader
        title="Portfolio"
        description="Investment principal"
        action={<StatusBadge tone="gold" label="Principal" />}
      />
      <div className="card mt-4 px-4 py-5 sm:px-6 sm:py-6">
        {error && !portfolio ? (
          <ErrorRow message={error} onRetry={onRetry} />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                  Total portfolio value
                </p>
                {loading && !portfolio ? (
                  <SkeletonBlock className="mt-2 h-9 w-48" />
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <p className="financial-figure text-3xl font-semibold tracking-tight text-[#F5F5F7] sm:text-4xl">
                      {hidden ? "••••••" : formatUsd(animatedValue)}
                    </p>
                    <BalanceToggle />
                  </div>
                )}
              </div>
              {growthValues.length >= 2 ? (
                <div className="w-full sm:w-48">
                  <Sparkline values={growthValues} />
                  <p className="mt-1 text-right text-[10px] text-[#6B7280]">Last 30 days</p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 border-t border-[#1F2023] pt-5">
              <StatStrip>
                <StatBlock
                  label="Approved deposits"
                  value={mask(formatUsd(approvedDeposits))}
                  hint="Verified and confirmed"
                />
                <StatBlock
                  label="Pending earnings"
                  value={mask(formatNumber(pendingEarnings, 4))}
                  hint="Accrued, awaiting settlement"
                />
                <StatBlock
                  label="Withdrawable"
                  value={mask(formatNumber(withdrawable, 4))}
                  hint="Available to request"
                />
                <StatBlock
                  label="Locked"
                  value={mask(formatNumber(locked, 4))}
                  hint="Clears on schedule"
                />
              </StatStrip>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
