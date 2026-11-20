import { randomUUID } from "crypto";
import { Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { sequelize } from "../config/database";
import { buildLedgerIdempotencyKey } from "../domain/ledgerRules";
import { formatDecimal, parseDecimal } from "../domain/money";
import {
  REWARD_AMOUNT_SCALE,
  REWARD_CATEGORIES,
  REWARD_CATEGORY_DESCRIPTION,
  REWARD_CATEGORY_LABEL,
  REWARD_EARNINGS_HOLDING_ACCOUNT,
  REWARD_EARNINGS_RELEASE_ACCOUNT,
  REWARD_EARNINGS_REVERSAL_SOURCE_TYPE,
  REWARD_EARNINGS_SOURCE_TYPE,
  REWARD_EARNINGS_TRANSACTION_TYPE,
  REWARD_GRANT_SOURCE_TYPE,
  REWARD_GRANT_TRANSACTION_TYPE,
  REWARD_HOLDING_ACCOUNT,
  REWARD_REDEMPTION_SOURCE_TYPE,
  REWARD_REDEMPTION_TRANSACTION_TYPE,
  REWARD_RELEASE_ACCOUNT,
  REWARD_REQUIREMENT_LABEL,
  REWARD_REQUIREMENT_UNIT,
  REWARD_REVERSAL_SOURCE_TYPE,
  REWARD_REVERSAL_TRANSACTION_TYPE,
  REWARD_RULES,
  REWARD_SETTLEMENT_ACCOUNT,
  ZERO_REQUIREMENT,
  ZERO_REWARD,
  amountRequirementProgress,
  countRequirementProgress,
  isRewardCategory,
  isRewardRequirementType,
  manualRequirementProgress,
  normalizeRewardAmount,
  resolveDisplayStatus,
  rewardStatusLabel,
  tierRequirementProgress,
  type RewardCategory,
  type RewardRequirementProgress,
  type RewardRequirementType,
  type RewardRequirementUnit,
  type RewardStatus
} from "../domain/rewardRules";
import { generateReference } from "../domain/transactionRules";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { InvestmentPosition } from "../models/InvestmentPosition";
import { LedgerAccount } from "../models/LedgerAccount";
import { LedgerEntry } from "../models/LedgerEntry";
import { MembershipTier } from "../models/MembershipTier";
import { Notification } from "../models/Notification";
import { Referral } from "../models/Referral";
import { Reward } from "../models/Reward";
import { User } from "../models/User";
import { UserMembership } from "../models/UserMembership";
import { UserReward } from "../models/UserReward";
import { trackUserActivity } from "./activityService";
import { notifyFinancialEvent } from "./financialNotificationService";
import { dispatchNotificationEmail } from "./notificationDispatchService";
import { postBalancedEntry } from "./financialOperationsService";
import { calculateQualifyingAmount } from "./membershipService";

export interface RewardItemView {
  id: string;
  rewardId: string | null;
  userRewardId: string | null;
  name: string;
  description: string;
  category: RewardCategory;
  categoryLabel: string;
  amount: string;
  asset: string;
  status: RewardStatus;
  statusLabel: string;
  requirementType: RewardRequirementType;
  requirementLabel: string;
  requirementUnit: RewardRequirementUnit;
  progress: RewardRequirementProgress;
  reference: string | null;
  grantedAt: string | null;
  redeemedAt: string | null;
  grantedByAdmin: boolean;
  expiresAt: string | null;
  canRedeem: boolean;
}

export interface RewardHistoryEntry {
  id: string;
  name: string;
  category: RewardCategory;
  categoryLabel: string;
  amount: string;
  asset: string;
  status: RewardStatus;
  statusLabel: string;
  dateEarned: string | null;
  dateRedeemed: string | null;
  reference: string;
  grantSource: string;
}

export interface RewardCategorySummary {
  id: RewardCategory;
  label: string;
  description: string;
  grantedCount: number;
  availableCount: number;
  totalAmount: string;
}

export interface RewardSummary {
  availableAmount: string;
  pendingAmount: string;
  redeemedAmount: string;
  totalEarned: string;
  availableCount: number;
  redeemedCount: number;
  totalCount: number;
}

export interface RewardMilestone {
  rewardId: string;
  name: string;
  amount: string;
  asset: string;
  category: RewardCategory;
  categoryLabel: string;
  requirementLabel: string;
  requirementUnit: RewardRequirementUnit;
  progressPercent: number;
  remaining: string | null;
}

export interface RewardEligibilityView {
  depositTotal: string;
  depositTotalVerified: boolean;
  investTotal: string;
  membershipTierName: string | null;
  referralCount: number;
}

export interface RewardDashboard {
  summary: RewardSummary;
  categories: RewardCategorySummary[];
  rewards: RewardItemView[];
  locked: RewardItemView[];
  upcoming: RewardItemView[];
  history: RewardHistoryEntry[];
  eligibility: RewardEligibilityView;
  balance: { promotionalCredits: string; withdrawable: string };
  rules: typeof REWARD_RULES;
}

export interface RewardCampaignPerformance {
  rewardId: string;
  name: string;
  category: RewardCategory;
  categoryLabel: string;
  active: boolean;
  grantedCount: number;
  grantedTotal: string;
  redeemedCount: number;
  redeemedTotal: string;
}

export interface RewardAdminSummary {
  catalogCount: number;
  activeCount: number;
  userCount: number;
  grantCount: number;
  redemptionCount: number;
  totals: { granted: string; redeemed: string; pending: string; available: string };
  byCategory: Array<{ id: RewardCategory; label: string; grantedCount: number; grantedTotal: string; redeemedTotal: string }>;
  campaignPerformance: RewardCampaignPerformance[];
  recent: RewardHistoryEntry[];
  catalog: RewardCatalogEntry[];
}

export interface RewardCatalogEntry {
  rewardId: string;
  name: string;
  description: string;
  category: RewardCategory;
  categoryLabel: string;
  amount: string;
  asset: string;
  requirementType: RewardRequirementType;
  requirementLabel: string;
  requirementAmount: string;
  requirementCount: number;
  requirementTierId: string | null;
  requirementTierName: string | null;
  maxRedemptions: number | null;
  active: boolean;
  priority: number;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RewardCatalogInput {
  rewardId?: string | null;
  name: string;
  description?: string;
  category: string;
  amount: string;
  asset: string;
  requirementType: string;
  requirementAmount?: string | null;
  requirementCount?: number | null;
  requirementTierId?: string | null;
  maxRedemptions?: number | null;
  active?: boolean;
  priority?: number | null;
  expiresAt?: string | null;
  reason: string;
}

export interface RewardGrantInput {
  userId: string;
  rewardId?: string | null;
  name?: string | null;
  category?: string | null;
  amount?: string | null;
  asset?: string | null;
  expiresAt?: string | null;
  reason: string;
  // When true (the default for an administrator grant) the granted amount is also
  // credited to the user's unsettled investment earnings, in addition to the
  // promotional credit. An administrator can opt out per grant.
  countAsInvestmentEarnings?: boolean | null;
}

export interface RewardRedemptionResult {
  userRewardId: string;
  name: string;
  amount: string;
  asset: string;
  reference: string;
  status: RewardStatus;
}

export interface RewardEligibilitySnapshot {
  userId: string;
  depositTotal: string;
  depositTotalVerified: boolean;
  investTotal: string;
  membershipTierId: string | null;
  membershipTierName: string | null;
  membershipTierSort: number;
  referralCount: number;
  bonusBlocked: boolean;
}

const DEFAULT_REWARDS: Array<{
  name: string;
  description: string;
  category: RewardCategory;
  amount: string;
  asset: string;
  requirementType: RewardRequirementType;
  requirementAmount?: string;
  requirementCount?: number;
  requirementTierName?: string;
  priority: number;
}> = [
  {
    name: "First Confirmed Deposit",
    description:
      "Platform default loyalty reward issued once your first confirmed, verified deposits reach $500 in total. Amount and threshold are configurable by the platform.",
    category: "loyalty",
    amount: "25.00000000",
    asset: "USDT",
    requirementType: "deposit_total",
    requirementAmount: "500.00000000",
    priority: 50
  },
  {
    name: "Steady Depositor",
    description:
      "Platform default loyalty reward issued once your confirmed, verified deposits reach $5,000 in total.",
    category: "loyalty",
    amount: "75.00000000",
    asset: "USDT",
    requirementType: "deposit_total",
    requirementAmount: "5000.00000000",
    priority: 40
  },
  {
    name: "Silver Membership Reward",
    description:
      "Platform default loyalty reward issued when your assigned membership tier reaches Silver or higher.",
    category: "loyalty",
    amount: "50.00000000",
    asset: "USDT",
    requirementType: "membership_tier",
    requirementTierName: "Silver",
    priority: 30
  },
  {
    name: "Portfolio Builder",
    description:
      "Platform default loyalty reward issued once your verified invested principal reaches 1,000 in total.",
    category: "loyalty",
    amount: "60.00000000",
    asset: "USDT",
    requirementType: "invest_total",
    requirementAmount: "1000.00000000",
    priority: 20
  },
  {
    name: "Introducer Reward",
    description:
      "Platform default referral reward issued once three accounts have joined with your referral code.",
    category: "referral",
    amount: "40.00000000",
    asset: "USDT",
    requirementType: "referral_count",
    requirementCount: 3,
    priority: 10
  },
  {
    name: "Welcome Campaign Reward",
    description:
      "Platform default promotional reward issued by the platform to eligible accounts. It is never granted automatically.",
    category: "promotional",
    amount: "10.00000000",
    asset: "USDT",
    requirementType: "manual",
    priority: 5
  }
];

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function categoryOf(value: string): RewardCategory {
  return isRewardCategory(value) ? value : "promotional";
}

function requirementOf(value: string): RewardRequirementType {
  return isRewardRequirementType(value) ? value : "manual";
}

function pageFrom(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.trunc(parsed), max);
}

async function buildEligibilitySnapshot(user: User): Promise<RewardEligibilitySnapshot> {
  const [qualification, positions, membership, referralCount] = await Promise.all([
    calculateQualifyingAmount(user.user_id),
    InvestmentPosition.findAll({ where: { user_id: user.user_id } }),
    UserMembership.findByPk(user.user_id),
    Referral.count({ where: { referrer_id: user.user_id } })
  ]);

  let membershipTierId: string | null = membership?.tier_id ?? null;
  let membershipTierName: string | null = null;
  let membershipTierSort = 0;
  if (membershipTierId) {
    const tier = await MembershipTier.findByPk(membershipTierId);
    if (tier) {
      membershipTierName = tier.name;
      membershipTierSort = tier.sort_order;
    } else {
      membershipTierId = null;
    }
  }

  const invested = positions.reduce(
    (total, position) => total + parseDecimal(String(position.principal), REWARD_AMOUNT_SCALE),
    0n
  );

  const verifiedDeposits = qualification.complete && qualification.amount !== null;
  return {
    userId: user.user_id,
    depositTotal: verifiedDeposits
      ? formatDecimal(parseDecimal(qualification.amount as string, 2), REWARD_AMOUNT_SCALE)
      : ZERO_REWARD,
    depositTotalVerified: verifiedDeposits,
    investTotal: formatDecimal(invested, REWARD_AMOUNT_SCALE),
    membershipTierId,
    membershipTierName,
    membershipTierSort,
    referralCount,
    bonusBlocked: Boolean(user.bonus_blocked)
  };
}

function progressForReward(
  reward: Reward,
  snapshot: RewardEligibilitySnapshot,
  tiersById: Map<string, MembershipTier>
): RewardRequirementProgress {
  if (reward.requirement_type === "deposit_total") {
    const required = normalizeRewardAmount(reward.requirement_amount);
    if (!snapshot.depositTotalVerified) {
      return {
        ...amountRequirementProgress(ZERO_REWARD, required),
        type: "deposit_total",
        met: false,
        progressPercent: 0,
        remaining: required
      };
    }
    return { ...amountRequirementProgress(snapshot.depositTotal, required), type: "deposit_total" };
  }
  if (reward.requirement_type === "invest_total") {
    return {
      ...amountRequirementProgress(snapshot.investTotal, normalizeRewardAmount(reward.requirement_amount)),
      type: "invest_total"
    };
  }
  if (reward.requirement_type === "referral_count") {
    return {
      ...countRequirementProgress(snapshot.referralCount, reward.requirement_count),
      type: "referral_count"
    };
  }
  if (reward.requirement_type === "membership_tier") {
    const requiredTier = reward.requirement_tier_id ? tiersById.get(reward.requirement_tier_id) ?? null : null;
    return tierRequirementProgress({
      currentSort: snapshot.membershipTierSort,
      requiredSort: requiredTier ? requiredTier.sort_order : 0,
      currentName: snapshot.membershipTierName,
      requiredName: requiredTier ? requiredTier.name : null
    });
  }
  return manualRequirementProgress();
}

function grantedItemFrom(
  row: UserReward,
  reward: Reward | null,
  progress: RewardRequirementProgress
): RewardItemView {
  const status = resolveDisplayStatus(row.status, row.expires_at);
  const category = categoryOf(row.category);
  const requirementType = reward ? requirementOf(reward.requirement_type) : "manual";
  const amount = normalizeRewardAmount(row.amount);
  return {
    id: row.user_reward_id,
    rewardId: row.reward_id,
    userRewardId: row.user_reward_id,
    name: row.reward_name,
    description: reward ? reward.description : "",
    category,
    categoryLabel: REWARD_CATEGORY_LABEL[category],
    amount,
    asset: row.asset,
    status,
    statusLabel: rewardStatusLabel(status),
    requirementType,
    requirementLabel: REWARD_REQUIREMENT_LABEL[requirementType],
    requirementUnit: REWARD_REQUIREMENT_UNIT[requirementType],
    progress,
    reference: row.reference,
    grantedAt: toIso(row.granted_at),
    redeemedAt: toIso(row.redeemed_at),
    grantedByAdmin: row.grant_source === "admin",
    expiresAt: toIso(row.expires_at),
    canRedeem: status === "available" && parseDecimal(amount, REWARD_AMOUNT_SCALE) > 0n
  };
}

function lockedItemFrom(reward: Reward, progress: RewardRequirementProgress): RewardItemView {
  const category = categoryOf(reward.category);
  const requirementType = requirementOf(reward.requirement_type);
  return {
    id: reward.reward_id,
    rewardId: reward.reward_id,
    userRewardId: null,
    name: reward.name,
    description: reward.description,
    category,
    categoryLabel: REWARD_CATEGORY_LABEL[category],
    amount: normalizeRewardAmount(reward.amount),
    asset: reward.asset,
    status: "pending",
    statusLabel: "Locked",
    requirementType,
    requirementLabel: REWARD_REQUIREMENT_LABEL[requirementType],
    requirementUnit: REWARD_REQUIREMENT_UNIT[requirementType],
    progress,
    reference: null,
    grantedAt: null,
    redeemedAt: null,
    grantedByAdmin: false,
    expiresAt: toIso(reward.expires_at),
    canRedeem: false
  };
}

function toHistoryEntry(row: UserReward): RewardHistoryEntry {
  const category = categoryOf(row.category);
  const status = resolveDisplayStatus(row.status, row.expires_at);
  return {
    id: row.user_reward_id,
    name: row.reward_name,
    category,
    categoryLabel: REWARD_CATEGORY_LABEL[category],
    amount: normalizeRewardAmount(row.amount),
    asset: row.asset,
    status,
    statusLabel: rewardStatusLabel(status),
    dateEarned: toIso(row.granted_at),
    dateRedeemed: toIso(row.redeemed_at),
    reference: row.reference,
    grantSource: row.grant_source
  };
}

function toCatalogEntry(reward: Reward, tierName: string | null): RewardCatalogEntry {
  const category = categoryOf(reward.category);
  const requirementType = requirementOf(reward.requirement_type);
  return {
    rewardId: reward.reward_id,
    name: reward.name,
    description: reward.description,
    category,
    categoryLabel: REWARD_CATEGORY_LABEL[category],
    amount: normalizeRewardAmount(reward.amount),
    asset: reward.asset,
    requirementType,
    requirementLabel: REWARD_REQUIREMENT_LABEL[requirementType],
    requirementAmount: normalizeRewardAmount(reward.requirement_amount),
    requirementCount: reward.requirement_count,
    requirementTierId: reward.requirement_tier_id,
    requirementTierName: tierName,
    maxRedemptions: reward.max_redemptions,
    active: reward.active,
    priority: reward.priority,
    expiresAt: toIso(reward.expires_at),
    createdAt: toIso(reward.created_at),
    updatedAt: toIso(reward.updated_at)
  };
}

function sumAmounts(rows: UserReward[]): string {
  const total = rows.reduce(
    (accumulator, row) => accumulator + parseDecimal(normalizeRewardAmount(row.amount), REWARD_AMOUNT_SCALE),
    0n
  );
  return formatDecimal(total, REWARD_AMOUNT_SCALE);
}

// Reads the user's pending earnings figure from the JSONB column without ever
// inventing a value. This is the same field the earnings engine and the
// administrator pending-earnings adjustment operate on.
function pendingEarningsUnits(user: User): bigint {
  const raw = (user.pending_earnings as { total?: unknown } | null | undefined)?.total;
  if (raw === undefined || raw === null) return 0n;
  return parseDecimal(String(raw), REWARD_AMOUNT_SCALE);
}

function rewardEarningsCredited(row: UserReward): boolean {
  return Boolean((row.metadata as { earningsCredited?: unknown } | null | undefined)?.earningsCredited);
}

async function issueReward(input: {
  user: User;
  rewardId: string | null;
  name: string;
  description: string;
  amount: string;
  asset: string;
  category: RewardCategory;
  grantSource: "automated" | "admin";
  grantedBy: string | null;
  reason: string;
  expiresAt: Date | null;
  requirementType: RewardRequirementType;
  countAsEarnings: boolean;
}): Promise<UserReward | null> {
  const amount = normalizeRewardAmount(input.amount);
  const amountUnits = parseDecimal(amount, REWARD_AMOUNT_SCALE);
  if (amountUnits <= 0n) return null;

  const userRewardId = randomUUID();
  const reference = generateReference(REWARD_GRANT_SOURCE_TYPE, userRewardId);
  const ledgerKey = buildLedgerIdempotencyKey(
    REWARD_GRANT_SOURCE_TYPE,
    userRewardId,
    REWARD_HOLDING_ACCOUNT
  );

  let row: UserReward;
  try {
    row = await sequelize.transaction(async (transaction) => {
      const created = await UserReward.create(
        {
          user_reward_id: userRewardId,
          user_id: input.user.user_id,
          reward_id: input.rewardId,
          reward_name: input.name,
          category: input.category,
          amount,
          asset: input.asset,
          status: "available",
          reference,
          ledger_idempotency_key: ledgerKey,
          grant_source: input.grantSource,
          grant_reason: input.reason,
          granted_by: input.grantedBy,
          granted_at: new Date(),
          expires_at: input.expiresAt,
          metadata: {
            requirementType: input.requirementType,
            description: input.description,
            earningsCredited: input.countAsEarnings
          }
        },
        { transaction }
      );

      await postBalancedEntry({
        userId: input.user.user_id,
        asset: input.asset,
        amount,
        transactionType: REWARD_GRANT_TRANSACTION_TYPE,
        sourceType: REWARD_GRANT_SOURCE_TYPE,
        sourceId: userRewardId,
        debit: REWARD_RELEASE_ACCOUNT,
        credit: REWARD_HOLDING_ACCOUNT,
        transaction
      });

      if (input.countAsEarnings) {
        // Move the same amount into the pending settlement account and increase
        // the user's pending earnings figure so the reward is reported as
        // investment earnings. It stays unsettled and non-withdrawable.
        await postBalancedEntry({
          userId: input.user.user_id,
          asset: input.asset,
          amount,
          transactionType: REWARD_EARNINGS_TRANSACTION_TYPE,
          sourceType: REWARD_EARNINGS_SOURCE_TYPE,
          sourceId: userRewardId,
          debit: REWARD_EARNINGS_RELEASE_ACCOUNT,
          credit: REWARD_EARNINGS_HOLDING_ACCOUNT,
          transaction
        });
        const owner = await User.findByPk(input.user.user_id, { transaction, lock: transaction.LOCK.UPDATE });
        if (owner) {
          owner.pending_earnings = {
            total: Number(formatDecimal(pendingEarningsUnits(owner) + amountUnits, REWARD_AMOUNT_SCALE))
          };
          await owner.save({ transaction });
        }
      }

      return created;
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) return null;
    throw error;
  }

  await notifyFinancialEvent({
    userId: input.user.user_id,
    type: "reward_granted",
    templateKey: "rewardGranted",
    variables: { reward: input.name, amount, asset: input.asset, reference },
    fallbackMessage: `Reward ${input.name} of ${amount} ${input.asset} granted to your account. Reference ${reference}.`,
    email: {
      sourceId: userRewardId,
      subject: `Reward granted: ${input.name}`,
      heading: "Reward granted",
      preheader: "A new reward has been added to your account.",
      details: [
        { label: "Reward", value: input.name },
        { label: "Amount", value: `${amount} ${input.asset}` },
        { label: "Asset", value: input.asset },
        { label: "Reference", value: reference },
        { label: "Date", value: new Date().toISOString() }
      ],
      statusLabel: "Granted",
      statusTone: "positive",
      ctaLabel: "View rewards",
      ctaPath: "/rewards"
    }
  });

  await trackUserActivity(input.user.user_id, "reward_granted", {
    rewardId: input.rewardId,
    userRewardId,
    amount,
    asset: input.asset,
    category: input.category,
    source: input.grantSource
  });

  return row;
}

export async function syncUserRewards(userId: string): Promise<{ granted: number; rewardIds: string[] }> {
  const user = await User.findByPk(userId);
  if (!user) return { granted: 0, rewardIds: [] };

  const catalog = await Reward.findAll({ where: { active: true } });
  const automatic = catalog.filter((reward) => reward.requirement_type !== "manual");
  if (automatic.length === 0) return { granted: 0, rewardIds: [] };

  const existing = await UserReward.findAll({ where: { user_id: userId }, attributes: ["reward_id"] });
  const held = new Set(existing.map((row) => row.reward_id).filter((value): value is string => Boolean(value)));
  const pending = automatic.filter((reward) => !held.has(reward.reward_id));
  if (pending.length === 0) return { granted: 0, rewardIds: [] };

  const snapshot = await buildEligibilitySnapshot(user);
  if (snapshot.bonusBlocked) return { granted: 0, rewardIds: [] };

  const tiers = await MembershipTier.findAll();
  const tiersById = new Map(tiers.map((tier) => [tier.tier_id, tier]));

  const grantedIds: string[] = [];
  for (const reward of pending) {
    const progress = progressForReward(reward, snapshot, tiersById);
    if (!progress.met) continue;
    if (reward.max_redemptions !== null) {
      const issued = await UserReward.count({ where: { reward_id: reward.reward_id } });
      if (issued >= reward.max_redemptions) continue;
    }
    const created = await issueReward({
      user,
      rewardId: reward.reward_id,
      name: reward.name,
      description: reward.description,
      amount: reward.amount,
      asset: reward.asset,
      category: categoryOf(reward.category),
      grantSource: "automated",
      grantedBy: null,
      reason: `Automatically granted: ${REWARD_REQUIREMENT_LABEL[requirementOf(reward.requirement_type)]} requirement satisfied.`,
      expiresAt: reward.expires_at,
      requirementType: requirementOf(reward.requirement_type),
      // Automated milestone rewards stay promotional credits only; crediting
      // investment earnings is an explicit administrator decision.
      countAsEarnings: false
    });
    if (created) grantedIds.push(reward.reward_id);
  }
  return { granted: grantedIds.length, rewardIds: grantedIds };
}

export async function getRewardDashboard(userId: string): Promise<RewardDashboard> {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");

  await syncUserRewards(userId);

  const [catalog, grants, snapshot, tiers, balances] = await Promise.all([
    Reward.findAll({ where: { active: true }, order: [["priority", "DESC"], ["created_at", "DESC"]] }),
    UserReward.findAll({ where: { user_id: userId }, order: [["granted_at", "DESC"]] }),
    buildEligibilitySnapshot(user),
    MembershipTier.findAll(),
    ledgerBalancesForUserSafe(userId)
  ]);

  const tiersById = new Map(tiers.map((tier) => [tier.tier_id, tier]));
  const catalogById = new Map(catalog.map((reward) => [reward.reward_id, reward]));
  const heldRewardIds = new Set(grants.map((row) => row.reward_id).filter((value): value is string => Boolean(value)));

  const rewards = grants.map((row) => {
    const linked = row.reward_id ? catalogById.get(row.reward_id) ?? null : null;
    const progress = linked
      ? progressForReward(linked, snapshot, tiersById)
      : manualRequirementProgress();
    return grantedItemFrom(row, linked, progress);
  });

  const locked = catalog
    .filter((reward) => !heldRewardIds.has(reward.reward_id))
    .map((reward) => lockedItemFrom(reward, progressForReward(reward, snapshot, tiersById)))
    .sort((left, right) => {
      if (right.progress.progressPercent !== left.progress.progressPercent) {
        return right.progress.progressPercent - left.progress.progressPercent;
      }
      return left.name.localeCompare(right.name);
    });

  const available = grants.filter((row) => resolveDisplayStatus(row.status, row.expires_at) === "available");
  const pending = grants.filter((row) => resolveDisplayStatus(row.status, row.expires_at) === "pending");
  const redeemed = grants.filter((row) => resolveDisplayStatus(row.status, row.expires_at) === "redeemed");

  const summary: RewardSummary = {
    availableAmount: sumAmounts(available),
    pendingAmount: sumAmounts(pending),
    redeemedAmount: sumAmounts(redeemed),
    totalEarned: sumAmounts(grants),
    availableCount: available.length,
    redeemedCount: redeemed.length,
    totalCount: grants.length
  };

  const categories: RewardCategorySummary[] = REWARD_CATEGORIES.map((id) => {
    const scoped = grants.filter((row) => categoryOf(row.category) === id);
    return {
      id,
      label: REWARD_CATEGORY_LABEL[id],
      description: REWARD_CATEGORY_DESCRIPTION[id],
      grantedCount: scoped.length,
      availableCount: scoped.filter((row) => resolveDisplayStatus(row.status, row.expires_at) === "available").length,
      totalAmount: sumAmounts(scoped)
    };
  });

  return {
    summary,
    categories,
    rewards,
    locked,
    upcoming: locked.slice(0, 3),
    history: grants.map(toHistoryEntry),
    eligibility: {
      depositTotal: snapshot.depositTotal,
      depositTotalVerified: snapshot.depositTotalVerified,
      investTotal: snapshot.investTotal,
      membershipTierName: snapshot.membershipTierName,
      referralCount: snapshot.referralCount
    },
    balance: balances,
    rules: REWARD_RULES
  };
}

async function ledgerBalancesForUserSafe(userId: string): Promise<{ promotionalCredits: string; withdrawable: string }> {
  const [user, rows, accounts] = await Promise.all([
    User.findByPk(userId),
    LedgerEntry.findAll({ where: { user_id: userId } }),
    LedgerAccount.findAll({ where: { user_id: userId } })
  ]);
  const byAccount = new Map(accounts.map((account) => [account.account_id, account]));
  let promotional = 0n;
  for (const entry of rows) {
    const account = byAccount.get(entry.account_id);
    if (!account || account.code !== "promotional_credits") continue;
    const amount = parseDecimal(String(entry.amount), REWARD_AMOUNT_SCALE);
    promotional = entry.direction === "credit" ? promotional + amount : promotional - amount;
  }
  const withdrawable = user ? Number(user.withdrawable_balance || 0) : 0;
  return {
    promotionalCredits: formatDecimal(promotional, REWARD_AMOUNT_SCALE),
    withdrawable: withdrawable.toFixed(REWARD_AMOUNT_SCALE)
  };
}

export async function redeemReward(userId: string, userRewardId: string): Promise<RewardRedemptionResult> {
  const result = await sequelize.transaction(async (transaction) => {
    const row = await UserReward.findByPk(userRewardId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row || row.user_id !== userId) throw new Error("Reward not found");

    const display = resolveDisplayStatus(row.status, row.expires_at);
    if (display === "redeemed") throw new Error("This reward has already been redeemed.");
    if (display === "revoked") throw new Error("This reward has been revoked and can no longer be redeemed.");
    if (display === "pending") throw new Error("This reward is not available to redeem yet.");
    if (display === "expired") {
      if (row.status !== "expired") {
        row.status = "expired";
        row.updated_at = new Date();
        await row.save({ transaction });
      }
      throw new Error("This reward has expired and can no longer be redeemed.");
    }

    const amount = normalizeRewardAmount(row.amount);
    if (parseDecimal(amount, REWARD_AMOUNT_SCALE) <= 0n) throw new Error("This reward has no value to redeem.");

    const ledgerKey = buildLedgerIdempotencyKey(
      REWARD_REDEMPTION_SOURCE_TYPE,
      userRewardId,
      REWARD_SETTLEMENT_ACCOUNT
    );
    const existing = await LedgerEntry.findOne({ where: { idempotency_key: ledgerKey }, transaction });
    if (existing) throw new Error("This reward has already been redeemed.");

    const reference = generateReference(REWARD_REDEMPTION_SOURCE_TYPE, userRewardId);
    await postBalancedEntry({
      userId,
      asset: row.asset,
      amount,
      transactionType: REWARD_REDEMPTION_TRANSACTION_TYPE,
      sourceType: REWARD_REDEMPTION_SOURCE_TYPE,
      sourceId: userRewardId,
      debit: REWARD_HOLDING_ACCOUNT,
      credit: REWARD_SETTLEMENT_ACCOUNT,
      transaction
    });

    row.status = "redeemed";
    row.redeemed_at = new Date();
    row.redemption_reference = reference;
    row.redemption_ledger_key = ledgerKey;
    row.updated_at = new Date();
    await row.save({ transaction });

    const owner = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (owner) {
      owner.withdrawable_balance = Number(
        (Number(owner.withdrawable_balance) + Number(amount)).toFixed(REWARD_AMOUNT_SCALE)
      );
      await owner.save({ transaction });
    }

    return {
      userRewardId,
      name: row.reward_name,
      amount,
      asset: row.asset,
      reference,
      status: "redeemed" as RewardStatus
    };
  });

  await notifyFinancialEvent({
    userId,
    type: "reward_redeemed",
    templateKey: "rewardRedeemed",
    variables: { reward: result.name, amount: result.amount, asset: result.asset, reference: result.reference },
    fallbackMessage: `Reward ${result.name} of ${result.amount} ${result.asset} redeemed into your available balance. Reference ${result.reference}.`,
    email: {
      sourceId: result.userRewardId,
      subject: `Reward redeemed: ${result.name}`,
      heading: "Reward redeemed",
      preheader: "Your reward has been redeemed into your available balance.",
      details: [
        { label: "Reward", value: result.name },
        { label: "Amount", value: `${result.amount} ${result.asset}` },
        { label: "Asset", value: result.asset },
        { label: "Reference", value: result.reference },
        { label: "Date", value: new Date().toISOString() }
      ],
      statusLabel: "Redeemed",
      statusTone: "positive",
      ctaLabel: "View balance",
      ctaPath: "/portfolio"
    }
  });

  await trackUserActivity(userId, "reward_redeemed", {
    userRewardId: result.userRewardId,
    name: result.name,
    amount: result.amount,
    asset: result.asset,
    reference: result.reference
  });

  return result;
}

export async function listRewardCatalog(): Promise<RewardCatalogEntry[]> {
  const [rewards, tiers] = await Promise.all([
    Reward.findAll({ order: [["priority", "DESC"], ["created_at", "DESC"]] }),
    MembershipTier.findAll()
  ]);
  const tierNames = new Map(tiers.map((tier) => [tier.tier_id, tier.name]));
  return rewards.map((reward) =>
    toCatalogEntry(reward, reward.requirement_tier_id ? tierNames.get(reward.requirement_tier_id) ?? null : null)
  );
}

export async function saveRewardForAdmin(adminId: string, input: RewardCatalogInput): Promise<RewardCatalogEntry> {
  if (!input.reason.trim() || input.reason.trim().length < 3) {
    throw new Error("A reason (at least 3 characters) is required to change a reward.");
  }
  const name = input.name.trim();
  if (!name) throw new Error("A reward name is required.");
  if (!isRewardCategory(input.category)) throw new Error("A valid reward category is required.");
  if (!isRewardRequirementType(input.requirementType)) throw new Error("A valid requirement type is required.");

  const amount = normalizeRewardAmount(input.amount);
  if (parseDecimal(amount, REWARD_AMOUNT_SCALE) <= 0n) {
    throw new Error("The reward amount must be greater than zero.");
  }

  const requirementAmount = normalizeRewardAmount(input.requirementAmount ?? ZERO_REQUIREMENT);
  const requirementCount = Number.isFinite(Number(input.requirementCount))
    ? Math.max(0, Math.trunc(Number(input.requirementCount)))
    : 0;

  let requirementTierId: string | null = input.requirementTierId ? input.requirementTierId.trim() || null : null;
  if (input.requirementType === "membership_tier") {
    if (!requirementTierId) throw new Error("Select the membership tier this reward requires.");
    const tier = await MembershipTier.findByPk(requirementTierId);
    if (!tier) throw new Error("Membership tier not found");
  } else {
    requirementTierId = null;
  }
  if (input.requirementType === "referral_count" && requirementCount <= 0) {
    throw new Error("A referred-account count greater than zero is required.");
  }
  if (
    (input.requirementType === "deposit_total" || input.requirementType === "invest_total") &&
    parseDecimal(requirementAmount, REWARD_AMOUNT_SCALE) <= 0n
  ) {
    throw new Error("A requirement amount greater than zero is required.");
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("The expiry date is invalid.");

  const maxRedemptions =
    input.maxRedemptions === null || input.maxRedemptions === undefined || !Number.isFinite(Number(input.maxRedemptions))
      ? null
      : Math.max(1, Math.trunc(Number(input.maxRedemptions)));

  const payload = {
    name,
    description: (input.description ?? "").trim(),
    category: input.category,
    amount,
    asset: (input.asset || "USDT").trim().toUpperCase(),
    requirement_type: input.requirementType,
    requirement_amount: requirementAmount,
    requirement_count: requirementCount,
    requirement_tier_id: requirementTierId,
    max_redemptions: maxRedemptions,
    active: input.active !== false,
    priority: Number.isFinite(Number(input.priority)) ? Math.trunc(Number(input.priority)) : 0,
    expires_at: expiresAt,
    updated_by: adminId
  };

  let row: Reward;
  if (input.rewardId) {
    const found = await Reward.findByPk(input.rewardId);
    if (!found) throw new Error("Reward not found");
    Object.assign(found, payload);
    found.updated_at = new Date();
    await found.save();
    row = found;
  } else {
    row = await Reward.create({ ...payload, created_by: adminId });
  }

  await AdminAuditLog.create({
    admin_id: adminId,
    action: input.rewardId ? "reward_updated" : "reward_created",
    entity_type: "reward",
    entity_id: row.reward_id,
    reason: input.reason.trim(),
    metadata: { ...payload, requirement_tier_name: null }
  });

  let tierName: string | null = null;
  if (row.requirement_tier_id) {
    const tier = await MembershipTier.findByPk(row.requirement_tier_id);
    tierName = tier ? tier.name : null;
  }
  return toCatalogEntry(row, tierName);
}

export async function deactivateReward(adminId: string, rewardId: string, reason: string): Promise<RewardCatalogEntry> {
  if (!reason.trim() || reason.trim().length < 3) {
    throw new Error("A reason (at least 3 characters) is required to deactivate a reward.");
  }
  const reward = await Reward.findByPk(rewardId);
  if (!reward) throw new Error("Reward not found");
  reward.active = false;
  reward.updated_by = adminId;
  reward.updated_at = new Date();
  await reward.save();
  await AdminAuditLog.create({
    admin_id: adminId,
    action: "reward_deactivated",
    entity_type: "reward",
    entity_id: reward.reward_id,
    reason: reason.trim(),
    metadata: { name: reward.name, category: reward.category }
  });
  let tierName: string | null = null;
  if (reward.requirement_tier_id) {
    const tier = await MembershipTier.findByPk(reward.requirement_tier_id);
    tierName = tier ? tier.name : null;
  }
  return toCatalogEntry(reward, tierName);
}

export async function deleteReward(adminId: string, rewardId: string, reason: string): Promise<{ rewardId: string }> {
  if (!reason.trim() || reason.trim().length < 3) {
    throw new Error("A reason (at least 3 characters) is required to remove a reward.");
  }
  const reward = await Reward.findByPk(rewardId);
  if (!reward) throw new Error("Reward not found");
  const issued = await UserReward.count({ where: { reward_id: rewardId } });
  if (issued > 0) {
    throw new Error(
      "This reward has already been granted to users. Deactivate it instead so the reward history stays intact."
    );
  }
  await reward.destroy();
  await AdminAuditLog.create({
    admin_id: adminId,
    action: "reward_removed",
    entity_type: "reward",
    entity_id: rewardId,
    reason: reason.trim(),
    metadata: { name: reward.name, category: reward.category }
  });
  return { rewardId };
}

export async function grantRewardToUser(adminId: string, input: RewardGrantInput): Promise<UserReward> {
  if (!input.reason.trim() || input.reason.trim().length < 3) {
    throw new Error("A reason (at least 3 characters) is required to grant a reward.");
  }
  const user = await User.findByPk(input.userId);
  if (!user) throw new Error("User not found");

  let reward: Reward | null = null;
  if (input.rewardId) {
    reward = await Reward.findByPk(input.rewardId);
    if (!reward) throw new Error("Reward not found");
  }

  const amount = normalizeRewardAmount(input.amount ?? (reward ? reward.amount : ZERO_REWARD));
  if (parseDecimal(amount, REWARD_AMOUNT_SCALE) <= 0n) {
    throw new Error("The reward amount must be greater than zero.");
  }

  const rawCategory = input.category ?? (reward ? reward.category : "special");
  const category = isRewardCategory(rawCategory) ? rawCategory : "special";
  const name = (input.name ?? (reward ? reward.name : "")).trim() || "Manual reward";
  const asset = (input.asset ?? (reward ? reward.asset : "USDT")).trim().toUpperCase();

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : reward ? reward.expires_at : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new Error("The expiry date is invalid.");

  const requirementType = reward ? requirementOf(reward.requirement_type) : "manual";

  const created = await issueReward({
    user,
    rewardId: reward ? reward.reward_id : null,
    name,
    description: reward ? reward.description : "",
    amount,
    asset,
    category,
    grantSource: "admin",
    grantedBy: adminId,
    reason: input.reason.trim(),
    expiresAt,
    requirementType,
    // An administrator grant counts as investment earnings by default. Passing
    // countAsInvestmentEarnings: false keeps it as a promotional credit only.
    countAsEarnings: input.countAsInvestmentEarnings !== false
  });
  if (!created) throw new Error("This user already holds this reward.");

  await AdminAuditLog.create({
    admin_id: adminId,
    action: "user_reward_granted",
    entity_type: "user_reward",
    entity_id: created.user_reward_id,
    reason: input.reason.trim(),
    metadata: {
      userId: user.user_id,
      rewardId: reward ? reward.reward_id : null,
      name,
      amount,
      asset,
      category,
      countAsInvestmentEarnings: input.countAsInvestmentEarnings !== false
    }
  });

  return created;
}

export async function revokeUserReward(adminId: string, userRewardId: string, reason: string): Promise<UserReward> {
  if (!reason.trim() || reason.trim().length < 3) {
    throw new Error("A reason (at least 3 characters) is required to revoke a reward.");
  }
  const row = await sequelize.transaction(async (transaction) => {
    const found = await UserReward.findByPk(userRewardId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!found) throw new Error("Reward not found");
    const display = resolveDisplayStatus(found.status, found.expires_at);
    if (display === "redeemed") throw new Error("A redeemed reward cannot be revoked.");
    if (display === "revoked") throw new Error("This reward has already been revoked.");

    const amount = normalizeRewardAmount(found.amount);
    await postBalancedEntry({
      userId: found.user_id,
      asset: found.asset,
      amount,
      transactionType: REWARD_REVERSAL_TRANSACTION_TYPE,
      sourceType: REWARD_REVERSAL_SOURCE_TYPE,
      sourceId: userRewardId,
      debit: REWARD_HOLDING_ACCOUNT,
      credit: REWARD_RELEASE_ACCOUNT,
      transaction
    });

    if (rewardEarningsCredited(found)) {
      // The grant also credited the user's unsettled investment earnings; the
      // reversal must unwind that leg and lower the pending earnings figure so
      // the reported earnings stay consistent with the ledger.
      await postBalancedEntry({
        userId: found.user_id,
        asset: found.asset,
        amount,
        transactionType: REWARD_EARNINGS_TRANSACTION_TYPE,
        sourceType: REWARD_EARNINGS_REVERSAL_SOURCE_TYPE,
        sourceId: userRewardId,
        debit: REWARD_EARNINGS_HOLDING_ACCOUNT,
        credit: REWARD_EARNINGS_RELEASE_ACCOUNT,
        transaction
      });
      const owner = await User.findByPk(found.user_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (owner) {
        const remaining = pendingEarningsUnits(owner) - parseDecimal(amount, REWARD_AMOUNT_SCALE);
        owner.pending_earnings = {
          total: Number(formatDecimal(remaining > 0n ? remaining : 0n, REWARD_AMOUNT_SCALE))
        };
        await owner.save({ transaction });
      }
    }

    found.status = "revoked";
    found.revoked_by = adminId;
    found.revoked_at = new Date();
    found.revoke_reason = reason.trim();
    found.updated_at = new Date();
    await found.save({ transaction });
    return found;
  });

  await AdminAuditLog.create({
    admin_id: adminId,
    action: "user_reward_revoked",
    entity_type: "user_reward",
    entity_id: userRewardId,
    reason: reason.trim(),
    metadata: { userId: row.user_id, name: row.reward_name, amount: row.amount, asset: row.asset }
  });

  await Notification.create({
    user_id: row.user_id,
    type: "reward_revoked",
    message: `Reward ${row.reward_name} was revoked. Reason: ${reason.trim()}`
  });
  const revokedOwner = await User.findByPk(row.user_id);
  if (revokedOwner) {
    await dispatchNotificationEmail({
      user: revokedOwner,
      type: "reward_revoked",
      message: `Reward ${row.reward_name} was revoked. Reason: ${reason.trim()}`,
      email: {
        sourceId: userRewardId,
        subject: `Reward update: ${row.reward_name}`,
        heading: "Reward update",
        preheader: "A reward on your account has been updated.",
        details: [
          { label: "Reward", value: row.reward_name },
          { label: "Amount", value: `${normalizeRewardAmount(row.amount)} ${row.asset}` },
          { label: "Asset", value: String(row.asset) },
          { label: "Date", value: new Date().toISOString() }
        ],
        statusLabel: "Revoked",
        statusTone: "negative",
        ctaLabel: "View rewards",
        ctaPath: "/rewards"
      }
    });
  }

  await trackUserActivity(row.user_id, "reward_revoked", {
    userRewardId,
    name: row.reward_name,
    amount: normalizeRewardAmount(row.amount),
    reason: reason.trim()
  });

  return row;
}

export async function listUserRewardsForAdmin(query: Record<string, unknown>) {
  const page = pageFrom(query.page, 1, 100000);
  const pageSize = pageFrom(query.pageSize, 20, 200);
  const where: WhereOptions = {};
  if (query.userId) where.user_id = String(query.userId);
  if (query.status) where.status = String(query.status);
  if (query.category) where.category = String(query.category);

  const { rows, count } = await UserReward.findAndCountAll({
    where,
    order: [["granted_at", "DESC"]],
    limit: pageSize,
    offset: (page - 1) * pageSize
  });

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const users = userIds.length
    ? await User.findAll({ where: { user_id: { [Op.in]: userIds } } })
    : [];
  const byId = new Map(users.map((user) => [user.user_id, user]));

  return {
    page,
    pageSize,
    total: count,
    rewards: rows.map((row) => {
      const owner = byId.get(row.user_id);
      return {
        ...toHistoryEntry(row),
        userId: row.user_id,
        userName: owner ? owner.name : "",
        userEmail: owner ? owner.email : "",
        grantReason: row.grant_reason,
        grantSource: row.grant_source,
        revokeReason: row.revoke_reason,
        redemptionReference: row.redemption_reference
      };
    })
  };
}

export async function rewardAdminSummary(): Promise<RewardAdminSummary> {
  const [catalog, grants, tiers] = await Promise.all([
    Reward.findAll({ order: [["priority", "DESC"], ["created_at", "DESC"]] }),
    UserReward.findAll({ order: [["granted_at", "DESC"]] }),
    MembershipTier.findAll()
  ]);
  const tierNames = new Map(tiers.map((tier) => [tier.tier_id, tier.name]));

  const granted = grants.reduce(
    (total, row) => total + parseDecimal(normalizeRewardAmount(row.amount), REWARD_AMOUNT_SCALE),
    0n
  );
  const redeemedRows = grants.filter((row) => resolveDisplayStatus(row.status, row.expires_at) === "redeemed");
  const pendingRows = grants.filter((row) => resolveDisplayStatus(row.status, row.expires_at) === "pending");
  const availableRows = grants.filter((row) => resolveDisplayStatus(row.status, row.expires_at) === "available");

  const campaignPerformance: RewardCampaignPerformance[] = catalog.map((reward) => {
    const scoped = grants.filter((row) => row.reward_id === reward.reward_id);
    const scopedRedeemed = scoped.filter(
      (row) => resolveDisplayStatus(row.status, row.expires_at) === "redeemed"
    );
    const category = categoryOf(reward.category);
    return {
      rewardId: reward.reward_id,
      name: reward.name,
      category,
      categoryLabel: REWARD_CATEGORY_LABEL[category],
      active: reward.active,
      grantedCount: scoped.length,
      grantedTotal: sumAmounts(scoped),
      redeemedCount: scopedRedeemed.length,
      redeemedTotal: sumAmounts(scopedRedeemed)
    };
  });

  const byCategory = REWARD_CATEGORIES.map((id) => {
    const scoped = grants.filter((row) => categoryOf(row.category) === id);
    const scopedRedeemed = scoped.filter(
      (row) => resolveDisplayStatus(row.status, row.expires_at) === "redeemed"
    );
    return {
      id,
      label: REWARD_CATEGORY_LABEL[id],
      grantedCount: scoped.length,
      grantedTotal: sumAmounts(scoped),
      redeemedTotal: sumAmounts(scopedRedeemed)
    };
  });

  return {
    catalogCount: catalog.length,
    activeCount: catalog.filter((reward) => reward.active).length,
    userCount: new Set(grants.map((row) => row.user_id)).size,
    grantCount: grants.length,
    redemptionCount: redeemedRows.length,
    totals: {
      granted: formatDecimal(granted, REWARD_AMOUNT_SCALE),
      redeemed: sumAmounts(redeemedRows),
      pending: sumAmounts(pendingRows),
      available: sumAmounts(availableRows)
    },
    byCategory,
    campaignPerformance,
    recent: grants.slice(0, 12).map(toHistoryEntry),
    catalog: catalog.map((reward) =>
      toCatalogEntry(reward, reward.requirement_tier_id ? tierNames.get(reward.requirement_tier_id) ?? null : null)
    )
  };
}

export async function ensureDefaultRewards(): Promise<void> {
  const existing = await Reward.findAll({ attributes: ["name"] });
  const names = new Set(existing.map((reward) => reward.name));
  const tiers = await MembershipTier.findAll();
  const tierByName = new Map(tiers.map((tier) => [tier.name, tier.tier_id]));

  for (const seed of DEFAULT_REWARDS) {
    if (names.has(seed.name)) continue;
    await Reward.create({
      name: seed.name,
      description: seed.description,
      category: seed.category,
      amount: seed.amount,
      asset: seed.asset,
      requirement_type: seed.requirementType,
      requirement_amount: seed.requirementAmount ?? ZERO_REQUIREMENT,
      requirement_count: seed.requirementCount ?? 0,
      requirement_tier_id: seed.requirementTierName ? tierByName.get(seed.requirementTierName) ?? null : null,
      active: true,
      priority: seed.priority,
      created_by: null,
      updated_by: null
    });
  }
}
