import { formatNumber, formatUsd, parseDecimalString } from "../../utils/format";
import type { RewardItemView, RewardRequirementProgress } from "../../utils/rewards";

export function formatRewardAmount(value: string, decimals = 2): string {
  const parsed = parseDecimalString(value);
  if (parsed === null) return "0";
  return formatNumber(parsed, decimals);
}

export function rewardAmountLabel(reward: Pick<RewardItemView, "amount" | "asset">): string {
  return `${formatRewardAmount(reward.amount)} ${reward.asset}`;
}

export function requirementProgressLabel(progress: RewardRequirementProgress): string {
  if (progress.type === "manual") {
    return "Manual, granted by the platform";
  }
  if (progress.unit === "count") {
    return `${progress.current} of ${progress.required} referred accounts`;
  }
  if (progress.unit === "tier") {
    return `${progress.currentLabel ?? "No tier yet"} → ${progress.requiredLabel ?? "Required tier"}`;
  }
  const current = formatNumber(parseDecimalString(progress.current) ?? 0, 2);
  const required = formatNumber(parseDecimalString(progress.required) ?? 0, 2);
  return `$${current} of $${required}`;
}

export function remainingLabel(progress: RewardRequirementProgress): string | null {
  if (progress.met || progress.type === "manual") return null;
  if (progress.unit === "count") {
    const remaining = parseDecimalString(progress.remaining ?? "0") ?? 0;
    return `${formatNumber(remaining, 0)} more referred account${remaining === 1 ? "" : "s"}`;
  }
  if (progress.unit === "amount") {
    const remaining = parseDecimalString(progress.remaining ?? "0") ?? 0;
    if (remaining <= 0) return null;
    return `${formatUsd(remaining)} to go`;
  }
  return null;
}
