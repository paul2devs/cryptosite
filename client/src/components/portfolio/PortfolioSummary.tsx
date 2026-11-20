import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import {
  Section,
  SectionHeader,
  Panel,
  SkeletonBlock,
  ErrorRow,
  StatStrip,
  getToneText,
  type Tone
} from "../dashboard/primitives";
import { BalanceToggle, useBalanceVisibility } from "../BalanceVisibilityProvider";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import { formatPercent, formatSignedUsd, formatUsd } from "../../utils/format";
import { maskValue, toneFromValue } from "./utils";
import type { PortfolioTotalsView } from "../../hooks/usePortfolioData";

function SummaryMetric({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
      <p className={`financial-figure truncate text-base font-medium ${getToneText(tone)}`}>{value}</p>
      {hint ? <p className="text-[10px] leading-relaxed text-[#9CA3AF]">{hint}</p> : null}
    </div>
  );
}

export function PortfolioSummary({
  totals,
  loading,
  error,
  onRetry
}: {
  totals: PortfolioTotalsView | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const { hidden } = useBalanceVisibility();
  const animatedTotal = useAnimatedNumber(totals?.totalValue ?? 0);

  const unrealized = totals?.unrealizedProfitLoss ?? null;
  const unrealizedRoi = totals?.unrealizedRoiPercent ?? null;
  const todayProfitLoss = totals?.todayProfitLoss ?? null;
  const todayRoi = totals?.todayRoiPercent ?? null;
  const overallReturn = totals?.overallReturnPercent ?? null;
  const periodReturn = totals?.periodReturnPercent ?? null;
  const hasLocked = (totals?.lockedBalance ?? 0) > 0;

  return (
    <Section id="portfolio-summary">
      <SectionHeader
        title="Portfolio value"
        description="Confirmed holdings, available balance and recorded profit or loss."
      />
      <Panel className="mt-4">
        {error && !totals ? (
          <ErrorRow message={error} onRetry={onRetry} />
        ) : (
          <>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                Total portfolio value
              </p>
              {loading && !totals ? (
                <SkeletonBlock className="mt-2 h-10 w-52" />
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="financial-figure text-3xl font-semibold tracking-tight text-[#F5F5F7] sm:text-4xl">
                    {maskValue(hidden, formatUsd(animatedTotal))}
                  </p>
                  <BalanceToggle />
                </div>
              )}
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                Confirmed holdings valued at live market rates.
              </p>
            </div>

            <div className="mt-5 border-t border-[#1F2023] pt-5">
              <StatStrip>
                <SummaryMetric
                  label="Invested principal"
                  value={maskValue(hidden, formatUsd(totals?.investedPrincipal ?? 0))}
                  hint="Confirmed deposit principal"
                />
                <SummaryMetric
                  label="Pending earnings"
                  value={maskValue(hidden, formatUsd(totals?.pendingEarnings ?? 0))}
                  hint="Accrued, not yet settled"
                />
                <SummaryMetric
                  label="Available cash"
                  value={maskValue(hidden, formatUsd(totals?.availableBalance ?? 0))}
                  hint={
                    hasLocked && totals
                      ? `${maskValue(hidden, formatUsd(totals.lockedBalance))} locked`
                      : "Withdrawable now"
                  }
                />
                <SummaryMetric
                  label="Unrealised P/L"
                  value={
                    unrealized === null
                      ? "Unavailable"
                      : maskValue(hidden, formatSignedUsd(unrealized))
                  }
                  hint={
                    unrealized === null
                      ? "Awaiting a verified valuation"
                      : unrealizedRoi === null
                        ? "Not withdrawable until settled"
                        : `${formatPercent(unrealizedRoi, { signed: true })} · not withdrawable`
                  }
                  tone={toneFromValue(unrealized)}
                />
              </StatStrip>
            </div>

            <div className="mt-5 border-t border-[#1F2023] pt-5">
              <StatStrip>
                <SummaryMetric
                  label="Today's P/L"
                  value={
                    todayProfitLoss === null
                      ? "Unavailable"
                      : maskValue(hidden, formatSignedUsd(todayProfitLoss))
                  }
                  hint="Verified daily performance"
                  tone={toneFromValue(todayProfitLoss)}
                />
                <SummaryMetric
                  label="Today's ROI"
                  value={
                    todayRoi === null ? "Unavailable" : formatPercent(todayRoi, { signed: true })
                  }
                  hint="Daily return on principal"
                  tone={toneFromValue(todayRoi)}
                />
                <SummaryMetric
                  label="Realised P/L"
                  value={maskValue(hidden, formatSignedUsd(totals?.realizedEarnings ?? 0))}
                  hint="Settled to your ledger"
                  tone={toneFromValue(totals?.realizedEarnings ?? 0)}
                />
                <SummaryMetric
                  label="Overall return"
                  value={
                    overallReturn === null
                      ? "Unavailable"
                      : formatPercent(overallReturn, { signed: true })
                  }
                  hint="Capital-weighted return"
                  tone={toneFromValue(overallReturn)}
                />
                <SummaryMetric
                  label="Period ROI"
                  value={
                    periodReturn === null
                      ? "Unavailable"
                      : formatPercent(periodReturn, { signed: true })
                  }
                  hint="Time-weighted for the selected range"
                  tone={toneFromValue(periodReturn)}
                />
              </StatStrip>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link
                to="/deposit"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#C6A15B] px-4 py-2 text-xs font-medium text-[#0F0F10] transition-colors hover:bg-[#B08F4F]"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
                Deposit
              </Link>
              <Link
                to="/withdraw"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#26272B] bg-[#17181A] px-4 py-2 text-xs font-medium text-[#F5F5F7] transition-colors hover:border-[#C6A15B]/60 hover:text-[#C6A15B]"
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden="true" />
                Withdraw
              </Link>
            </div>
          </>
        )}
      </Panel>
    </Section>
  );
}
