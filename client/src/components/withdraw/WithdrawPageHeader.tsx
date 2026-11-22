import { RefreshCw } from "lucide-react";
import {
  Panel,
  SectionHeader,
  StatusBadge,
  StatStrip,
  Stat,
  SkeletonBlock
} from "../dashboard/primitives";
import type { Tone } from "../dashboard/primitives";
import { BalanceToggle, useBalanceVisibility } from "../BalanceVisibilityProvider";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import { formatDateTime, formatUsd } from "../../utils/format";
import { formatDuration } from "../../utils/withdraw";
import { maskValue } from "../portfolio/utils";
import type { WithdrawalSummary } from "../../hooks/useWithdrawData";

interface EligibilityView {
  label: string;
  tone: Tone;
  detail: string;
}

function describeEligibility(summary: WithdrawalSummary): EligibilityView {
  const { eligibility, maturity } = summary;
  if (eligibility.canWithdraw) {
    return {
      label: "Available to withdraw",
      tone: "positive",
      detail: "All eligibility conditions are met. You can submit a withdrawal request."
    };
  }
  if (!eligibility.levelMet) {
    return {
      label: "Restricted",
      tone: "negative",
      detail: `Withdrawals unlock at deposit level ${summary.min_level}.`
    };
  }
  if (!eligibility.cooldownCleared) {
    return {
      label: "Cooldown active",
      tone: "gold",
      detail: "A withdrawal cooldown is currently active on your account."
    };
  }
  if (maturity.policyInEffect && maturity.maturingAmount > 0) {
    return {
      label: "Pending maturity",
      tone: "gold",
      detail: "Part of your balance is still within the disclosed maturity period."
    };
  }
  return {
    label: "No available balance",
    tone: "neutral",
    detail: "You do not have a withdrawable balance yet."
  };
}

export function WithdrawPageHeader({
  summary,
  loading,
  error,
  busy,
  onRefresh
}: {
  summary: WithdrawalSummary | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  onRefresh: () => void;
}) {
  const { hidden } = useBalanceVisibility();

  // Credited, settled funds that are eligible right now. This is the single
  // authoritative figure computed on the server (wallet cash net of any
  // maturity hold), so it can never disagree with the invested principal,
  // pending withdrawals or total account balance shown alongside it.
  const availableToWithdraw = summary?.available_to_withdraw ?? 0;
  const animatedAvailable = useAnimatedNumber(availableToWithdraw);
  const animatedTotal = useAnimatedNumber(summary?.total_account_balance ?? 0);

  const eligibility = summary ? describeEligibility(summary) : null;
  const lockupAmount = summary?.maturity.policyInEffect ? summary.maturity.maturingAmount : 0;
  const maturityPending = Boolean(summary?.maturity.policyInEffect && summary.maturity.maturingAmount > 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="display-font text-2xl font-semibold tracking-tight text-[#F5F5F7]">
            Withdraw Funds
          </h1>
          <p className="max-w-2xl text-sm text-[#9CA3AF]">
            Move your matured balance out of the platform. Every request is validated against your
            ledger, reviewed for security, and broadcast on-chain before it is marked complete.
          </p>
          {eligibility ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusBadge tone={eligibility.tone} label={eligibility.label} />
              <span className="text-[11px] text-[#9CA3AF]">{eligibility.detail}</span>
            </div>
          ) : loading ? (
            <SkeletonBlock className="h-4 w-52" />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Refresh withdrawal information"
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      <Panel>
        {error && !summary ? (
          <SectionHeader title="Withdrawal summary unavailable" description={error} />
        ) : (
          <div className="space-y-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                Available to withdraw
              </p>
              {loading && !summary ? (
                <SkeletonBlock className="mt-2 h-9 w-44" />
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="financial-figure text-3xl font-semibold tracking-tight text-[#16C784]">
                    {maskValue(hidden, formatUsd(animatedAvailable))}
                  </p>
                  <BalanceToggle />
                </div>
              )}
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                {summary
                  ? maturityPending
                    ? `Matured balance only · Total account balance ${maskValue(hidden, formatUsd(animatedTotal))}`
                    : `Total account balance ${maskValue(hidden, formatUsd(animatedTotal))}`
                  : "Read from the same authoritative ledger as your dashboard"}
              </p>
              {maturityPending && summary?.maturity.expectedMaturityDate ? (
                <p className="mt-1 text-[11px] text-[#C6A15B]">
                  Next maturity {formatDateTime(summary.maturity.expectedMaturityDate)} ·{" "}
                  {formatDuration(summary.maturity.remainingSeconds)} remaining
                </p>
              ) : null}
            </div>

            <StatStrip>
              <Stat
                label="Invested"
                value={maskValue(hidden, formatUsd(summary?.invested_balance ?? 0))}
                hint="Allocated principal"
              />
              <Stat
                label="Pending earnings"
                value={maskValue(hidden, formatUsd(summary?.pending_earnings_total ?? 0))}
                tone="gold"
                hint="Accrued, awaiting settlement"
              />
              <Stat
                label="Pending withdrawals"
                value={maskValue(hidden, formatUsd(summary?.pending_withdrawal_amount ?? 0))}
                hint="In-flight requests"
              />
              <Stat
                label="Under maturity"
                value={maskValue(hidden, formatUsd(lockupAmount))}
                tone="gold"
                hint={
                  summary?.maturity.policyInEffect
                    ? `Policy ${summary.maturity.policyVersion}`
                    : "No lockup policy"
                }
              />
              <Stat
                label="Locked"
                value={maskValue(hidden, formatUsd(summary?.locked_balance ?? 0))}
                hint="Not yet eligible"
              />
            </StatStrip>
          </div>
        )}
      </Panel>
    </div>
  );
}
