import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import { formatDecimal, multiplyDecimal, parseDecimal } from "../domain/money";
import {
  isApproachingNextTier,
  qualifyTier,
  resolveBenefitState,
  shouldUpgrade,
  tierEligibilityState,
  TierRange,
  validateTierRanges
} from "../domain/membershipRules";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { Deposit } from "../models/Deposit";
import { MembershipBenefit } from "../models/MembershipBenefit";
import { MembershipHistory } from "../models/MembershipHistory";
import { MembershipTier } from "../models/MembershipTier";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { UserBenefitActivation } from "../models/UserBenefitActivation";
import { UserMembership } from "../models/UserMembership";
import { trackUserActivity } from "./activityService";
import { getAllMarketPrices } from "./marketDataService";

const DEFAULT_TIERS = [
  { name: "Bronze", min: "100.00", max: "999.99", sort: 1, icon: "bronze", accent: "#B87333", description: "Entry membership, unlocked from $100 in confirmed deposits.", benefits: ["Discounted platform fees", "Welcome promotional credit"] },
  { name: "Silver", min: "1000.00", max: "4999.99", sort: 2, icon: "silver", accent: "#C0C0C0", description: "Membership for confirmed deposits from $1,000.", benefits: ["Raised withdrawal limits", "Reduced withdrawal fees"] },
  { name: "Gold", min: "5000.00", max: "19999.99", sort: 3, icon: "gold", accent: "#C6A15B", description: "Membership for confirmed deposits from $5,000.", benefits: ["Elevated rewards multiplier", "Early access to campaigns"] },
  { name: "Platinum", min: "20000.00", max: "49999.99", sort: 4, icon: "platinum", accent: "#E5E4E2", description: "Membership for confirmed deposits from $20,000.", benefits: ["Dedicated account specialist", "Expedited payouts"] },
  { name: "Diamond", min: "50000.00", max: "99999.99", sort: 5, icon: "diamond", accent: "#7DD3FC", description: "Membership for confirmed deposits from $50,000.", benefits: ["Higher reward rates", "Increased withdrawal ceilings"] },
  { name: "Private Client", min: "100000.00", max: null, sort: 6, icon: "private", accent: "#F5F5F7", description: "Membership for confirmed deposits of $100,000 or more.", benefits: ["Private client desk", "Scheduled relationship review"] }
];

const DEFAULT_BENEFITS = [
  { code: "member_fee_discount", name: "Discounted platform fees", description: "Your account begins on a discounted platform fee schedule for deposits and withdrawals.", tier: "Bronze", requiresActivation: false, available: true, sort: 1 },
  { code: "welcome_reward_credit", name: "Welcome promotional credit", description: "A welcome promotional credit is added to your rewards balance the moment membership begins. It is a promotional credit, not trading profit.", tier: "Bronze", requiresActivation: false, available: true, sort: 2 },
  { code: "raised_withdrawal_limits", name: "Raised withdrawal limits", description: "Your daily and per-transaction withdrawal limits increase, giving you more freedom to move funds when you need them.", tier: "Silver", requiresActivation: false, available: true, sort: 3 },
  { code: "discounted_withdrawal_fees", name: "Reduced withdrawal fees", description: "Withdrawal fees are reduced across every supported network at your tier, so more of each payout reaches your destination address.", tier: "Silver", requiresActivation: false, available: true, sort: 4 },
  { code: "rewards_multiplier", name: "Elevated rewards multiplier", description: "Qualifying activity earns an elevated reward multiplier, increasing the promotional credits you accumulate.", tier: "Gold", requiresActivation: false, available: true, sort: 5 },
  { code: "campaign_first_access", name: "Early access to campaigns", description: "New promotional campaigns open to you before general release, so you can capture the strongest available reward conditions first.", tier: "Gold", requiresActivation: false, available: true, sort: 6 },
  { code: "dedicated_account_specialist", name: "Dedicated account specialist", description: "A dedicated specialist is assigned to guide your account and respond directly to your requests.", tier: "Platinum", requiresActivation: false, available: true, sort: 7 },
  { code: "expedited_payouts", name: "Expedited payouts", description: "Approved withdrawals are prioritised in the payout queue, shortening the time between your request and the on-chain transaction.", tier: "Platinum", requiresActivation: false, available: true, sort: 8 },
  { code: "elevated_reward_rate", name: "Higher reward rates", description: "Your reward multiplier and campaign rates are raised further, so your standing in the programme compounds.", tier: "Diamond", requiresActivation: false, available: true, sort: 9 },
  { code: "higher_withdrawal_ceilings", name: "Increased withdrawal ceilings", description: "Your withdrawal ceilings are raised again, giving high-value accounts more headroom.", tier: "Diamond", requiresActivation: false, available: true, sort: 10 },
  { code: "private_client_desk", name: "Private client desk", description: "The platform's most exclusive service level, with the highest limits, the lowest fee schedule and a private client desk.", tier: "Private Client", requiresActivation: false, available: true, sort: 11 },
  { code: "relationship_review", name: "Scheduled relationship review", description: "A structured, scheduled account review with the platform operations team. Activate it to request the next available slot.", tier: "Private Client", requiresActivation: true, available: true, sort: 12 }
];

const QUALIFICATION_METRIC = {
  code: "confirmed_deposits_usd",
  label: "Confirmed deposits, priced in USD",
  description:
    "Membership qualification uses the USD value of deposits that have been approved and verified on-chain. Pending, rejected, and unpriced deposits are excluded, and investment gains are never counted as contributed capital."
};

const MEMBERSHIP_RULES = {
  qualificationMetric: QUALIFICATION_METRIC,
  creditedEvents: [
    "Deposits with status Approved, valued at the current market price of the deposited asset"
  ],
  excludedEvents: [
    "Pending or under-review deposits",
    "Rejected or failed deposits",
    "Deposits that cannot be priced with a reliable market price",
    "Investment gains and unrealised performance",
    "Referral rewards and bonus credits"
  ],
  automaticUpgrades: true,
  downgradesSupported: false,
  downgradePolicy:
    "This platform does not lower a membership tier when the confirmed qualifying amount falls. A tier earned from verified deposits is retained, and the platform can review an exception when policy requires it.",
  retentionPolicy: "Benefits remain available while the assigned tier stays in place.",
  manualOverridePolicy:
    "The platform can assign a membership exception. Every manual change records the operator, the previous tier, the new tier, and a reason, and it is written to an immutable audit entry.",
  reviewPeriodDays: null,
  gracePeriodDays: null,
  minimumRetentionAmount: null
};

type MembershipRules = typeof MEMBERSHIP_RULES;

export function getMembershipRules(): MembershipRules {
  return MEMBERSHIP_RULES;
}

function assetSymbol(cryptoType: string): "BTC" | "ETH" | "SOL" | "USDT" | null {
  if (cryptoType === "BTC" || cryptoType === "ETH" || cryptoType === "SOL") return cryptoType;
  if (cryptoType === "ERC20" || cryptoType === "TRC20" || cryptoType === "USDT_ERC20" || cryptoType === "USDT_TRC20") return "USDT";
  return null;
}

function progressBetween(amount: bigint | null, currentMin: bigint, nextMin: bigint | null): number {
  if (amount === null) return 0;
  if (nextMin === null) return amount >= currentMin ? 100 : 0;
  const span = nextMin - currentMin;
  if (span <= 0n) return 100;
  const done = amount - currentMin;
  if (done <= 0n) return 0;
  if (done >= span) return 100;
  return Number((done * 10000n) / span) / 100;
}

function toRange(tier: MembershipTier): TierRange {
  return {
    id: tier.tier_id,
    name: tier.name,
    minCents: parseDecimal(String(tier.min_amount), 2),
    maxCents: tier.max_amount === null ? null : parseDecimal(String(tier.max_amount), 2),
    active: tier.active,
    sortOrder: tier.sort_order
  };
}

function money(cents: bigint): string {
  return formatDecimal(cents, 2);
}

function clip(text: string, max = 240): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export async function ensureDefaultMembershipTiers(): Promise<void> {
  const count = await MembershipTier.count();
  if (count > 0) return;
  for (const tier of DEFAULT_TIERS) {
    await MembershipTier.create({
      name: tier.name,
      description: tier.description,
      min_amount: tier.min,
      max_amount: tier.max,
      benefits: tier.benefits,
      icon: tier.icon,
      theme: { accent: tier.accent },
      sort_order: tier.sort,
      active: true
    });
  }
}

export async function ensureDefaultMembershipBenefits(): Promise<void> {
  const count = await MembershipBenefit.count();
  if (count > 0) return;
  const tiers = await MembershipTier.findAll();
  const byName = new Map(tiers.map((tier) => [tier.name, tier]));
  for (const seed of DEFAULT_BENEFITS) {
    const tier = byName.get(seed.tier);
    if (!tier) continue;
    await MembershipBenefit.create({
      tier_id: tier.tier_id,
      code: seed.code,
      name: seed.name,
      description: seed.description,
      available: seed.available,
      requires_activation: seed.requiresActivation,
      sort_order: seed.sort,
      active: true
    });
  }
}

export async function calculateQualifyingAmount(userId: string): Promise<{ amount: string | null; complete: boolean }> {
  const [deposits, prices] = await Promise.all([
    Deposit.findAll({ where: { user_id: userId, status: "Approved" } }),
    getAllMarketPrices()
  ]);
  let total = 0n;
  const seen = new Set<string>();
  for (const deposit of deposits) {
    if (seen.has(deposit.deposit_id)) continue;
    seen.add(deposit.deposit_id);
    const symbol = assetSymbol(deposit.crypto_type);
    const price = symbol ? prices[symbol]?.price : null;
    if (!symbol || price === undefined || price === null || !Number.isFinite(price) || price <= 0) {
      return { amount: null, complete: false };
    }
    total += multiplyDecimal(Number(deposit.amount).toFixed(8), Number(price).toFixed(8), 8, 8, 2);
  }
  return { amount: formatDecimal(total, 2), complete: true };
}

async function notifyMembershipTierChange(userId: string, fromName: string | null, toName: string, amount: string, benefitCount: number): Promise<void> {
  const transition = fromName ? `You moved from ${fromName} to ${toName}` : `You reached ${toName}`;
  await Notification.create({
    type: "membership_upgrade",
    message: clip(`${transition}. Your confirmed qualifying amount is $${amount}. ${benefitCount} membership benefit${benefitCount === 1 ? "" : "s"} are now available on your account.`),
    user_id: userId
  });
}

async function notifyApproachingNextTier(userId: string, next: MembershipTier, remaining: string): Promise<void> {
  const type = `membership_approaching:${next.tier_id}`;
  const existing = await Notification.findOne({ where: { user_id: userId, type } });
  if (existing) return;
  await Notification.create({
    type,
    message: clip(`You are $${remaining} away from the ${next.name} membership tier. Qualification is based on confirmed, verified deposits only.`),
    user_id: userId
  });
}

async function provisionTierBenefits(
  userId: string,
  current: MembershipTier | null,
  benefits: MembershipBenefit[],
  tierSort: Map<string, number>,
  transaction?: Transaction
): Promise<void> {
  if (!current) return;
  const currentSort = current.sort_order;
  const rows = benefits
    .filter((benefit) => !benefit.requires_activation && benefit.available && (tierSort.get(benefit.tier_id) ?? Number.POSITIVE_INFINITY) <= currentSort)
    .map((benefit) => ({
      user_id: userId,
      benefit_id: benefit.benefit_id,
      activated_at: new Date(),
      note: `Provisioned automatically when ${current.name} was assigned`
    }));
  if (rows.length === 0) return;
  await UserBenefitActivation.bulkCreate(rows, { ignoreDuplicates: true, transaction });
}

export async function syncUserMembership(userId: string, reason = "Qualified from confirmed deposits"): Promise<void> {
  const qualification = await calculateQualifyingAmount(userId);
  const tiers = await MembershipTier.findAll();
  const ranges = tiers.map(toRange);
  const current = await UserMembership.findByPk(userId);
  const amountComplete = qualification.complete && qualification.amount !== null;
  const now = new Date();

  if (current?.manual_tier_id) {
    const manualTier = tiers.find((tier) => tier.tier_id === current.manual_tier_id) ?? null;
    if (manualTier) {
      let dirty = false;
      if (current.tier_id !== manualTier.tier_id) {
        current.tier_id = manualTier.tier_id;
        dirty = true;
      }
      if (amountComplete && current.qualifying_amount !== qualification.amount) {
        current.qualifying_amount = qualification.amount as string;
        dirty = true;
      }
      if (dirty) {
        current.updated_at = now;
        await current.save();
      }
      return;
    }
    current.manual_tier_id = null;
    current.manual_reason = null;
    current.manual_set_at = null;
  }

  if (!amountComplete) {
    if (current) {
      current.updated_at = now;
      await current.save();
    }
    return;
  }

  const amount = qualification.amount as string;
  const derived = qualifyTier(parseDecimal(amount, 2), ranges);
  const derivedSort = derived ? ranges.find((range) => range.id === derived.id)?.sortOrder ?? null : null;
  const currentTier = current?.tier_id ? tiers.find((tier) => tier.tier_id === current.tier_id) ?? null : null;
  const currentSort = currentTier ? currentTier.sort_order : null;

  if (!current) {
    if (!derived) return;
    const createdTier = tiers.find((tier) => tier.tier_id === derived.id) ?? null;
    await UserMembership.create({
      user_id: userId,
      tier_id: derived.id,
      qualifying_amount: amount,
      achieved_at: now,
      reason
    });
    await MembershipHistory.create({
      user_id: userId,
      from_tier_id: null,
      to_tier_id: derived.id,
      qualifying_amount: amount,
      reason,
      source: "automatic",
      actor_admin_id: null
    });
    if (createdTier) {
      const benefitCount = await countBenefitsForTier(createdTier, tiers);
      await provisionTierBenefits(userId, createdTier, await MembershipBenefit.findAll({ where: { active: true } }), new Map(tiers.map((tier) => [tier.tier_id, tier.sort_order])));
      await notifyMembershipTierChange(userId, null, createdTier.name, amount, benefitCount);
    }
    await trackUserActivity(userId, "membership_upgrade", {
      fromTierId: null,
      toTierId: derived.id,
      qualifyingAmount: amount,
      outcome: "automatic"
    });
    return;
  }

  if (!shouldUpgrade(currentSort, derivedSort)) {
    current.qualifying_amount = amount;
    current.updated_at = now;
    await current.save();
    const nextTier = currentTier
      ? tiers.filter((tier) => tier.active && tier.sort_order > currentTier.sort_order).sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
      : null;
    if (nextTier) {
      const amountCents = parseDecimal(amount, 2);
      const nextMin = parseDecimal(String(nextTier.min_amount), 2);
      if (isApproachingNextTier(amountCents, nextMin)) {
        await notifyApproachingNextTier(userId, nextTier, formatDecimal(nextMin - amountCents, 2));
      }
    }
    return;
  }

  const upgradedTier = derived ? tiers.find((tier) => tier.tier_id === derived.id) ?? null : null;
  current.tier_id = derived?.id ?? current.tier_id;
  current.qualifying_amount = amount;
  current.achieved_at = now;
  current.reason = reason;
  current.updated_at = now;
  await current.save();
  await MembershipHistory.create({
    user_id: userId,
    from_tier_id: currentTier?.tier_id ?? null,
    to_tier_id: derived?.id ?? null,
    qualifying_amount: amount,
    reason,
    source: "automatic",
    actor_admin_id: null
  });
  if (upgradedTier) {
    const benefitCount = await countBenefitsForTier(upgradedTier, tiers);
    await provisionTierBenefits(userId, upgradedTier, await MembershipBenefit.findAll({ where: { active: true } }), new Map(tiers.map((tier) => [tier.tier_id, tier.sort_order])));
    await notifyMembershipTierChange(userId, currentTier?.name ?? null, upgradedTier.name, amount, benefitCount);
  }
  await trackUserActivity(userId, "membership_upgrade", {
    fromTierId: currentTier?.tier_id ?? null,
    toTierId: derived?.id ?? null,
    qualifyingAmount: amount,
    outcome: "automatic"
  });
}

async function countBenefitsForTier(tier: MembershipTier, tiers: MembershipTier[]): Promise<number> {
  const sortById = new Map(tiers.map((row) => [row.tier_id, row.sort_order]));
  const benefits = await MembershipBenefit.findAll({ where: { active: true, available: true } });
  return benefits.filter((benefit) => (sortById.get(benefit.tier_id) ?? Number.POSITIVE_INFINITY) <= tier.sort_order).length;
}

export async function getMembershipView(userId: string) {
  await syncUserMembership(userId);
  const [tiers, membership, history, qualification] = await Promise.all([
    MembershipTier.findAll({ order: [["sort_order", "ASC"]] }),
    UserMembership.findByPk(userId),
    MembershipHistory.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]], limit: 100 }),
    calculateQualifyingAmount(userId)
  ]);

  const tierById = new Map(tiers.map((tier) => [tier.tier_id, tier]));
  const tierSort = new Map(tiers.map((tier) => [tier.tier_id, tier.sort_order]));
  const activeTiers = tiers.filter((tier) => tier.active);
  const current = membership?.tier_id ? tierById.get(membership.tier_id) ?? null : null;
  const amountCents = qualification.amount ? parseDecimal(qualification.amount, 2) : null;
  const next = current
    ? activeTiers.filter((tier) => tier.sort_order > current.sort_order).sort((a, b) => a.sort_order - b.sort_order)[0] ?? null
    : activeTiers[0] ?? null;

  const benefitRows = await MembershipBenefit.findAll({ where: { active: true }, order: [["sort_order", "ASC"]] });
  await provisionTierBenefits(userId, current, benefitRows, tierSort);
  const activations = await UserBenefitActivation.findAll({ where: { user_id: userId } });
  const activatedById = new Map(activations.map((row) => [row.benefit_id, row]));

  const benefits = benefitRows.map((benefit) => {
    const requiredSort = tierSort.get(benefit.tier_id) ?? Number.POSITIVE_INFINITY;
    const activation = activatedById.get(benefit.benefit_id) ?? null;
    const state = resolveBenefitState(current ? current.sort_order : null, {
      tierSortOrder: requiredSort,
      available: benefit.available,
      requiresActivation: benefit.requires_activation,
      activated: Boolean(activation)
    });
    const requiredTier = tierById.get(benefit.tier_id) ?? null;
    return {
      benefitId: benefit.benefit_id,
      code: benefit.code,
      name: benefit.name,
      description: benefit.description,
      available: benefit.available,
      requiresActivation: benefit.requires_activation,
      state,
      applicableTierId: benefit.tier_id,
      applicableTierName: requiredTier?.name ?? null,
      activatedAt: activation?.activated_at ?? null
    };
  });

  const remainingCents = next && amountCents !== null
    ? parseDecimal(String(next.min_amount), 2) - amountCents
    : null;
  const remainingToNext = remainingCents !== null
    ? money(remainingCents > 0n ? remainingCents : 0n)
    : null;

  const tierProgress = activeTiers.map((tier) => ({
    tierId: tier.tier_id,
    name: tier.name,
    description: tier.description,
    icon: tier.icon,
    theme: tier.theme,
    minAmount: String(tier.min_amount),
    maxAmount: tier.max_amount === null ? null : String(tier.max_amount),
    sortOrder: tier.sort_order,
    state: tierEligibilityState(current ? current.sort_order : null, tier.sort_order),
    requirement: tier.max_amount === null
      ? `$${String(tier.min_amount)} or more in confirmed deposits`
      : `$${String(tier.min_amount)} – $${String(tier.max_amount)} in confirmed deposits`,
    benefits: benefits
      .filter((benefit) => (tierSort.get(benefit.applicableTierId) ?? Number.POSITIVE_INFINITY) <= tier.sort_order)
      .map((benefit) => ({
        benefitId: benefit.benefitId,
        name: benefit.name,
        description: benefit.description,
        requiresActivation: benefit.requiresActivation,
        state: benefit.state
      }))
  }));

  const status = current
    ? membership?.manual_tier_id
      ? {
          code: "manual_review",
          label: "Active · platform exception",
          description: `This tier was assigned by the platform. ${membership.manual_reason ?? ""}`.trim()
        }
      : {
          code: "active",
          label: "Active",
          description: "Your membership tier was assigned automatically from confirmed, verified deposits."
        }
    : {
        code: "unqualified",
        label: "Not yet qualified",
        description: "No membership tier is assigned until confirmed deposits reach the lowest active tier and every confirmed deposit can be priced."
      };

  return {
    qualificationMetric: QUALIFICATION_METRIC,
    rules: MEMBERSHIP_RULES,
    qualifyingAmount: qualification.amount,
    qualifyingComplete: qualification.complete,
    explanation: current
      ? `This tier is assigned because confirmed deposits price to $${qualification.amount} USD, which meets ${current.name} requirements. Membership does not change investment performance or investment level.`
      : "No membership tier is assigned until confirmed deposits meet the lowest active tier and every confirmed deposit can be priced.",
    status,
    current: current
      ? {
          tierId: current.tier_id,
          name: current.name,
          description: current.description,
          benefits: benefits.filter((benefit) => benefit.state === "active").map((benefit) => benefit.name),
          icon: current.icon,
          theme: current.theme,
          achievedAt: membership?.achieved_at ?? null,
          minAmount: String(current.min_amount),
          maxAmount: current.max_amount === null ? null : String(current.max_amount),
          source: membership?.manual_tier_id ? "admin" : "automatic",
          manualReason: membership?.manual_reason ?? null,
          manualSetAt: membership?.manual_set_at ?? null,
          isHighestTier: next === null
        }
      : null,
    next: next ? { tierId: next.tier_id, name: next.name, minAmount: String(next.min_amount) } : null,
    nextTierBenefits: next
      ? benefits
          .filter(
            (benefit) =>
              (tierSort.get(benefit.applicableTierId) ?? Number.POSITIVE_INFINITY) === next.sort_order
          )
          .map((benefit) => ({ benefitId: benefit.benefitId, name: benefit.name, description: benefit.description, requiresActivation: benefit.requiresActivation }))
      : [],
    remainingToNext,
    progressPercent: progressBetween(amountCents, current ? parseDecimal(String(current.min_amount), 2) : 0n, next ? parseDecimal(String(next.min_amount), 2) : null),
    topTierReached: Boolean(current) && next === null,
    tiers: tierProgress,
    benefits,
    comparison: {
      tiers: activeTiers.map((tier) => ({
        tierId: tier.tier_id,
        name: tier.name,
        minAmount: String(tier.min_amount),
        maxAmount: tier.max_amount === null ? null : String(tier.max_amount),
        isCurrent: current?.tier_id === tier.tier_id
      })),
      benefits: benefits.map((benefit) => ({
        benefitId: benefit.benefitId,
        name: benefit.name,
        description: benefit.description,
        requiresActivation: benefit.requiresActivation,
        includedInTierIds: activeTiers
          .filter((tier) => (tierSort.get(benefit.applicableTierId) ?? Number.POSITIVE_INFINITY) <= tier.sort_order)
          .map((tier) => tier.tier_id),
        availableAtCurrentTier: current
          ? benefit.available && benefit.state !== "locked"
          : false
      }))
    },
    history: history.map((row) => ({
      historyId: row.history_id,
      fromTierId: row.from_tier_id,
      toTierId: row.to_tier_id,
      fromTierName: row.from_tier_id ? tierById.get(row.from_tier_id)?.name ?? null : null,
      toTierName: row.to_tier_id ? tierById.get(row.to_tier_id)?.name ?? null : null,
      qualifyingAmount: String(row.qualifying_amount),
      reason: row.reason,
      source: row.source,
      actorAdminId: row.actor_admin_id,
      createdAt: row.created_at
    }))
  };
}

export async function activateMembershipBenefit(userId: string, benefitId: string) {
  const benefit = await MembershipBenefit.findByPk(benefitId);
  if (!benefit || !benefit.active) throw new Error("Benefit not found");
  if (!benefit.available) throw new Error("This benefit is not currently deliverable.");
  const tiers = await MembershipTier.findAll();
  const tierById = new Map(tiers.map((tier) => [tier.tier_id, tier]));
  const requiredTier = tierById.get(benefit.tier_id) ?? null;
  if (!requiredTier) throw new Error("The benefit tier is not available.");
  const membership = await UserMembership.findByPk(userId);
  const current = membership?.tier_id ? tierById.get(membership.tier_id) ?? null : null;
  if (!current || current.sort_order < requiredTier.sort_order) {
    throw new Error(`The ${benefit.name} benefit requires the ${requiredTier.name} tier or higher.`);
  }
  const [activation, created] = await UserBenefitActivation.findOrCreate({
    where: { user_id: userId, benefit_id: benefit.benefit_id },
    defaults: { user_id: userId, benefit_id: benefit.benefit_id, note: "Activated by the account holder" }
  });
  if (created) {
    await trackUserActivity(userId, "membership_upgrade", {
      outcome: "benefit_activated",
      benefitId: benefit.benefit_id,
      benefitCode: benefit.code
    });
  }
  return {
    benefitId: benefit.benefit_id,
    code: benefit.code,
    name: benefit.name,
    requiresActivation: benefit.requires_activation,
    activatedAt: activation.activated_at,
    alreadyActive: !created
  };
}

export async function saveMembershipTier(adminId: string, input: {
  tierId?: string;
  name: string;
  description: string;
  minAmount: string;
  maxAmount: string | null;
  benefits: string[];
  icon: string;
  accent: string;
  sortOrder: number;
  active: boolean;
  reason: string;
}) {
  const draft = await MembershipTier.findAll();
  const preview: TierRange[] = draft
    .filter((tier) => tier.tier_id !== input.tierId)
    .map(toRange);
  preview.push({
    id: input.tierId || "draft",
    name: input.name,
    minCents: parseDecimal(input.minAmount, 2),
    maxCents: input.maxAmount ? parseDecimal(input.maxAmount, 2) : null,
    active: input.active,
    sortOrder: input.sortOrder
  });
  const invalid = validateTierRanges(preview);
  if (invalid) throw new Error(invalid);
  const payload = {
    name: input.name,
    description: input.description,
    min_amount: input.minAmount,
    max_amount: input.maxAmount,
    benefits: input.benefits,
    icon: input.icon,
    theme: { accent: input.accent },
    sort_order: input.sortOrder,
    active: input.active,
    updated_at: new Date()
  };
  const tier = input.tierId
    ? await MembershipTier.findByPk(input.tierId)
    : null;
  if (input.tierId && !tier) throw new Error("Tier not found");
  const saved = tier ? await tier.update(payload) : await MembershipTier.create(payload);
  await AdminAuditLog.create({
    admin_id: adminId,
    action: input.tierId ? "membership_tier_updated" : "membership_tier_created",
    entity_type: "membership_tier",
    entity_id: saved.tier_id,
    reason: input.reason,
    metadata: { name: saved.name, active: saved.active }
  });
  return saved;
}

export async function deactivateTier(adminId: string, tierId: string, reason: string) {
  const tier = await MembershipTier.findByPk(tierId);
  if (!tier) throw new Error("Tier not found");
  tier.active = false;
  tier.updated_at = new Date();
  await tier.save();
  const tiers = (await MembershipTier.findAll()).map(toRange);
  const invalid = validateTierRanges(tiers);
  if (invalid) {
    tier.active = true;
    await tier.save();
    throw new Error(invalid);
  }
  await AdminAuditLog.create({
    admin_id: adminId,
    action: "membership_tier_deactivated",
    entity_type: "membership_tier",
    entity_id: tierId,
    reason,
    metadata: {}
  });
}

export async function deleteTier(tierId: string) {
  const [holders, history] = await Promise.all([
    UserMembership.count({ where: { tier_id: tierId } }),
    MembershipHistory.count({ where: { [Op.or]: [{ from_tier_id: tierId }, { to_tier_id: tierId }] } })
  ]);
  if (holders > 0 || history > 0) {
    throw new Error("Tier has members or history and cannot be deleted. Deactivate it instead.");
  }
  const tier = await MembershipTier.findByPk(tierId);
  if (!tier) throw new Error("Tier not found");
  await tier.destroy();
}

export async function saveMembershipBenefit(adminId: string, input: {
  benefitId?: string;
  tierId: string;
  code: string;
  name: string;
  description: string;
  available: boolean;
  requiresActivation: boolean;
  sortOrder: number;
  active: boolean;
  reason: string;
}) {
  if (!input.reason || input.reason.trim().length < 3) {
    throw new Error("A reason of at least 3 characters is required.");
  }
  const tier = await MembershipTier.findByPk(input.tierId);
  if (!tier) throw new Error("Membership tier not found");
  const code = input.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (code.length < 3) throw new Error("A benefit code of at least 3 characters is required.");
  const duplicate = await MembershipBenefit.findOne({ where: { code } });
  if (duplicate && duplicate.benefit_id !== input.benefitId) {
    throw new Error("A benefit with this code already exists.");
  }
  const payload = {
    tier_id: tier.tier_id,
    code,
    name: input.name,
    description: input.description,
    available: input.available,
    requires_activation: input.requiresActivation,
    sort_order: input.sortOrder,
    active: input.active,
    updated_at: new Date()
  };
  const benefit = input.benefitId ? await MembershipBenefit.findByPk(input.benefitId) : null;
  if (input.benefitId && !benefit) throw new Error("Benefit not found");
  const saved = benefit ? await benefit.update(payload) : await MembershipBenefit.create(payload);
  await AdminAuditLog.create({
    admin_id: adminId,
    action: benefit ? "membership_benefit_updated" : "membership_benefit_created",
    entity_type: "membership_benefit",
    entity_id: saved.benefit_id,
    reason: input.reason,
    metadata: { code: saved.code, tierId: saved.tier_id, available: saved.available, active: saved.active }
  });
  return saved;
}

export async function deleteMembershipBenefit(adminId: string, benefitId: string, reason: string) {
  if (!reason || reason.trim().length < 3) {
    throw new Error("A reason of at least 3 characters is required.");
  }
  const benefit = await MembershipBenefit.findByPk(benefitId);
  if (!benefit) throw new Error("Benefit not found");
  const activations = await UserBenefitActivation.count({ where: { benefit_id: benefitId } });
  if (activations > 0) {
    benefit.active = false;
    benefit.updated_at = new Date();
    await benefit.save();
  } else {
    await benefit.destroy();
  }
  await AdminAuditLog.create({
    admin_id: adminId,
    action: activations > 0 ? "membership_benefit_deactivated" : "membership_benefit_deleted",
    entity_type: "membership_benefit",
    entity_id: benefitId,
    reason,
    metadata: { code: benefit.code, activations }
  });
  return { deactivated: activations > 0 };
}

export async function membershipAdminSummary() {
  const [tiers, memberships, benefitRows] = await Promise.all([
    MembershipTier.findAll({ order: [["sort_order", "ASC"]] }),
    UserMembership.findAll(),
    MembershipBenefit.findAll({ order: [["sort_order", "ASC"]] })
  ]);
  const tierById = new Map(tiers.map((tier) => [tier.tier_id, tier]));
  const distribution = tiers.map((tier) => ({
    tierId: tier.tier_id,
    name: tier.name,
    active: tier.active,
    minAmount: String(tier.min_amount),
    maxAmount: tier.max_amount === null ? null : String(tier.max_amount),
    description: tier.description,
    icon: tier.icon,
    theme: tier.theme,
    sortOrder: tier.sort_order,
    users: memberships.filter((row) => row.tier_id === tier.tier_id).length,
    benefits: benefitRows
      .filter((benefit) => benefit.tier_id === tier.tier_id)
      .map((benefit) => ({
        benefitId: benefit.benefit_id,
        code: benefit.code,
        name: benefit.name,
        description: benefit.description,
        available: benefit.available,
        requiresActivation: benefit.requires_activation,
        active: benefit.active,
        sortOrder: benefit.sort_order
      }))
  }));

  const approaching: Array<{ userId: string; email: string; currentTier: string; nextTier: string; remaining: string }> = [];
  for (const membership of memberships) {
    if (!membership.tier_id) continue;
    const current = tierById.get(membership.tier_id) ?? null;
    if (!current) continue;
    const next = tiers
      .filter((tier) => tier.active && tier.sort_order > current.sort_order)
      .sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
    if (!next) continue;
    const amountCents = parseDecimal(String(membership.qualifying_amount), 2);
    const nextMin = parseDecimal(String(next.min_amount), 2);
    if (!isApproachingNextTier(amountCents, nextMin)) continue;
    const user = await User.findByPk(membership.user_id);
    approaching.push({
      userId: membership.user_id,
      email: user?.email ?? "",
      currentTier: current.name,
      nextTier: next.name,
      remaining: formatDecimal(nextMin - amountCents, 2)
    });
  }

  const overrideUsers = memberships
    .filter((row) => row.manual_tier_id)
    .map((row) => ({
      userId: row.user_id,
      tierId: row.manual_tier_id,
      tierName: row.manual_tier_id ? tierById.get(row.manual_tier_id)?.name ?? null : null,
      reason: row.manual_reason,
      setAt: row.manual_set_at,
      qualifyingAmount: String(row.qualifying_amount)
    }));

  const historyRows = await MembershipHistory.findAll({ order: [["created_at", "DESC"]], limit: 60 });
  const history = historyRows.map((row) => ({
    historyId: row.history_id,
    userId: row.user_id,
    fromTierId: row.from_tier_id,
    toTierId: row.to_tier_id,
    fromTierName: row.from_tier_id ? tierById.get(row.from_tier_id)?.name ?? null : null,
    toTierName: row.to_tier_id ? tierById.get(row.to_tier_id)?.name ?? null : null,
    qualifyingAmount: String(row.qualifying_amount),
    reason: row.reason,
    source: row.source,
    actorAdminId: row.actor_admin_id,
    createdAt: row.created_at
  }));

  return {
    rules: MEMBERSHIP_RULES,
    distribution,
    approaching,
    overrides: overrideUsers,
    history,
    benefits: benefitRows.map((benefit) => ({
      benefitId: benefit.benefit_id,
      tierId: benefit.tier_id,
      code: benefit.code,
      name: benefit.name,
      description: benefit.description,
      available: benefit.available,
      requiresActivation: benefit.requires_activation,
      sortOrder: benefit.sort_order,
      active: benefit.active
    }))
  };
}

export async function membershipAdminUsers(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const tiers = await MembershipTier.findAll({ order: [["sort_order", "ASC"]] });
  const tierById = new Map(tiers.map((tier) => [tier.tier_id, tier]));

  const where: Record<string | symbol, unknown> = {};
  const q = String(query.q || "").trim();
  if (q) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${q}%` } },
      { name: { [Op.iLike]: `%${q}%` } },
      { user_id: q }
    ];
  }
  const tierFilter = String(query.tierId || "");
  if (tierFilter) {
    const members = await UserMembership.findAll({ where: { tier_id: tierFilter }, attributes: ["user_id"] });
    where.user_id = { [Op.in]: members.map((member) => member.user_id) };
  }

  const statusFilter = String(query.status || "");
  const build = async (rows: User[]) => {
    const mapped = [];
    for (const user of rows) {
      const membership = await UserMembership.findByPk(user.user_id);
      const tier = membership?.tier_id ? tierById.get(membership.tier_id) ?? null : null;
      mapped.push({
        userId: user.user_id,
        name: user.name,
        email: user.email,
        tierId: tier?.tier_id ?? null,
        tierName: tier?.name ?? null,
        qualifyingAmount: membership ? String(membership.qualifying_amount) : "0.00",
        achievedAt: membership?.achieved_at ?? null,
        status: tier ? (membership?.manual_tier_id ? "manual_review" : "active") : "unqualified",
        manualReason: membership?.manual_reason ?? null,
        reason: membership?.reason ?? null
      });
    }
    return mapped;
  };

  if (statusFilter) {
    const all = await User.findAll({ where, order: [["created_at", "DESC"]] });
    const mapped = await build(all);
    const filtered = mapped.filter((row) => row.status === statusFilter);
    return {
      page,
      pageSize,
      total: filtered.length,
      users: filtered.slice(offset, offset + pageSize),
      tiers: tiers.map((tier) => ({ tierId: tier.tier_id, name: tier.name, sortOrder: tier.sort_order, active: tier.active }))
    };
  }

  const { rows, count } = await User.findAndCountAll({ where, limit: pageSize, offset, order: [["created_at", "DESC"]] });
  return {
    page,
    pageSize,
    total: count,
    users: await build(rows),
    tiers: tiers.map((tier) => ({ tierId: tier.tier_id, name: tier.name, sortOrder: tier.sort_order, active: tier.active }))
  };
}

export async function adminAdjustMembership(adminId: string, userId: string, tierId: string | null, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("A reason of at least 3 characters is required.");
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");
  const tiers = await MembershipTier.findAll();
  const target = tierId ? tiers.find((tier) => tier.tier_id === tierId) ?? null : null;
  if (tierId && !target) throw new Error("Membership tier not found");

  const result = await sequelize.transaction(async (transaction) => {
    const membership = await UserMembership.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const fromTier = membership?.tier_id ? tiers.find((tier) => tier.tier_id === membership.tier_id) ?? null : null;
    if (membership && membership.manual_tier_id === (target?.tier_id ?? null) && membership.manual_reason === trimmed) {
      return { changed: false, qualifyingAmount: String(membership.qualifying_amount) };
    }
    const now = new Date();
    const qualifyingAmount = membership ? String(membership.qualifying_amount) : "0.00";
    if (!membership) {
      await UserMembership.create({
        user_id: userId,
        tier_id: target?.tier_id ?? null,
        qualifying_amount: qualifyingAmount,
        achieved_at: now,
        reason: trimmed,
        manual_tier_id: target?.tier_id ?? null,
        manual_reason: trimmed,
        manual_set_at: now
      }, { transaction });
    } else {
      membership.tier_id = target?.tier_id ?? null;
      membership.manual_tier_id = target?.tier_id ?? null;
      membership.manual_reason = trimmed;
      membership.manual_set_at = now;
      membership.achieved_at = now;
      membership.reason = trimmed;
      membership.updated_at = now;
      await membership.save({ transaction });
    }
    await MembershipHistory.create({
      user_id: userId,
      from_tier_id: fromTier?.tier_id ?? null,
      to_tier_id: target?.tier_id ?? null,
      qualifying_amount: qualifyingAmount,
      reason: trimmed,
      source: "admin",
      actor_admin_id: adminId
    }, { transaction });
    await AdminAuditLog.create({
      admin_id: adminId,
      action: "membership_adjusted",
      entity_type: "user_membership",
      entity_id: userId,
      reason: trimmed,
      metadata: {
        fromTierId: fromTier?.tier_id ?? null,
        fromTierName: fromTier?.name ?? null,
        toTierId: target?.tier_id ?? null,
        toTierName: target?.name ?? null
      }
    }, { transaction });
    return { changed: true, qualifyingAmount };
  });

  if (result.changed) {
    await Notification.create({
      type: "membership_status",
      message: clip(`The platform reviewed your membership. Your tier is now ${target?.name ?? "unassigned"}. Recorded reason: ${trimmed}`),
      user_id: userId
    });
    await trackUserActivity(userId, "membership_upgrade", {
      outcome: "admin_adjustment",
      toTierId: target?.tier_id ?? null
    });
    await trackUserActivity(adminId, "admin_action", {
      action: "membership_adjusted",
      targetUserId: userId,
      toTierId: target?.tier_id ?? null
    });
  }
  return result;
}

export async function clearMembershipOverride(adminId: string, userId: string, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("A reason of at least 3 characters is required.");
  const tiers = await MembershipTier.findAll();
  const result = await sequelize.transaction(async (transaction) => {
    const membership = await UserMembership.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!membership) throw new Error("Membership record not found");
    if (!membership.manual_tier_id) return { changed: false };
    const fromTier = membership.manual_tier_id ? tiers.find((tier) => tier.tier_id === membership.manual_tier_id) ?? null : null;
    membership.manual_tier_id = null;
    membership.manual_reason = null;
    membership.manual_set_at = null;
    membership.updated_at = new Date();
    await membership.save({ transaction });
    await MembershipHistory.create({
      user_id: userId,
      from_tier_id: fromTier?.tier_id ?? null,
      to_tier_id: null,
      qualifying_amount: String(membership.qualifying_amount),
      reason: trimmed,
      source: "admin",
      actor_admin_id: adminId
    }, { transaction });
    await AdminAuditLog.create({
      admin_id: adminId,
      action: "membership_override_cleared",
      entity_type: "user_membership",
      entity_id: userId,
      reason: trimmed,
      metadata: { fromTierId: fromTier?.tier_id ?? null, fromTierName: fromTier?.name ?? null }
    }, { transaction });
    return { changed: true };
  });

  if (result.changed) {
    await syncUserMembership(userId, "Platform cleared the manual membership exception");
    await Notification.create({
      type: "membership_status",
      message: clip(`The platform cleared the manual membership exception on your account. Your tier is now recalculated from confirmed, verified deposits. Reason: ${trimmed}`),
      user_id: userId
    });
    await trackUserActivity(adminId, "admin_action", { action: "membership_override_cleared", targetUserId: userId });
  }
  return result;
}
