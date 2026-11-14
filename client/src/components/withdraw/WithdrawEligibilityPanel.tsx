import { Panel, SectionHeader, StatusBadge, ProgressBar, SkeletonBlock } from "../dashboard/primitives";
import { SolidCheck } from "../icons/SolidIcons";
import { formatDuration } from "../../utils/withdraw";
import { formatUsd } from "../../utils/format";
import type { WithdrawalSummary } from "../../hooks/useWithdrawData";

interface ConditionRow {
  id: string;
  met: boolean;
  label: string;
  detail: string;
}

export function WithdrawEligibilityPanel({
  summary,
  loading
}: {
  summary: WithdrawalSummary | null;
  loading: boolean;
}) {
  if (loading && !summary) {
    return (
      <Panel className="space-y-4">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-12 w-full rounded-xl" />
        <SkeletonBlock className="h-12 w-full rounded-xl" />
        <SkeletonBlock className="h-12 w-full rounded-xl" />
      </Panel>
    );
  }

  if (!summary) {
    return null;
  }

  const { eligibility, cooldown_seconds_remaining: cooldownSeconds } = summary;
  const matured = summary.maturity.policyInEffect
    ? summary.maturity.maturedAmount
    : summary.withdrawable_balance;

  const conditions: ConditionRow[] = [
    {
      id: "level",
      met: eligibility.levelMet,
      label: `Deposit level ${summary.min_level} or higher`,
      detail: eligibility.levelMet
        ? `You are at level ${summary.user_level}.`
        : `Your current level is ${summary.user_level} of ${summary.min_level}.`
    },
    {
      id: "balance",
      met: eligibility.balanceAvailable,
      label: "Matured balance available",
      detail: eligibility.balanceAvailable
        ? `${formatUsd(matured)} has matured and is available.`
        : "No matured balance is currently available to withdraw."
    },
    {
      id: "cooldown",
      met: eligibility.cooldownCleared,
      label: "Withdrawal cooldown cleared",
      detail: eligibility.cooldownCleared
        ? "No cooldown is active on your account."
        : `Next request available in ${formatDuration(cooldownSeconds)}.`
    }
  ];

  const progressPercent = (() => {
    if (summary.min_level <= 0) {
      return 100;
    }
    return Math.min(100, Math.round((summary.user_level / summary.min_level) * 100));
  })();

  return (
    <Panel className="space-y-4">
      <SectionHeader
        eyebrow="Eligibility"
        title="Withdrawal eligibility"
        description="Evaluated on the server from your account record and re-applied when you submit."
        action={
          <StatusBadge
            tone={eligibility.canWithdraw ? "positive" : "gold"}
            label={eligibility.canWithdraw ? "Eligible" : "Restricted"}
          />
        }
      />

      <ul className="space-y-2">
        {conditions.map((condition) => (
          <li
            key={condition.id}
            className="flex items-start gap-2.5 rounded-xl bg-[#0F0F10] px-3 py-2.5"
          >
            {condition.met ? (
              <SolidCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16C784]" />
            ) : (
              <span
                className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full bg-[#26272B] ring-1 ring-inset ring-[#3A3B3F]"
                aria-hidden="true"
              />
            )}
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-medium text-[#F5F5F7]">{condition.label}</p>
              <p className="text-[11px] text-[#9CA3AF]">{condition.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
          <span>Progress to level {summary.min_level}</span>
          <span className="financial-figure">
            {summary.user_level} / {summary.min_level}
          </span>
        </div>
        <ProgressBar value={progressPercent} tone={eligibility.levelMet ? "positive" : "gold"} />
      </div>

      {!eligibility.canWithdraw && eligibility.reasons.length > 0 ? (
        <ul className="space-y-1 rounded-xl bg-[#C6A15B]/8 px-3 py-3">
          {eligibility.reasons.map((reason) => (
            <li key={reason} className="text-[11px] leading-relaxed text-[#F5F5F7]">
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
