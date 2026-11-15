import { formatDecimal, parseDecimal } from "./money";

export type RewardCategory = "loyalty" | "promotional" | "referral" | "special";

export type RewardRequirementType =
  | "manual"
  | "deposit_total"
  | "invest_total"
  | "membership_tier"
  | "referral_count";

export type RewardStatus = "available" | "pending" | "redeemed" | "expired" | "revoked";

export type RewardRequirementUnit = "amount" | "count" | "tier";

export const REWARD_CATEGORIES: RewardCategory[] = ["loyalty", "promotional", "referral", "special"];

export const REWARD_CATEGORY_LABEL: Record<RewardCategory, string> = {
  loyalty: "Loyalty",
  promotional: "Promotional",
  referral: "Referral",
  special: "Special"
};

export const REWARD_CATEGORY_DESCRIPTION: Record<RewardCategory, string> = {
  loyalty: "Earned progressively from your verified activity on the platform.",
  promotional: "Issued by the platform for a specific campaign.",
  referral: "Earned from the accounts that joined with your referral code.",
  special: "Granted for exceptional account milestones and reviewed individually."
};

export const REWARD_REQUIREMENT_LABEL: Record<RewardRequirementType, string> = {
  manual: "Issued by the platform",
  deposit_total: "Confirmed, verified deposits",
  invest_total: "Verified invested principal",
  membership_tier: "Membership tier",
  referral_count: "Referred accounts"
};

export const REWARD_REQUIREMENT_UNIT: Record<RewardRequirementType, RewardRequirementUnit> = {
  manual: "amount",
  deposit_total: "amount",
  invest_total: "amount",
  membership_tier: "tier",
  referral_count: "count"
};

export const REWARD_AMOUNT_SCALE = 8;
export const ZERO_REWARD = "0.00000000";
export const ZERO_REQUIREMENT = "0.00000000";

export const REWARD_GRANT_TRANSACTION_TYPE = "reward_granted";
export const REWARD_REDEMPTION_TRANSACTION_TYPE = "reward_redeemed";
export const REWARD_GRANT_SOURCE_TYPE = "reward";
export const REWARD_REDEMPTION_SOURCE_TYPE = "redeem";
export const REWARD_REVERSAL_SOURCE_TYPE = "reward_reversal";
export const REWARD_REVERSAL_TRANSACTION_TYPE = "adjustment_reversal";

// A granted reward is held in the promotional_credits account so it is never
// counted as deposited principal or trading profit. Redeeming it moves the value
// into available_balance, and a reversal returns it to the adjustments account.
export const REWARD_RELEASE_ACCOUNT = "adjustments";
export const REWARD_HOLDING_ACCOUNT = "promotional_credits";
export const REWARD_SETTLEMENT_ACCOUNT = "available_balance";

export const REWARD_STATUSES: RewardStatus[] = ["available", "pending", "redeemed", "expired", "revoked"];

export interface RewardRequirementProgress {
  type: RewardRequirementType;
  unit: RewardRequirementUnit;
  current: string;
  required: string;
  remaining: string | null;
  met: boolean;
  progressPercent: number;
  currentLabel: string | null;
  requiredLabel: string | null;
}

export function isRewardCategory(value: unknown): value is RewardCategory {
  return typeof value === "string" && (REWARD_CATEGORIES as string[]).includes(value);
}

export function isRewardRequirementType(value: unknown): value is RewardRequirementType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(REWARD_REQUIREMENT_LABEL, value);
}

export function isRewardStatus(value: unknown): value is RewardStatus {
  return typeof value === "string" && (REWARD_STATUSES as string[]).includes(value);
}

export function normalizeRewardAmount(value: unknown): string {
  return formatDecimal(parseDecimal(String(value), REWARD_AMOUNT_SCALE), REWARD_AMOUNT_SCALE);
}

function percentOfTotal(current: bigint, required: bigint): number {
  if (required <= 0n) return 100;
  if (current >= required) return 100;
  if (current <= 0n) return 0;
  return Number((current * 10000n) / required) / 100;
}

export function amountRequirementProgress(current: string, required: string): RewardRequirementProgress {
  const currentUnits = parseDecimal(normalizeRewardAmount(current), REWARD_AMOUNT_SCALE);
  const requiredUnits = parseDecimal(normalizeRewardAmount(required), REWARD_AMOUNT_SCALE);
  const met = requiredUnits <= 0n || currentUnits >= requiredUnits;
  return {
    type: "deposit_total",
    unit: "amount",
    current: formatDecimal(currentUnits, REWARD_AMOUNT_SCALE),
    required: formatDecimal(requiredUnits, REWARD_AMOUNT_SCALE),
    remaining: met ? ZERO_REWARD : formatDecimal(requiredUnits - currentUnits, REWARD_AMOUNT_SCALE),
    met,
    progressPercent: percentOfTotal(currentUnits, requiredUnits),
    currentLabel: null,
    requiredLabel: null
  };
}

export function countRequirementProgress(current: number, required: number): RewardRequirementProgress {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.trunc(current)) : 0;
  const safeRequired = Number.isFinite(required) ? Math.max(0, Math.trunc(required)) : 0;
  const met = safeRequired <= 0 || safeCurrent >= safeRequired;
  return {
    type: "referral_count",
    unit: "count",
    current: String(safeCurrent),
    required: String(safeRequired),
    remaining: met ? "0" : String(safeRequired - safeCurrent),
    met,
    progressPercent: percentOfTotal(BigInt(safeCurrent), BigInt(safeRequired)),
    currentLabel: null,
    requiredLabel: null
  };
}

export function tierRequirementProgress(input: {
  currentSort: number;
  requiredSort: number;
  currentName: string | null;
  requiredName: string | null;
}): RewardRequirementProgress {
  const currentSort = Number.isFinite(input.currentSort) ? Math.max(0, Math.trunc(input.currentSort)) : 0;
  const requiredSort = Number.isFinite(input.requiredSort) ? Math.max(0, Math.trunc(input.requiredSort)) : 0;
  const met = requiredSort <= 0 || currentSort >= requiredSort;
  return {
    type: "membership_tier",
    unit: "tier",
    current: String(currentSort),
    required: String(requiredSort),
    remaining: null,
    met,
    progressPercent: met ? 100 : percentOfTotal(BigInt(currentSort), BigInt(requiredSort)),
    currentLabel: input.currentName,
    requiredLabel: input.requiredName
  };
}

export function manualRequirementProgress(): RewardRequirementProgress {
  return {
    type: "manual",
    unit: "amount",
    current: ZERO_REQUIREMENT,
    required: ZERO_REQUIREMENT,
    remaining: null,
    met: false,
    progressPercent: 0,
    currentLabel: null,
    requiredLabel: null
  };
}

export function isRewardExpired(expiresAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  const value = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(value.getTime())) return false;
  return value.getTime() <= now.getTime();
}

export function resolveDisplayStatus(status: string, expiresAt: Date | string | null | undefined, now: Date = new Date()): RewardStatus {
  const normalized = isRewardStatus(status) ? status : "pending";
  if ((normalized === "available" || normalized === "pending") && isRewardExpired(expiresAt, now)) {
    return "expired";
  }
  return normalized;
}

export function rewardStatusLabel(status: RewardStatus): string {
  if (status === "available") return "Available";
  if (status === "pending") return "Pending";
  if (status === "redeemed") return "Redeemed";
  if (status === "expired") return "Expired";
  return "Unavailable";
}

export const REWARD_RULES = {
  fundingModel:
    "Rewards are funded from the platform adjustments account and held as promotional credits. They are never sourced from investment principal and never counted as trading profit.",
  redemptionModel:
    "Redeeming an available reward moves its value from promotional_credits into your available balance. A reward can only be redeemed once, and only while it is available and unexpired.",
  eligibilityModel:
    "Eligibility uses confirmed, verified deposits, verified invested principal, assigned membership tier, and referred accounts. Only measures the platform can independently verify are used.",
  expiryModel:
    "A reward expires only when an explicit expiry date is configured for it. No reward uses artificial scarcity or fabricated countdowns."
};
