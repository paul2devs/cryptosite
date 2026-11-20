import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import {
  USD_SCALE,
  depositAssetSymbol,
  isStablecoinDeposit,
  valueDepositInUsd
} from "../domain/depositValuation";
import { formatDecimal, parseDecimal } from "../domain/money";
import {
  isApproachingNextLevel,
  isLevelDowngrade,
  levelJourneyState,
  levelProgress,
  nextLevelAfter,
  qualifyLevel,
  resolveEffectiveLevel,
  resolveInvestmentBenefitState,
  shouldUpgradeLevel,
  validateLevelRanges,
  InvestmentLevelRange
} from "../domain/investmentLevelRules";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { Deposit } from "../models/Deposit";
import { InvestmentLevel } from "../models/InvestmentLevel";
import { InvestmentLevelBenefit } from "../models/InvestmentLevelBenefit";
import { InvestmentLevelHistory } from "../models/InvestmentLevelHistory";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { UserInvestmentLevel } from "../models/UserInvestmentLevel";
import { UserInvestmentLevelBenefit } from "../models/UserInvestmentLevelBenefit";
import { trackUserActivity } from "./activityService";
import { getAllMarketPrices } from "./marketDataService";

interface LevelSeed {
  number: number;
  name: string;
  threshold: string;
  sort: number;
  accent: string;
  description: string;
}

const DEFAULT_LEVELS: LevelSeed[] = [
  { number: 1, name: "Level 1", threshold: "1000.00", sort: 1, accent: "#8B7355", description: "Unlocked at $1,000 of invested principal: reduced platform fees on deposits and withdrawals." },
  { number: 2, name: "Level 2", threshold: "3000.00", sort: 2, accent: "#A98A5C", description: "Unlocked at $3,000: priority on-chain verification so your deposits confirm sooner." },
  { number: 3, name: "Level 3", threshold: "5000.00", sort: 3, accent: "#C6A15B", description: "Unlocked at $5,000: a higher withdrawal allowance for larger payouts." },
  { number: 4, name: "Level 4", threshold: "7000.00", sort: 4, accent: "#CDAD6C", description: "Unlocked at $7,000: discounted withdrawal fees across supported networks." },
  { number: 5, name: "Level 5", threshold: "10000.00", sort: 5, accent: "#D4B87D", description: "Unlocked at $10,000: a rewards accelerator on your qualifying deposits." },
  { number: 6, name: "Level 6", threshold: "12000.00", sort: 6, accent: "#DBC38E", description: "Unlocked at $12,000: early access to new promotional campaigns." },
  { number: 7, name: "Level 7", threshold: "15000.00", sort: 7, accent: "#E0C9A0", description: "Unlocked at $15,000: a priority payout queue for your approved withdrawals." },
  { number: 8, name: "Level 8", threshold: "18000.00", sort: 8, accent: "#E6D2B1", description: "Unlocked at $18,000: a dedicated account strategist for your account." },
  { number: 9, name: "Level 9", threshold: "22000.00", sort: 9, accent: "#EBDBBF", description: "Unlocked at $22,000: elevated referral commissions on the users you invite." },
  { number: 10, name: "Level 10", threshold: "25000.00", sort: 10, accent: "#F5F5F7", description: "Unlocked at $25,000: the private client desk, with maximum limits and the lowest fee schedule." }
];

interface BenefitSeed {
  code: string;
  name: string;
  description: string;
  category: string;
  level: number;
  requiresActivation: boolean;
  sort: number;
}

const DEFAULT_BENEFITS: BenefitSeed[] = [
  { code: "reduced_platform_fees", name: "Fee-advantaged account", description: "Your deposits and withdrawals are processed on a reduced fee schedule, so a smaller share of every movement is consumed by platform charges.", category: "pricing", level: 1, requiresActivation: false, sort: 1 },
  { code: "priority_deposit_verification", name: "Priority deposit verification", description: "Your deposits are queued ahead of standard on-chain verification, so confirmed funds and updated invested principal reach your account faster.", category: "service", level: 2, requiresActivation: false, sort: 2 },
  { code: "higher_withdrawal_allowance", name: "Higher withdrawal allowance", description: "Your daily and per-transaction withdrawal limits are raised, giving you more headroom to move funds whenever you need them.", category: "limits", level: 3, requiresActivation: false, sort: 3 },
  { code: "reduced_withdrawal_fees", name: "Reduced withdrawal fees", description: "Network and platform fees on withdrawals are discounted at your level, so more of each payout arrives at your destination address.", category: "pricing", level: 4, requiresActivation: false, sort: 4 },
  { code: "rewards_accelerator", name: "Rewards accelerator", description: "Qualifying deposits earn an elevated promotional reward rate, accelerating the credits added to your rewards balance. Activate it to enroll in the acceleration programme.", category: "rewards", level: 5, requiresActivation: true, sort: 5 },
  { code: "early_campaign_access", name: "Early access to bonus campaigns", description: "New promotional campaigns open to you before general release, so you can capture the strongest available reward conditions first.", category: "rewards", level: 6, requiresActivation: false, sort: 6 },
  { code: "priority_payout_queue", name: "Priority payout queue", description: "Approved withdrawals are placed at the front of the broadcast queue, shortening the wait between your request and the on-chain transaction.", category: "service", level: 7, requiresActivation: false, sort: 7 },
  { code: "dedicated_account_strategist", name: "Dedicated account strategist", description: "A named specialist is assigned to your account for allocation guidance and account planning. Activate it to book your first strategy session.", category: "service", level: 8, requiresActivation: true, sort: 8 },
  { code: "elevated_referral_commissions", name: "Elevated referral commissions", description: "Referrals you invite are rewarded at an increased commission rate, so your network contributes more to your rewards balance.", category: "rewards", level: 9, requiresActivation: false, sort: 9 },
  { code: "private_client_desk", name: "Private client desk", description: "Maximum limits, the lowest available fee schedule and a private client desk for direct, priority assistance.", category: "service", level: 10, requiresActivation: false, sort: 10 }
];

const QUALIFICATION_METRIC = {
  code: "invested_principal_usd",
  label: "Invested principal, valued in USD",
  description:
    "Investment level qualification uses the USD value of deposits that have been approved and verified on-chain, which forms your invested principal. Pending, rejected, and unpriced deposits are excluded, duplicate events are counted once, and unrealised performance is never counted as contributed capital. Under the platform retention policy, a completed withdrawal or a closed investment does not silently remove qualification that has already been earned."
};

const INVESTMENT_LEVEL_RULES = {
  qualificationMetric: QUALIFICATION_METRIC,
  creditedEvents: [
    "Deposits with status Approved, valued at the current market price of the deposited asset"
  ],
  excludedEvents: [
    "Pending or under-review deposits",
    "Rejected or failed deposits",
    "Duplicate deposit events that do not add a new verified deposit",
    "Deposits that cannot be priced with a reliable market price",
    "Unrealised gains and daily investment performance",
    "Referral rewards and bonus credits"
  ],
  automaticUpgrades: true,
  downgradesSupported: false,
  downgradePolicy:
    "The platform does not automatically lower an investment level when invested principal falls. A level earned from verified deposits is retained, and the platform can review an exception when policy requires it.",
  retentionPolicy:
    "Benefits remain available while the assigned investment level stays in place. Levels are independent from membership tiers and from verified investment performance.",
  manualOverridePolicy:
    "The platform can assign an investment level exception. Every manual change records the operator, the previous level, the new level, and a reason, and it is written to an immutable audit entry.",
  reviewPeriodDays: null as number | null,
  gracePeriodDays: null as number | null,
  minimumRetentionAmount: null as string | null
};

type InvestmentLevelRules = typeof INVESTMENT_LEVEL_RULES;

export function getInvestmentLevelRules(): InvestmentLevelRules {
  return INVESTMENT_LEVEL_RULES;
}

function toRange(level: InvestmentLevel): InvestmentLevelRange {
  return {
    id: level.level_config_id,
    levelNumber: level.level_number,
    thresholdCents: parseDecimal(String(level.qualification_threshold), 2),
    active: level.active,
    sortOrder: level.sort_order
  };
}

function money(cents: bigint): string {
  return formatDecimal(cents, 2);
}

function clip(text: string, max = 240): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function accentOf(theme: { accent?: string } | null | undefined): string {
  const accent = theme?.accent;
  return typeof accent === "string" && accent.length > 0 ? accent : "#C6A15B";
}

export async function ensureDefaultInvestmentLevels(): Promise<void> {
  const count = await InvestmentLevel.count();
  if (count > 0) return;
  for (const level of DEFAULT_LEVELS) {
    await InvestmentLevel.create({
      level_number: level.number,
      name: level.name,
      description: level.description,
      qualification_metric: QUALIFICATION_METRIC.code,
      qualification_threshold: level.threshold,
      icon: `level_${level.number}`,
      theme: { accent: level.accent },
      sort_order: level.sort,
      active: true,
      effective_from: null
    });
  }
}

export async function ensureDefaultInvestmentLevelBenefits(): Promise<void> {
  const count = await InvestmentLevelBenefit.count();
  if (count > 0) return;
  const levels = await InvestmentLevel.findAll();
  const byNumber = new Map(levels.map((level) => [level.level_number, level]));
  for (const seed of DEFAULT_BENEFITS) {
    const level = byNumber.get(seed.level);
    if (!level) continue;
    await InvestmentLevelBenefit.create({
      level_config_id: level.level_config_id,
      code: seed.code,
      name: seed.name,
      description: seed.description,
      category: seed.category,
      available: true,
      requires_activation: seed.requiresActivation,
      sort_order: seed.sort,
      active: true
    });
  }
}

function toTwoDecimals(amountUnits: bigint): bigint {
  const divisor = 10n ** BigInt(USD_SCALE - 2);
  const half = divisor / 2n;
  const negative = amountUnits < 0n;
  const absolute = negative ? -amountUnits : amountUnits;
  const rounded = (absolute + half) / divisor;
  return negative ? -rounded : rounded;
}

/**
 * USD value of the user's approved, verified invested principal.
 *
 * Valuation never depends on a live price being available at read time:
 *   - stablecoins are valued at par (100 USDT = $100, no market conversion);
 *   - volatile assets use the USD value stored when the deposit was approved,
 *     and only fall back to a live price when none was stored;
 *   - a volatile deposit that cannot be valued is excluded and reported as
 *     incomplete instead of collapsing the whole total to zero.
 */
export async function calculateQualifyingInvestment(
  userId: string
): Promise<{ amount: string | null; complete: boolean }> {
  const [deposits, prices] = await Promise.all([
    Deposit.findAll({ where: { user_id: userId, status: "Approved" } }),
    getAllMarketPrices()
  ]);
  let total = 0n;
  let complete = true;
  const seen = new Set<string>();
  for (const deposit of deposits) {
    if (seen.has(deposit.deposit_id)) continue;
    seen.add(deposit.deposit_id);
    const quantity =
      deposit.received_amount === null || deposit.received_amount === undefined
        ? deposit.amount
        : deposit.received_amount;
    if (isStablecoinDeposit(deposit.crypto_type)) {
      const valuation = valueDepositInUsd({ cryptoType: deposit.crypto_type, quantity });
      if (valuation.usd !== null) {
        total += parseDecimal(valuation.usd, USD_SCALE);
        continue;
      }
      complete = false;
      continue;
    }
    const symbol = depositAssetSymbol(deposit.crypto_type);
    const livePrice = symbol ? prices[symbol]?.price : undefined;
    const storedUsd =
      deposit.usd_amount === null || deposit.usd_amount === undefined ? null : deposit.usd_amount;
    if (storedUsd !== null && Number.isFinite(storedUsd) && storedUsd > 0) {
      total += parseDecimal(Number(storedUsd).toFixed(USD_SCALE), USD_SCALE);
      continue;
    }
    const valuation = valueDepositInUsd({ cryptoType: deposit.crypto_type, quantity, price: livePrice ?? null });
    if (valuation.usd !== null) {
      total += parseDecimal(valuation.usd, USD_SCALE);
      continue;
    }
    complete = false;
  }
  return { amount: formatDecimal(toTwoDecimals(total), 2), complete };
}

async function countBenefitsForLevel(level: InvestmentLevel, levels: InvestmentLevel[]): Promise<number> {
  const numberById = new Map(levels.map((row) => [row.level_config_id, row.level_number]));
  const benefits = await InvestmentLevelBenefit.findAll({ where: { active: true, available: true } });
  return benefits.filter(
    (benefit) => (numberById.get(benefit.level_config_id) ?? Number.POSITIVE_INFINITY) <= level.level_number
  ).length;
}

async function provisionLevelBenefits(
  userId: string,
  current: InvestmentLevel | null,
  benefits: InvestmentLevelBenefit[],
  numberById: Map<string, number>,
  transaction?: Transaction
): Promise<void> {
  if (!current) return;
  const rows = benefits
    .filter(
      (benefit) =>
        !benefit.requires_activation &&
        benefit.available &&
        (numberById.get(benefit.level_config_id) ?? Number.POSITIVE_INFINITY) <= current.level_number
    )
    .map((benefit) => ({
      user_id: userId,
      benefit_id: benefit.benefit_id,
      activated_at: new Date(),
      note: `Provisioned automatically when ${current.name} was assigned`
    }));
  if (rows.length === 0) return;
  await UserInvestmentLevelBenefit.bulkCreate(rows, { ignoreDuplicates: true, transaction });
}

async function notifyInvestmentLevelChange(
  userId: string,
  fromName: string | null,
  toName: string,
  amount: string,
  benefitCount: number
): Promise<void> {
  const transition = fromName ? `You advanced from ${fromName} to ${toName}` : `You reached ${toName}`;
  await Notification.create({
    type: "investment_level_upgrade",
    message: clip(
      `${transition}. Your qualifying invested principal is $${amount}. ${benefitCount} investment level benefit${benefitCount === 1 ? "" : "s"} ${
        benefitCount === 1 ? "is" : "are"
      } now available on your account. Investment levels do not guarantee investment performance.`
    ),
    user_id: userId
  });
}

async function notifyApproachingNextLevel(userId: string, next: InvestmentLevel, remaining: string): Promise<void> {
  const type = `investment_level_approaching:${next.level_config_id}`;
  const existing = await Notification.findOne({ where: { user_id: userId, type } });
  if (existing) return;
  await Notification.create({
    type,
    message: clip(
      `You are $${remaining} of invested principal away from ${next.name}. Qualification is based on approved, verified deposits only.`
    ),
    user_id: userId
  });
}

async function recordTransition(input: {
  userId: string;
  from: InvestmentLevel | null;
  to: InvestmentLevel | null;
  amount: string;
  reason: string;
  source: "automatic" | "admin" | "recalculation";
  actorAdminId: string | null;
  transaction?: Transaction;
}): Promise<void> {
  await InvestmentLevelHistory.create(
    {
      user_id: input.userId,
      from_level_id: input.from?.level_config_id ?? null,
      to_level_id: input.to?.level_config_id ?? null,
      from_level_number: input.from?.level_number ?? null,
      to_level_number: input.to?.level_number ?? null,
      from_level_name: input.from?.name ?? null,
      to_level_name: input.to?.name ?? null,
      qualifying_amount: input.amount,
      reason: input.reason,
      source: input.source,
      actor_admin_id: input.actorAdminId
    },
    { transaction: input.transaction }
  );
}

export async function syncUserInvestmentLevel(
  userId: string,
  reason = "Qualified from approved invested principal"
): Promise<void> {
  const qualification = await calculateQualifyingInvestment(userId);
  const levels = await InvestmentLevel.findAll();
  const ranges = levels.map(toRange);
  const numberById = new Map(levels.map((level) => [level.level_config_id, level.level_number]));
  const current = await UserInvestmentLevel.findByPk(userId);
  const amountComplete = qualification.complete && qualification.amount !== null;
  const now = new Date();

  if (current?.manual_level_id) {
    const manualLevel = levels.find((level) => level.level_config_id === current.manual_level_id) ?? null;
    if (manualLevel) {
      let dirty = false;
      if (current.level_config_id !== manualLevel.level_config_id) {
        current.level_config_id = manualLevel.level_config_id;
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
    current.manual_level_id = null;
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
  const amountCents = parseDecimal(amount, 2);
  const derived = qualifyLevel(amountCents, ranges);
  const derivedNumber = derived ? derived.levelNumber : null;
  const currentLevel = current?.level_config_id
    ? levels.find((level) => level.level_config_id === current.level_config_id) ?? null
    : null;
  const currentNumber = currentLevel ? currentLevel.level_number : null;

  if (!current) {
    if (!derived) return;
    const createdLevel = levels.find((level) => level.level_config_id === derived.id) ?? null;
    await UserInvestmentLevel.create({
      user_id: userId,
      level_config_id: derived.id,
      qualifying_amount: amount,
      achieved_at: now,
      reason
    });
    await recordTransition({
      userId,
      from: null,
      to: createdLevel,
      amount,
      reason,
      source: "automatic",
      actorAdminId: null
    });
    if (createdLevel) {
      const benefitCount = await countBenefitsForLevel(createdLevel, levels);
      await provisionLevelBenefits(userId, createdLevel, await InvestmentLevelBenefit.findAll({ where: { active: true } }), numberById);
      await notifyInvestmentLevelChange(userId, null, createdLevel.name, amount, benefitCount);
    }
    await trackUserActivity(userId, "configuration_change", {
      scope: "investment_level",
      fromLevelNumber: null,
      toLevelNumber: derived.levelNumber,
      qualifyingAmount: amount,
      outcome: "automatic"
    });
    return;
  }

  if (!shouldUpgradeLevel(currentNumber, derivedNumber)) {
    current.qualifying_amount = amount;
    current.updated_at = now;
    await current.save();
    const nextRange = nextLevelAfter(currentNumber, ranges);
    const next = nextRange ? levels.find((level) => level.level_config_id === nextRange.id) ?? null : null;
    if (next) {
      const nextThreshold = parseDecimal(String(next.qualification_threshold), 2);
      if (isApproachingNextLevel(amountCents, nextThreshold)) {
        await notifyApproachingNextLevel(userId, next, formatDecimal(nextThreshold - amountCents, 2));
      }
    }
    return;
  }

  const upgradedLevel = derived ? levels.find((level) => level.level_config_id === derived.id) ?? null : null;
  current.level_config_id = derived?.id ?? current.level_config_id;
  current.qualifying_amount = amount;
  current.achieved_at = now;
  current.reason = reason;
  current.updated_at = now;
  await current.save();
  await recordTransition({
    userId,
    from: currentLevel,
    to: upgradedLevel,
    amount,
    reason,
    source: "automatic",
    actorAdminId: null
  });
  if (upgradedLevel) {
    const benefitCount = await countBenefitsForLevel(upgradedLevel, levels);
    await provisionLevelBenefits(userId, upgradedLevel, await InvestmentLevelBenefit.findAll({ where: { active: true } }), numberById);
    await notifyInvestmentLevelChange(userId, currentLevel?.name ?? null, upgradedLevel.name, amount, benefitCount);
  }
  await trackUserActivity(userId, "configuration_change", {
    scope: "investment_level",
    fromLevelNumber: currentNumber,
    toLevelNumber: derived?.levelNumber ?? null,
    qualifyingAmount: amount,
    outcome: "automatic"
  });
}

export async function getInvestmentLevelView(userId: string) {
  await syncUserInvestmentLevel(userId);
  const [levels, userLevel, history, qualification] = await Promise.all([
    InvestmentLevel.findAll({ order: [["level_number", "ASC"]] }),
    UserInvestmentLevel.findByPk(userId),
    InvestmentLevelHistory.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]], limit: 100 }),
    calculateQualifyingInvestment(userId)
  ]);

  const levelById = new Map(levels.map((level) => [level.level_config_id, level]));
  const numberById = new Map(levels.map((level) => [level.level_config_id, level.level_number]));
  const activeLevels = levels.filter((level) => level.active);
  const current = userLevel?.level_config_id ? levelById.get(userLevel.level_config_id) ?? null : null;
  const currentNumber = current ? current.level_number : null;
  const ranges = levels.map(toRange);
  const amountCents = qualification.amount ? parseDecimal(qualification.amount, 2) : null;
  const nextRange = nextLevelAfter(currentNumber, ranges);
  const next = nextRange ? levelById.get(nextRange.id) ?? null : null;
  const remainingCents =
    next && amountCents !== null ? parseDecimal(String(next.qualification_threshold), 2) - amountCents : null;
  const nextThresholdCents = next ? parseDecimal(String(next.qualification_threshold), 2) : null;
  const currentThresholdCents = current ? parseDecimal(String(current.qualification_threshold), 2) : 0n;

  const benefitRows = await InvestmentLevelBenefit.findAll({ where: { active: true }, order: [["sort_order", "ASC"]] });
  await provisionLevelBenefits(userId, current, benefitRows, numberById);
  const activations = await UserInvestmentLevelBenefit.findAll({ where: { user_id: userId } });
  const activatedById = new Map(activations.map((row) => [row.benefit_id, row]));

  const benefits = benefitRows.map((benefit) => {
    const requiredNumber = numberById.get(benefit.level_config_id) ?? Number.POSITIVE_INFINITY;
    const activation = activatedById.get(benefit.benefit_id) ?? null;
    const state = resolveInvestmentBenefitState(currentNumber, {
      levelNumber: requiredNumber,
      available: benefit.available,
      requiresActivation: benefit.requires_activation,
      activated: Boolean(activation)
    });
    const requiredLevel = levelById.get(benefit.level_config_id) ?? null;
    return {
      benefitId: benefit.benefit_id,
      code: benefit.code,
      name: benefit.name,
      description: benefit.description,
      category: benefit.category,
      available: benefit.available,
      requiresActivation: benefit.requires_activation,
      state,
      applicableLevelId: benefit.level_config_id,
      applicableLevelName: requiredLevel?.name ?? null,
      applicableLevelNumber: requiredLevel?.level_number ?? null,
      activatedAt: activation?.activated_at ?? null
    };
  });

  const journey = activeLevels.map((level) => ({
    levelId: level.level_config_id,
    name: level.name,
    levelNumber: level.level_number,
    description: level.description,
    icon: level.icon,
    theme: level.theme,
    threshold: String(level.qualification_threshold),
    effectiveFrom: level.effective_from,
    state: levelJourneyState(currentNumber, next?.level_number ?? null, level.level_number),
    requirement: `$${String(level.qualification_threshold)} or more in approved invested principal`,
    benefits: benefits
      .filter((benefit) => (numberById.get(benefit.applicableLevelId) ?? Number.POSITIVE_INFINITY) <= level.level_number)
      .map((benefit) => ({
        benefitId: benefit.benefitId,
        name: benefit.name,
        description: benefit.description,
        requiresActivation: benefit.requiresActivation,
        state: benefit.state
      }))
  }));

  const status = current
    ? userLevel?.manual_level_id
      ? {
          code: "manual_review",
          label: "Active · platform exception",
          description: `This level was assigned by the platform. ${userLevel.manual_reason ?? ""}`.trim()
        }
      : {
          code: "active",
          label: "Active",
          description: "Your investment level was assigned automatically from approved, verified invested principal."
        }
    : {
        code: "unqualified",
        label: "Not yet qualified",
        description:
          "No investment level is assigned until approved invested principal reaches the lowest active level and every approved deposit can be priced."
      };

  return {
    qualificationMetric: QUALIFICATION_METRIC,
    rules: INVESTMENT_LEVEL_RULES,
    qualifyingAmount: qualification.amount,
    qualifyingComplete: qualification.complete,
    explanation: current
      ? `This level is assigned because approved invested principal prices to $${qualification.amount} USD, which meets ${current.name} requirements. Investment levels are independent of membership tiers and do not guarantee investment performance.`
      : "No investment level is assigned until approved invested principal meets the lowest active level and every approved deposit can be priced.",
    status,
    current: current
      ? {
          levelId: current.level_config_id,
          name: current.name,
          levelNumber: current.level_number,
          description: current.description,
          threshold: String(current.qualification_threshold),
          icon: current.icon,
          theme: { accent: accentOf(current.theme) },
          benefits: benefits.filter((benefit) => benefit.state === "active").map((benefit) => benefit.name),
          achievedAt: userLevel?.achieved_at ?? null,
          source: userLevel?.manual_level_id ? "admin" : "automatic",
          manualReason: userLevel?.manual_reason ?? null,
          manualSetAt: userLevel?.manual_set_at ?? null,
          isHighestLevel: next === null
        }
      : null,
    next: next
      ? {
          levelId: next.level_config_id,
          name: next.name,
          levelNumber: next.level_number,
          threshold: String(next.qualification_threshold)
        }
      : null,
    nextLevelBenefits: next
      ? benefits
          .filter((benefit) => benefit.applicableLevelId === next.level_config_id)
          .map((benefit) => ({
            benefitId: benefit.benefitId,
            name: benefit.name,
            description: benefit.description,
            requiresActivation: benefit.requiresActivation
          }))
      : [],
    remainingToNext: remainingCents !== null ? money(remainingCents > 0n ? remainingCents : 0n) : null,
    progressPercent: levelProgress(amountCents, currentThresholdCents, nextThresholdCents),
    topLevelReached: Boolean(current) && next === null,
    levels: journey,
    benefits,
    comparison: {
      levels: activeLevels.map((level) => ({
        levelId: level.level_config_id,
        name: level.name,
        levelNumber: level.level_number,
        threshold: String(level.qualification_threshold),
        isCurrent: current?.level_config_id === level.level_config_id
      })),
      benefits: benefits.map((benefit) => ({
        benefitId: benefit.benefitId,
        name: benefit.name,
        description: benefit.description,
        category: benefit.category,
        requiresActivation: benefit.requiresActivation,
        includedInLevelIds: activeLevels
          .filter((level) => (numberById.get(benefit.applicableLevelId) ?? Number.POSITIVE_INFINITY) <= level.level_number)
          .map((level) => level.level_config_id),
        availableAtCurrentLevel: current ? benefit.available && benefit.state !== "locked" : false
      }))
    },
    history: history.map((row) => ({
      historyId: row.history_id,
      fromLevelId: row.from_level_id,
      toLevelId: row.to_level_id,
      fromLevelNumber: row.from_level_number,
      toLevelNumber: row.to_level_number,
      fromLevelName: row.from_level_name,
      toLevelName: row.to_level_name,
      qualifyingAmount: String(row.qualifying_amount),
      reason: row.reason,
      source: row.source,
      actorAdminId: row.actor_admin_id,
      createdAt: row.created_at
    }))
  };
}

export async function activateInvestmentLevelBenefit(userId: string, benefitId: string) {
  const benefit = await InvestmentLevelBenefit.findByPk(benefitId);
  if (!benefit || !benefit.active) throw new Error("Benefit not found");
  if (!benefit.available) throw new Error("This benefit is not currently deliverable.");
  const level = await InvestmentLevel.findByPk(benefit.level_config_id);
  if (!level || !level.active) throw new Error("The benefit level is not available.");
  const userLevel = await UserInvestmentLevel.findByPk(userId);
  const current = userLevel?.level_config_id ? await InvestmentLevel.findByPk(userLevel.level_config_id) : null;
  if (!current || current.level_number < level.level_number) {
    throw new Error(`The ${benefit.name} benefit requires ${level.name} or higher.`);
  }
  const [activation, created] = await UserInvestmentLevelBenefit.findOrCreate({
    where: { user_id: userId, benefit_id: benefit.benefit_id },
    defaults: { user_id: userId, benefit_id: benefit.benefit_id, note: "Activated by the account holder" }
  });
  if (created) {
    await trackUserActivity(userId, "configuration_change", {
      scope: "investment_level",
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

function requireReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("A reason of at least 3 characters is required.");
  return trimmed;
}

export async function saveInvestmentLevel(adminId: string, input: {
  levelId?: string;
  levelNumber: number;
  name: string;
  description: string;
  threshold: string;
  icon: string;
  accent: string;
  sortOrder: number;
  active: boolean;
  effectiveFrom: string | null;
  reason: string;
}) {
  const reason = requireReason(input.reason);
  if (input.name.trim().length < 2) throw new Error("A level name of at least 2 characters is required.");
  const existing = await InvestmentLevel.findAll();
  const target = input.levelId ? existing.find((row) => row.level_config_id === input.levelId) ?? null : null;
  if (input.levelId && !target) throw new Error("Investment level not found");
  const preview: InvestmentLevelRange[] = existing
    .filter((row) => row.level_config_id !== input.levelId)
    .map(toRange);
  preview.push({
    id: input.levelId || "draft",
    levelNumber: input.levelNumber,
    thresholdCents: parseDecimal(input.threshold, 2),
    active: input.active,
    sortOrder: input.sortOrder
  });
  const invalid = validateLevelRanges(preview);
  if (invalid) throw new Error(invalid);

  const payload = {
    level_number: input.levelNumber,
    name: input.name.trim(),
    description: input.description,
    qualification_metric: QUALIFICATION_METRIC.code,
    qualification_threshold: formatDecimal(parseDecimal(input.threshold, 2), 2),
    icon: input.icon || `level_${input.levelNumber}`,
    theme: { accent: input.accent || "#C6A15B" },
    sort_order: input.sortOrder,
    active: input.active,
    effective_from: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
    updated_at: new Date()
  };
  const previous = target
    ? {
        name: target.name,
        levelNumber: target.level_number,
        threshold: String(target.qualification_threshold),
        active: target.active
      }
    : null;
  const saved = target ? await target.update(payload) : await InvestmentLevel.create(payload);
  await AdminAuditLog.create({
    admin_id: adminId,
    action: target ? "investment_level_updated" : "investment_level_created",
    entity_type: "investment_level",
    entity_id: saved.level_config_id,
    reason,
    metadata: {
      previous,
      current: {
        name: saved.name,
        levelNumber: saved.level_number,
        threshold: String(saved.qualification_threshold),
        active: saved.active
      }
    }
  });
  return saved;
}

export async function deactivateInvestmentLevel(adminId: string, levelId: string, reason: string) {
  const trimmed = requireReason(reason);
  const level = await InvestmentLevel.findByPk(levelId);
  if (!level) throw new Error("Investment level not found");
  const wasActive = level.active;
  level.active = false;
  level.updated_at = new Date();
  await level.save();
  const ranges = (await InvestmentLevel.findAll()).map(toRange);
  const invalid = validateLevelRanges(ranges);
  if (invalid) {
    level.active = wasActive;
    await level.save();
    throw new Error(invalid);
  }
  await AdminAuditLog.create({
    admin_id: adminId,
    action: "investment_level_deactivated",
    entity_type: "investment_level",
    entity_id: levelId,
    reason: trimmed,
    metadata: { previous: { name: level.name, active: wasActive }, current: { active: false } }
  });
}

export async function deleteInvestmentLevel(levelId: string) {
  const [holders, history] = await Promise.all([
    UserInvestmentLevel.count({ where: { level_config_id: levelId } }),
    InvestmentLevelHistory.count({
      where: { [Op.or]: [{ from_level_id: levelId }, { to_level_id: levelId }] }
    })
  ]);
  if (holders > 0 || history > 0) {
    throw new Error("Level has assigned users or history and cannot be deleted. Deactivate it instead.");
  }
  const benefitCount = await InvestmentLevelBenefit.count({ where: { level_config_id: levelId } });
  if (benefitCount > 0) {
    throw new Error("Remove the level's benefits before deleting it, or deactivate the level instead.");
  }
  const level = await InvestmentLevel.findByPk(levelId);
  if (!level) throw new Error("Investment level not found");
  await level.destroy();
}

export async function saveInvestmentLevelBenefit(adminId: string, input: {
  benefitId?: string;
  levelId: string;
  code: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  requiresActivation: boolean;
  sortOrder: number;
  active: boolean;
  reason: string;
}) {
  const reason = requireReason(input.reason);
  const level = await InvestmentLevel.findByPk(input.levelId);
  if (!level) throw new Error("Investment level not found");
  const code = input.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (code.length < 3) throw new Error("A benefit code of at least 3 characters is required.");
  const duplicate = await InvestmentLevelBenefit.findOne({ where: { code } });
  if (duplicate && duplicate.benefit_id !== input.benefitId) {
    throw new Error("A benefit with this code already exists.");
  }
  const payload = {
    level_config_id: level.level_config_id,
    code,
    name: input.name.trim(),
    description: input.description,
    category: input.category,
    available: input.available,
    requires_activation: input.requiresActivation,
    sort_order: input.sortOrder,
    active: input.active,
    updated_at: new Date()
  };
  const benefit = input.benefitId ? await InvestmentLevelBenefit.findByPk(input.benefitId) : null;
  if (input.benefitId && !benefit) throw new Error("Benefit not found");
  const previous = benefit
    ? { name: benefit.name, code: benefit.code, levelId: benefit.level_config_id, available: benefit.available, active: benefit.active }
    : null;
  const saved = benefit ? await benefit.update(payload) : await InvestmentLevelBenefit.create(payload);
  await AdminAuditLog.create({
    admin_id: adminId,
    action: benefit ? "investment_level_benefit_updated" : "investment_level_benefit_created",
    entity_type: "investment_level_benefit",
    entity_id: saved.benefit_id,
    reason,
    metadata: {
      previous,
      current: { code: saved.code, levelId: saved.level_config_id, available: saved.available, active: saved.active }
    }
  });
  return saved;
}

export async function deleteInvestmentLevelBenefit(adminId: string, benefitId: string, reason: string) {
  const trimmed = requireReason(reason);
  const benefit = await InvestmentLevelBenefit.findByPk(benefitId);
  if (!benefit) throw new Error("Benefit not found");
  const activations = await UserInvestmentLevelBenefit.count({ where: { benefit_id: benefitId } });
  if (activations > 0) {
    benefit.active = false;
    benefit.updated_at = new Date();
    await benefit.save();
  } else {
    await benefit.destroy();
  }
  await AdminAuditLog.create({
    admin_id: adminId,
    action: activations > 0 ? "investment_level_benefit_deactivated" : "investment_level_benefit_deleted",
    entity_type: "investment_level_benefit",
    entity_id: benefitId,
    reason: trimmed,
    metadata: { code: benefit.code, activations }
  });
  return { deactivated: activations > 0 };
}

export async function investmentLevelAdminSummary() {
  const [levels, userLevels, benefitRows] = await Promise.all([
    InvestmentLevel.findAll({ order: [["level_number", "ASC"]] }),
    UserInvestmentLevel.findAll(),
    InvestmentLevelBenefit.findAll({ order: [["sort_order", "ASC"]] })
  ]);
  const levelById = new Map(levels.map((level) => [level.level_config_id, level]));

  const distribution = levels.map((level) => ({
    levelId: level.level_config_id,
    name: level.name,
    levelNumber: level.level_number,
    active: level.active,
    threshold: String(level.qualification_threshold),
    description: level.description,
    icon: level.icon,
    theme: level.theme,
    sortOrder: level.sort_order,
    effectiveFrom: level.effective_from,
    users: userLevels.filter((row) => row.level_config_id === level.level_config_id).length,
    benefits: benefitRows
      .filter((benefit) => benefit.level_config_id === level.level_config_id)
      .map((benefit) => ({
        benefitId: benefit.benefit_id,
        code: benefit.code,
        name: benefit.name,
        description: benefit.description,
        category: benefit.category,
        available: benefit.available,
        requiresActivation: benefit.requires_activation,
        active: benefit.active,
        sortOrder: benefit.sort_order
      }))
  }));

  const approaching: Array<{ userId: string; email: string; currentLevel: string; nextLevel: string; remaining: string }> = [];
  for (const row of userLevels) {
    if (!row.level_config_id) continue;
    const current = levelById.get(row.level_config_id) ?? null;
    if (!current) continue;
    const next = levels
      .filter((level) => level.active && level.level_number > current.level_number)
      .sort((a, b) => a.level_number - b.level_number)[0] ?? null;
    if (!next) continue;
    const amountCents = parseDecimal(String(row.qualifying_amount), 2);
    const nextThreshold = parseDecimal(String(next.qualification_threshold), 2);
    if (!isApproachingNextLevel(amountCents, nextThreshold)) continue;
    const user = await User.findByPk(row.user_id);
    approaching.push({
      userId: row.user_id,
      email: user?.email ?? "",
      currentLevel: current.name,
      nextLevel: next.name,
      remaining: formatDecimal(nextThreshold - amountCents, 2)
    });
  }

  const overrides = userLevels
    .filter((row) => row.manual_level_id)
    .map((row) => ({
      userId: row.user_id,
      levelId: row.manual_level_id,
      levelName: row.manual_level_id ? levelById.get(row.manual_level_id)?.name ?? null : null,
      reason: row.manual_reason,
      setAt: row.manual_set_at,
      qualifyingAmount: String(row.qualifying_amount)
    }));

  const historyRows = await InvestmentLevelHistory.findAll({ order: [["created_at", "DESC"]], limit: 60 });
  const history = historyRows.map((row) => ({
    historyId: row.history_id,
    userId: row.user_id,
    fromLevelId: row.from_level_id,
    toLevelId: row.to_level_id,
    fromLevelNumber: row.from_level_number,
    toLevelNumber: row.to_level_number,
    fromLevelName: row.from_level_name,
    toLevelName: row.to_level_name,
    qualifyingAmount: String(row.qualifying_amount),
    reason: row.reason,
    source: row.source,
    actorAdminId: row.actor_admin_id,
    createdAt: row.created_at
  }));

  return {
    rules: INVESTMENT_LEVEL_RULES,
    metric: QUALIFICATION_METRIC,
    distribution,
    approaching,
    overrides,
    history,
    benefits: benefitRows.map((benefit) => ({
      benefitId: benefit.benefit_id,
      levelId: benefit.level_config_id,
      code: benefit.code,
      name: benefit.name,
      description: benefit.description,
      category: benefit.category,
      available: benefit.available,
      requiresActivation: benefit.requires_activation,
      sortOrder: benefit.sort_order,
      active: benefit.active
    }))
  };
}

export async function investmentLevelAdminUsers(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const levels = await InvestmentLevel.findAll({ order: [["level_number", "ASC"]] });
  const levelById = new Map(levels.map((level) => [level.level_config_id, level]));

  const where: Record<string | symbol, unknown> = {};
  const q = String(query.q || "").trim();
  if (q) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${q}%` } },
      { name: { [Op.iLike]: `%${q}%` } },
      { user_id: q }
    ];
  }
  const levelFilter = String(query.levelId || "");
  if (levelFilter) {
    const holders = await UserInvestmentLevel.findAll({
      where: { level_config_id: levelFilter },
      attributes: ["user_id"]
    });
    where.user_id = { [Op.in]: holders.map((holder) => holder.user_id) };
  }

  const statusFilter = String(query.status || "");
  const build = async (rows: User[]) => {
    const mapped = [];
    for (const user of rows) {
      const record = await UserInvestmentLevel.findByPk(user.user_id);
      const level = record?.level_config_id ? levelById.get(record.level_config_id) ?? null : null;
      mapped.push({
        userId: user.user_id,
        name: user.name,
        email: user.email,
        levelId: level?.level_config_id ?? null,
        levelName: level?.name ?? null,
        levelNumber: level?.level_number ?? null,
        qualifyingAmount: record ? String(record.qualifying_amount) : "0.00",
        achievedAt: record?.achieved_at ?? null,
        status: level ? (record?.manual_level_id ? "manual_review" : "active") : "unqualified",
        manualReason: record?.manual_reason ?? null,
        reason: record?.reason ?? null
      });
    }
    return mapped;
  };

  const levelOptions = levels.map((level) => ({
    levelId: level.level_config_id,
    name: level.name,
    levelNumber: level.level_number,
    active: level.active
  }));

  if (statusFilter) {
    const all = await User.findAll({ where, order: [["created_at", "DESC"]] });
    const mapped = await build(all);
    const filtered = mapped.filter((row) => row.status === statusFilter);
    return {
      page,
      pageSize,
      total: filtered.length,
      users: filtered.slice(offset, offset + pageSize),
      levels: levelOptions
    };
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    limit: pageSize,
    offset,
    order: [["created_at", "DESC"]]
  });
  return {
    page,
    pageSize,
    total: count,
    users: await build(rows),
    levels: levelOptions
  };
}

export async function adminAdjustInvestmentLevel(
  adminId: string,
  userId: string,
  levelId: string | null,
  reason: string
) {
  const trimmed = requireReason(reason);
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");
  const levels = await InvestmentLevel.findAll();
  const target = levelId ? levels.find((level) => level.level_config_id === levelId) ?? null : null;
  if (levelId && !target) throw new Error("Investment level not found");

  const result = await sequelize.transaction(async (transaction) => {
    const record = await UserInvestmentLevel.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const fromLevel = record?.level_config_id
      ? levels.find((level) => level.level_config_id === record.level_config_id) ?? null
      : null;
    if (
      record &&
      record.manual_level_id === (target?.level_config_id ?? null) &&
      record.manual_reason === trimmed
    ) {
      return { changed: false, qualifyingAmount: String(record.qualifying_amount) };
    }
    const now = new Date();
    const qualifyingAmount = record ? String(record.qualifying_amount) : "0.00";
    if (!record) {
      await UserInvestmentLevel.create(
        {
          user_id: userId,
          level_config_id: target?.level_config_id ?? null,
          qualifying_amount: qualifyingAmount,
          achieved_at: now,
          reason: trimmed,
          manual_level_id: target?.level_config_id ?? null,
          manual_reason: trimmed,
          manual_set_at: now
        },
        { transaction }
      );
    } else {
      record.level_config_id = target?.level_config_id ?? null;
      record.manual_level_id = target?.level_config_id ?? null;
      record.manual_reason = trimmed;
      record.manual_set_at = now;
      record.achieved_at = now;
      record.reason = trimmed;
      record.updated_at = now;
      await record.save({ transaction });
    }
    await recordTransition({
      userId,
      from: fromLevel,
      to: target,
      amount: qualifyingAmount,
      reason: trimmed,
      source: "admin",
      actorAdminId: adminId,
      transaction
    });
    await AdminAuditLog.create(
      {
        admin_id: adminId,
        action: "investment_level_adjusted",
        entity_type: "user_investment_level",
        entity_id: userId,
        reason: trimmed,
        metadata: {
          fromLevelId: fromLevel?.level_config_id ?? null,
          fromLevelName: fromLevel?.name ?? null,
          toLevelId: target?.level_config_id ?? null,
          toLevelName: target?.name ?? null
        }
      },
      { transaction }
    );
    return { changed: true, qualifyingAmount };
  });

  if (result.changed) {
    await Notification.create({
      type: "investment_level_status",
      message: clip(
        `The platform reviewed your investment level. Your level is now ${target?.name ?? "unassigned"}. Recorded reason: ${trimmed}`
      ),
      user_id: userId
    });
    await trackUserActivity(userId, "configuration_change", {
      scope: "investment_level",
      outcome: "admin_adjustment",
      toLevelId: target?.level_config_id ?? null
    });
    await trackUserActivity(adminId, "admin_action", {
      action: "investment_level_adjusted",
      targetUserId: userId,
      toLevelId: target?.level_config_id ?? null
    });
  }
  return result;
}

export async function clearInvestmentLevelOverride(adminId: string, userId: string, reason: string) {
  const trimmed = requireReason(reason);
  const levels = await InvestmentLevel.findAll();
  const result = await sequelize.transaction(async (transaction) => {
    const record = await UserInvestmentLevel.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!record) throw new Error("Investment level record not found");
    if (!record.manual_level_id) return { changed: false };
    const fromLevel = levels.find((level) => level.level_config_id === record.manual_level_id) ?? null;
    record.manual_level_id = null;
    record.manual_reason = null;
    record.manual_set_at = null;
    record.updated_at = new Date();
    await record.save({ transaction });
    await recordTransition({
      userId,
      from: fromLevel,
      to: null,
      amount: String(record.qualifying_amount),
      reason: trimmed,
      source: "admin",
      actorAdminId: adminId,
      transaction
    });
    await AdminAuditLog.create(
      {
        admin_id: adminId,
        action: "investment_level_override_cleared",
        entity_type: "user_investment_level",
        entity_id: userId,
        reason: trimmed,
        metadata: { fromLevelId: fromLevel?.level_config_id ?? null, fromLevelName: fromLevel?.name ?? null }
      },
      { transaction }
    );
    return { changed: true };
  });

  if (result.changed) {
    await syncUserInvestmentLevel(userId, "Platform cleared the manual investment level exception");
    await Notification.create({
      type: "investment_level_status",
      message: clip(
        `The platform cleared the manual investment level exception on your account. Your level is now recalculated from approved, verified invested principal. Reason: ${trimmed}`
      ),
      user_id: userId
    });
    await trackUserActivity(adminId, "admin_action", {
      action: "investment_level_override_cleared",
      targetUserId: userId
    });
  }
  return result;
}

export async function recalculateUserInvestmentLevel(adminId: string, userId: string, reason: string) {
  const trimmed = requireReason(reason);
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");
  const before = await UserInvestmentLevel.findByPk(userId);
  const beforeLevelId = before?.level_config_id ?? null;
  const beforeAmount = before ? String(before.qualifying_amount) : "0.00";
  await syncUserInvestmentLevel(userId, `Recalculated by the platform: ${trimmed}`);
  const after = await UserInvestmentLevel.findByPk(userId);
  const afterLevelId = after?.level_config_id ?? null;
  const afterAmount = after ? String(after.qualifying_amount) : "0.00";
  const changed = beforeLevelId !== afterLevelId || beforeAmount !== afterAmount;
  await AdminAuditLog.create({
    admin_id: adminId,
    action: "investment_level_recalculated",
    entity_type: "user_investment_level",
    entity_id: userId,
    reason: trimmed,
    metadata: {
      previous: { levelId: beforeLevelId, qualifyingAmount: beforeAmount },
      current: { levelId: afterLevelId, qualifyingAmount: afterAmount },
      changed
    }
  });
  await trackUserActivity(adminId, "admin_action", {
    action: "investment_level_recalculated",
    targetUserId: userId,
    changed
  });
  return { changed, qualifyingAmount: afterAmount, levelId: afterLevelId };
}
