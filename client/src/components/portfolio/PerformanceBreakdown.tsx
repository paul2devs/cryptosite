import {
  Section,
  SectionHeader,
  Panel,
  StatusBadge,
  SkeletonBlock,
  getToneText
} from "../dashboard/primitives";
import { useBalanceVisibility } from "../BalanceVisibilityProvider";
import { formatPercent, formatSignedUsd, formatUsd } from "../../utils/format";
import { maskValue, toneFromValue } from "./utils";
import type { PortfolioPerformanceView, PortfolioTotalsView } from "../../hooks/usePortfolioData";

function BreakdownRow({
  label,
  value,
  valueClassName = "text-[#F5F5F7]"
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-[#9CA3AF]">{label}</span>
      <span className={`financial-figure text-xs font-medium ${valueClassName}`}>{value}</span>
    </div>
  );
}

export function PerformanceBreakdown({
  totals,
  performance,
  loading
}: {
  totals: PortfolioTotalsView | null;
  performance: PortfolioPerformanceView | null;
  loading: boolean;
}) {
  const { hidden } = useBalanceVisibility();

  const realized = totals?.realizedEarnings ?? 0;
  const unrealized = totals?.unrealizedProfitLoss ?? null;
  const unrealizedRoi = totals?.unrealizedRoiPercent ?? null;
  const cumulativeStatus = performance?.cumulative.status ?? "unavailable";
  const unrealizedVerified = unrealized !== null && cumulativeStatus === "verified";

  return (
    <Section id="portfolio-performance-breakdown">
      <SectionHeader
        title="Performance breakdown"
        description="Realised results are settled to your ledger. Unrealised results reflect current position value minus cost basis."
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <Panel>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Realised</p>
            <StatusBadge tone="gold" label="Settled" />
          </div>
          {loading && !totals ? (
            <SkeletonBlock className="mt-3 h-8 w-36" />
          ) : (
            <p
              className={`financial-figure mt-2 text-2xl font-semibold tracking-tight ${getToneText(
                toneFromValue(realized)
              )}`}
            >
              {maskValue(hidden, formatSignedUsd(realized))}
            </p>
          )}
          <div className="mt-4 space-y-2.5">
            <BreakdownRow
              label="Available cash"
              value={maskValue(hidden, formatUsd(totals?.availableBalance ?? 0))}
            />
            <BreakdownRow label="Settlement" value="Posted to ledger" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
            Realised earnings are the only performance result that can be withdrawn.
          </p>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Unrealised</p>
            <StatusBadge
              tone={unrealizedVerified ? "positive" : "neutral"}
              label={unrealizedVerified ? "Verified" : "Unavailable"}
            />
          </div>
          {loading && !totals ? (
            <SkeletonBlock className="mt-3 h-8 w-36" />
          ) : (
            <p
              className={`financial-figure mt-2 text-2xl font-semibold tracking-tight ${
                unrealized === null ? "text-[#6B7280]" : getToneText(toneFromValue(unrealized))
              }`}
            >
              {unrealized === null ? "Unavailable" : maskValue(hidden, formatSignedUsd(unrealized))}
            </p>
          )}
          <div className="mt-4 space-y-2.5">
            <BreakdownRow
              label="Current position value"
              value={maskValue(hidden, formatUsd(totals?.totalValue ?? 0))}
            />
            <BreakdownRow
              label="Cost basis"
              value={maskValue(hidden, formatUsd(totals?.investedPrincipal ?? 0))}
            />
            <BreakdownRow
              label="Unrealised ROI"
              value={
                unrealizedRoi === null ? "Unavailable" : formatPercent(unrealizedRoi, { signed: true })
              }
              valueClassName={unrealizedRoi === null ? "text-[#6B7280]" : getToneText(toneFromValue(unrealizedRoi))}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
            {unrealizedVerified
              ? "Unrealised P/L equals current position value minus cost basis. It is an unsettled valuation and is not withdrawable until it is realised and settled to your ledger."
              : "A reliable cost basis is not available for your positions yet, so unrealised P/L stays unavailable until a verified valuation is published."}
          </p>
        </Panel>
      </div>
    </Section>
  );
}
