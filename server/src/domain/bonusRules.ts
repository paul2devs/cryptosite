import { formatDecimal, parseDecimal, percentOf } from "./money";

export const BONUS_TRANSACTION_TYPE = "promotional_bonus_credited";
export const BONUS_SOURCE_TYPE = "bonus_credit";
export const BONUS_CREDIT_ACCOUNT = "promotional_credits";
export const BONUS_SOURCE_ACCOUNT = "adjustments";

export const BONUS_AMOUNT_SCALE = 8;
export const BONUS_PERCENT_SCALE = 6;
export const ZERO_BONUS = "0.00000000";

export interface BonusEligibility {
  minMembershipTierId?: string | null;
  minInvestedAmount?: string | null;
  newUsersOnly?: boolean;
  requiredReferral?: boolean;
}

export interface BonusCampaignRules {
  campaignId: string;
  name: string;
  percentage: string;
  minDeposit: string;
  maxBonus: string | null;
  eligibleAssets: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  priority: number;
  eligibility: BonusEligibility;
}

export interface BonusEvaluationInput {
  amount: string;
  asset: string;
  at: string;
  accountCreatedAt?: string | null;
  investedAmount?: string | null;
  hasReferral?: boolean;
  membershipTierId?: string | null;
}

export interface BonusDecision {
  campaign: BonusCampaignRules;
  bonusAmount: string;
}

const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isCampaignActive(campaign: BonusCampaignRules, at: string): boolean {
  if (!campaign.active) return false;
  const moment = parseDate(at);
  if (!moment) return false;
  const startsAt = parseDate(campaign.startsAt);
  if (startsAt && moment.getTime() < startsAt.getTime()) return false;
  const endsAt = parseDate(campaign.endsAt);
  if (endsAt && moment.getTime() > endsAt.getTime()) return false;
  return true;
}

export function isAssetEligible(campaign: BonusCampaignRules, asset: string): boolean {
  if (!campaign.eligibleAssets || campaign.eligibleAssets.length === 0) return true;
  const target = asset.trim().toUpperCase();
  return campaign.eligibleAssets.some((candidate) => candidate.trim().toUpperCase() === target);
}

export function meetsMinimumDeposit(campaign: BonusCampaignRules, amount: string): boolean {
  const deposit = parseDecimal(amount, BONUS_AMOUNT_SCALE);
  const minimum = parseDecimal(campaign.minDeposit, BONUS_AMOUNT_SCALE);
  return deposit >= minimum;
}

export function meetsEligibility(campaign: BonusCampaignRules, input: BonusEvaluationInput): boolean {
  const eligibility = campaign.eligibility ?? {};
  if (eligibility.minMembershipTierId) {
    if ((input.membershipTierId ?? "").trim() !== eligibility.minMembershipTierId) {
      return false;
    }
  }
  if (eligibility.minInvestedAmount) {
    const invested = parseDecimal(input.investedAmount ?? "0.00000000", BONUS_AMOUNT_SCALE);
    const required = parseDecimal(eligibility.minInvestedAmount, BONUS_AMOUNT_SCALE);
    if (invested < required) return false;
  }
  if (eligibility.requiredReferral && !input.hasReferral) return false;
  if (eligibility.newUsersOnly) {
    const created = parseDate(input.accountCreatedAt);
    const at = parseDate(input.at);
    if (!created || !at) return false;
    if (at.getTime() - created.getTime() > NEW_USER_WINDOW_MS) return false;
  }
  return true;
}

export function calculatePromotionalBonus(input: {
  amount: string;
  percentage: string;
  maxBonus: string | null;
}): string {
  const deposit = parseDecimal(input.amount, BONUS_AMOUNT_SCALE);
  if (deposit <= 0n) return ZERO_BONUS;
  const percent = parseDecimal(input.percentage, BONUS_PERCENT_SCALE);
  if (percent <= 0n) return ZERO_BONUS;
  const raw = parseDecimal(
    percentOf(input.amount, input.percentage, BONUS_AMOUNT_SCALE, BONUS_PERCENT_SCALE),
    BONUS_AMOUNT_SCALE
  );
  if (raw <= 0n) return ZERO_BONUS;
  if (input.maxBonus) {
    const cap = parseDecimal(input.maxBonus, BONUS_AMOUNT_SCALE);
    if (cap > 0n && raw > cap) return formatDecimal(cap, BONUS_AMOUNT_SCALE);
  }
  return formatDecimal(raw, BONUS_AMOUNT_SCALE);
}

export function isCampaignEligible(campaign: BonusCampaignRules, input: BonusEvaluationInput): boolean {
  return (
    isCampaignActive(campaign, input.at) &&
    isAssetEligible(campaign, input.asset) &&
    meetsMinimumDeposit(campaign, input.amount) &&
    meetsEligibility(campaign, input)
  );
}

export function resolveBonusCampaign(
  campaigns: BonusCampaignRules[],
  input: BonusEvaluationInput
): BonusDecision | null {
  const decisions: BonusDecision[] = [];
  for (const campaign of campaigns) {
    if (!isCampaignEligible(campaign, input)) continue;
    const bonusAmount = calculatePromotionalBonus({
      amount: input.amount,
      percentage: campaign.percentage,
      maxBonus: campaign.maxBonus
    });
    if (parseDecimal(bonusAmount, BONUS_AMOUNT_SCALE) <= 0n) continue;
    decisions.push({ campaign, bonusAmount });
  }
  if (decisions.length === 0) return null;
  decisions.sort((left, right) => {
    if (right.campaign.priority !== left.campaign.priority) {
      return right.campaign.priority - left.campaign.priority;
    }
    const leftBonus = parseDecimal(left.bonusAmount, BONUS_AMOUNT_SCALE);
    const rightBonus = parseDecimal(right.bonusAmount, BONUS_AMOUNT_SCALE);
    if (leftBonus !== rightBonus) return leftBonus > rightBonus ? -1 : 1;
    return right.campaign.percentage.localeCompare(left.campaign.percentage);
  });
  return decisions[0];
}

export function fallbackCampaign(settings: {
  percentage: string;
  minDeposit: string;
  maxBonus: string | null;
  eligibleAssets: string[] | null;
}): BonusCampaignRules {
  return {
    campaignId: "default",
    name: "Standard promotional bonus",
    percentage: settings.percentage,
    minDeposit: settings.minDeposit,
    maxBonus: settings.maxBonus,
    eligibleAssets: settings.eligibleAssets,
    startsAt: null,
    endsAt: null,
    active: true,
    priority: 0,
    eligibility: {}
  };
}
