import { randomUUID } from "crypto";
import { literal, Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import {
  computeWithdrawalFees,
  resolveWithdrawalDefinition,
  validateWithdrawalSubmission,
  WITHDRAWAL_NETWORK_DEFINITIONS,
  WITHDRAWAL_SYMBOLS,
  type WithdrawalCryptoType,
  type WithdrawalFeeBreakdown,
  type WithdrawalLimits,
  type WithdrawalPlatformAsset
} from "../domain/withdrawalRules";
import { Deposit } from "../models/Deposit";
import { User } from "../models/User";
import { Withdrawal } from "../models/Withdrawal";
import { calculateDepositLevelForUser } from "./depositLevelService";
import { postBalancedEntry } from "./financialOperationsService";
import { getAllMarketPrices } from "./marketDataService";

export class WithdrawalError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WithdrawalError";
    this.status = status;
  }
}

function numberFromEnv(key: string, fallback: number, minimum = -Infinity, maximum = Infinity): number {
  const raw = process.env[key];
  const parsed = raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    return fallback;
  }
  return parsed;
}

export function getWithdrawalMinLevel(): number {
  return Math.max(numberFromEnv("WITHDRAWAL_MIN_LEVEL", 5, 1), 5);
}

export function getWithdrawalCooldownHours(): number {
  return numberFromEnv("WITHDRAWAL_COOLDOWN_HOURS", 24, 0);
}

export function getMaxDailyWithdrawal(): number {
  return numberFromEnv("WITHDRAWAL_MAX_DAILY_AMOUNT", 0, 0);
}

export function getPlatformFeePercent(): number {
  return numberFromEnv("WITHDRAWAL_PLATFORM_FEE_PERCENT", 0, 0, 100);
}

export function getNetworkFeeFor(platformAsset: WithdrawalPlatformAsset): number {
  return numberFromEnv(`WITHDRAWAL_NETWORK_FEE_${platformAsset}`, 0, 0);
}

export function getWithdrawalLimitsFor(platformAsset: WithdrawalPlatformAsset): WithdrawalLimits {
  return {
    minAmount: numberFromEnv(`WITHDRAWAL_MIN_AMOUNT_${platformAsset}`, 0, 0),
    maxAmount: numberFromEnv(`WITHDRAWAL_MAX_AMOUNT_${platformAsset}`, 0, 0)
  };
}

export interface SupportedWithdrawalNetwork {
  cryptoType: WithdrawalCryptoType;
  platformAsset: WithdrawalPlatformAsset;
  networkLabel: string;
  networkType: string;
  decimals: number;
  networkFee: number;
  minAmount: number;
  maxAmount: number;
}

export interface SupportedWithdrawalAsset {
  symbol: string;
  name: string;
  networks: SupportedWithdrawalNetwork[];
}

export function supportedWithdrawalAssets(): SupportedWithdrawalAsset[] {
  return WITHDRAWAL_SYMBOLS.map((entry) => ({
    symbol: entry.symbol,
    name: entry.name,
    networks: entry.networks.map((cryptoType) => {
      const definition = WITHDRAWAL_NETWORK_DEFINITIONS[cryptoType];
      const limits = getWithdrawalLimitsFor(definition.platformAsset);
      return {
        cryptoType,
        platformAsset: definition.platformAsset,
        networkLabel: definition.networkLabel,
        networkType: definition.networkType,
        decimals: definition.decimals,
        networkFee: getNetworkFeeFor(definition.platformAsset),
        minAmount: limits.minAmount,
        maxAmount: limits.maxAmount
      };
    })
  }));
}

export function withdrawalFeesFor(
  platformAsset: WithdrawalPlatformAsset,
  amount: number
): WithdrawalFeeBreakdown {
  return computeWithdrawalFees({
    amount,
    networkFee: getNetworkFeeFor(platformAsset),
    platformFeePercent: getPlatformFeePercent()
  });
}

export interface MaturityPolicy {
  enabled: boolean;
  days: number;
  policyVersion: string;
  effectiveAt: Date | null;
  configWarning: string | null;
}

export function getMaturityPolicy(): MaturityPolicy {
  const requested = String(process.env.WITHDRAWAL_MATURITY_ENABLED || "").toLowerCase() === "true";
  const days = numberFromEnv("WITHDRAWAL_MATURITY_DAYS", 14, 0, 90);
  const policyVersion = (process.env.WITHDRAWAL_MATURITY_POLICY_VERSION || "v1").trim() || "v1";
  const rawEffectiveAt = process.env.WITHDRAWAL_MATURITY_EFFECTIVE_AT;
  const parsedEffectiveAt = rawEffectiveAt ? new Date(rawEffectiveAt) : null;
  const effectiveAt =
    parsedEffectiveAt && !Number.isNaN(parsedEffectiveAt.getTime()) ? parsedEffectiveAt : null;

  if (!requested) {
    return {
      enabled: false,
      days,
      policyVersion,
      effectiveAt,
      configWarning: null
    };
  }

  if (days <= 0 || !effectiveAt) {
    return {
      enabled: false,
      days,
      policyVersion,
      effectiveAt,
      configWarning:
        "A maturity period was requested but is not active because WITHDRAWAL_MATURITY_DAYS or WITHDRAWAL_MATURITY_EFFECTIVE_AT is missing. No holding period is being applied."
    };
  }

  return { enabled: true, days, policyVersion, effectiveAt, configWarning: null };
}

export interface MaturityEligibility {
  policyInEffect: boolean;
  policyVersion: string;
  lockupDays: number;
  effectiveAt: string | null;
  startDate: string | null;
  expectedMaturityDate: string | null;
  remainingSeconds: number;
  maturingAmount: number;
  maturedAmount: number;
  eligibleAtMaturity: number;
  reason: string;
  terms: string;
}

const NO_POLICY_TERMS =
  "This platform does not apply a lockup or maturity period to withdrawal balances. Withdrawals are reviewed for security but are not held for a fixed period.";

export async function computeMaturityEligibility(
  user: User,
  transaction?: Transaction
): Promise<MaturityEligibility> {
  const policy = getMaturityPolicy();
  const availableBalance = Number.isFinite(user.withdrawable_balance) ? user.withdrawable_balance : 0;

  if (!policy.enabled || !policy.effectiveAt) {
    return {
      policyInEffect: false,
      policyVersion: policy.policyVersion,
      lockupDays: 0,
      effectiveAt: null,
      startDate: null,
      expectedMaturityDate: null,
      remainingSeconds: 0,
      maturingAmount: 0,
      maturedAmount: availableBalance,
      eligibleAtMaturity: availableBalance,
      reason: policy.configWarning || "No maturity period currently applies to your funds.",
      terms: NO_POLICY_TERMS
    };
  }

  const now = Date.now();
  const deposits = await Deposit.findAll({
    where: {
      user_id: user.user_id,
      status: "Approved",
      confirmed_at: { [Op.gte]: policy.effectiveAt }
    },
    transaction
  });

  let maturingValue = 0;
  let maturedValue = 0;
  let earliestStart: Date | null = null;
  let latestMaturity: Date | null = null;

  if (deposits.length > 0) {
    const prices = await getAllMarketPrices();
    for (const deposit of deposits) {
      const confirmedAt = deposit.confirmed_at ? new Date(deposit.confirmed_at) : null;
      if (!confirmedAt) {
        continue;
      }
      const symbol =
        deposit.crypto_type === "ERC20" || deposit.crypto_type === "TRC20"
          ? "USDT"
          : deposit.crypto_type;
      const pricePoint = (prices as Record<string, { price: number } | undefined>)[symbol];
      const price = pricePoint && Number.isFinite(pricePoint.price) ? pricePoint.price : 0;
      const value = Number(deposit.amount) * price;
      if (!Number.isFinite(value) || value <= 0) {
        continue;
      }
      const maturityAt = new Date(confirmedAt.getTime() + policy.days * 24 * 60 * 60 * 1000);
      if (!earliestStart || confirmedAt < earliestStart) {
        earliestStart = confirmedAt;
      }
      if (maturityAt.getTime() > now) {
        maturingValue += value;
        if (!latestMaturity || maturityAt > latestMaturity) {
          latestMaturity = maturityAt;
        }
      } else {
        maturedValue += value;
      }
    }
  }

  const maturingAmount = Math.min(maturingValue, availableBalance);
  const maturedAmount = Math.max(0, availableBalance - maturingAmount);
  const remainingSeconds = latestMaturity
    ? Math.max(0, Math.floor((latestMaturity.getTime() - now) / 1000))
    : 0;

  return {
    policyInEffect: true,
    policyVersion: policy.policyVersion,
    lockupDays: policy.days,
    effectiveAt: policy.effectiveAt.toISOString(),
    startDate: earliestStart ? earliestStart.toISOString() : policy.effectiveAt.toISOString(),
    expectedMaturityDate: latestMaturity ? latestMaturity.toISOString() : null,
    remainingSeconds,
    maturingAmount,
    maturedAmount,
    eligibleAtMaturity: availableBalance,
    reason:
      maturingAmount > 0
        ? `Funds received under maturity policy ${policy.policyVersion} are held for ${policy.days} days before they become withdrawable.`
        : `All funds received under maturity policy ${policy.policyVersion} have matured and are withdrawable.`,
    terms: `Maturity policy ${policy.policyVersion}: deposits confirmed on or after ${policy.effectiveAt.toISOString()} are eligible for withdrawal ${policy.days} days after their confirmation. The countdown is authoritative on the server and is never reset or extended.`
  };
}

export interface WithdrawalEligibility {
  canWithdraw: boolean;
  levelMet: boolean;
  balanceAvailable: boolean;
  cooldownCleared: boolean;
  reasons: string[];
}

export interface WithdrawalSummary {
  withdrawable_balance: number;
  locked_balance: number;
  invested_balance: number;
  pending_withdrawal_amount: number;
  pending_earnings_total: number;
  total_account_balance: number;
  user_level: number;
  min_level: number;
  cooldown_seconds_remaining: number;
  deposit_level: {
    level: number;
    total_deposited_usd: number;
    current_level_required_total: number;
    next_level: number | null;
    next_level_required_total: number | null;
    remaining_to_next: number | null;
  };
  supported_assets: SupportedWithdrawalAsset[];
  platform_fee_percent: number;
  eligibility: WithdrawalEligibility;
  maturity: MaturityEligibility;
  min_withdrawal_amount: number;
}

const IN_FLIGHT_STATES = ["requested", "under_review", "approved", "processing", "broadcast"];

export async function pendingWithdrawalAmountFor(userId: string): Promise<number> {
  const rows = await Withdrawal.findAll({
    where: {
      user_id: userId,
      [Op.or]: [
        { detailed_status: { [Op.in]: IN_FLIGHT_STATES } },
        { detailed_status: { [Op.is]: literal("null") }, status: "Pending" }
      ]
    }
  });
  return rows.reduce((total, row) => total + (Number.isFinite(Number(row.amount)) ? Number(row.amount) : 0), 0);
}

export async function getUserWithdrawalSummary(userId: string): Promise<WithdrawalSummary> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new WithdrawalError(404, "User not found");
  }

  const [depositStats, pendingWithdrawalAmount, maturity] = await Promise.all([
    calculateDepositLevelForUser(userId),
    pendingWithdrawalAmountFor(userId),
    computeMaturityEligibility(user)
  ]);

  const minLevel = getWithdrawalMinLevel();
  const cooldownHours = getWithdrawalCooldownHours();

  let cooldownRemainingSeconds = 0;
  if (cooldownHours > 0 && user.last_withdrawal_at) {
    const elapsedMs = Date.now() - new Date(user.last_withdrawal_at).getTime();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    cooldownRemainingSeconds = Math.max(0, Math.floor((cooldownMs - elapsedMs) / 1000));
  }

  const withdrawable = Number.isFinite(user.withdrawable_balance) ? user.withdrawable_balance : 0;
  const locked = Number.isFinite(user.locked_balance) ? user.locked_balance : 0;
  const availableMatured = Math.max(0, withdrawable - maturity.maturingAmount);

  const levelMet = depositStats.level >= minLevel;
  const balanceAvailable = availableMatured > 0;
  const cooldownCleared = cooldownRemainingSeconds === 0;

  const reasons: string[] = [];
  if (!levelMet) {
    reasons.push(
      `Withdrawals unlock at deposit level ${minLevel}. You are currently at level ${depositStats.level}.`
    );
  }
  if (!cooldownCleared) {
    reasons.push("A withdrawal cooldown is active. Please try again once it clears.");
  }
  if (levelMet && cooldownCleared && !balanceAvailable) {
    reasons.push(
      maturity.maturingAmount > 0
        ? "Your available funds are still within the disclosed maturity period."
        : "You do not have an available withdrawal balance yet."
    );
  }

  const pendingEarnings =
    (user.pending_earnings as { total?: unknown } | null)?.total !== undefined
      ? Number((user.pending_earnings as { total?: unknown }).total)
      : 0;

  return {
    withdrawable_balance: withdrawable,
    locked_balance: locked,
    invested_balance: depositStats.totalDepositedUsd,
    pending_withdrawal_amount: pendingWithdrawalAmount,
    pending_earnings_total: Number.isFinite(pendingEarnings) ? pendingEarnings : 0,
    total_account_balance: withdrawable + locked + depositStats.totalDepositedUsd,
    user_level: depositStats.level,
    min_level: minLevel,
    cooldown_seconds_remaining: cooldownRemainingSeconds,
    deposit_level: {
      level: depositStats.level,
      total_deposited_usd: depositStats.totalDepositedUsd,
      current_level_required_total: depositStats.currentLevelRequiredTotal,
      next_level: depositStats.nextLevel,
      next_level_required_total: depositStats.nextLevelRequiredTotal,
      remaining_to_next: depositStats.remainingToNext
    },
    supported_assets: supportedWithdrawalAssets(),
    platform_fee_percent: getPlatformFeePercent(),
    min_withdrawal_amount: 0,
    eligibility: {
      canWithdraw: levelMet && balanceAvailable && cooldownCleared,
      levelMet,
      balanceAvailable,
      cooldownCleared,
      reasons
    },
    maturity
  };
}

export interface WithdrawalRequestInput {
  asset: unknown;
  network: unknown;
  address: unknown;
  amount: unknown;
  idempotencyKey?: unknown;
}

function resolveIdempotencyKey(userId: string, raw: unknown): string {
  const candidate = typeof raw === "string" ? raw.trim() : "";
  const scoped =
    candidate.length >= 8 && candidate.length <= 200 ? candidate : `auto-${randomUUID()}`;
  return `wd:${userId}:${scoped}`;
}

export interface ReserveWithdrawalResult {
  withdrawal: Withdrawal;
  duplicate: boolean;
  fees: WithdrawalFeeBreakdown;
}

export async function reserveWithdrawal(
  userId: string,
  input: WithdrawalRequestInput
): Promise<ReserveWithdrawalResult> {
  const validation = validateWithdrawalSubmission(input);
  if (!validation.valid || !validation.cryptoType || !validation.platformAsset) {
    throw new WithdrawalError(400, validation.errors[0] || "Invalid withdrawal request.");
  }

  const definition = resolveWithdrawalDefinition(validation.cryptoType);
  const amount = validation.numericAmount;
  const idempotencyKey = resolveIdempotencyKey(userId, input.idempotencyKey);
  const fees = withdrawalFeesFor(definition.platformAsset, amount);

  const existing = await Withdrawal.findOne({ where: { idempotency_key: idempotencyKey } });
  if (existing) {
    return { withdrawal: existing, duplicate: true, fees };
  }

  const withdrawal = await sequelize.transaction(async (transaction) => {
    const user = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) {
      throw new WithdrawalError(404, "User not found");
    }

    const depositStats = await calculateDepositLevelForUser(userId);
    const minLevel = getWithdrawalMinLevel();
    if (depositStats.level < minLevel) {
      throw new WithdrawalError(
        403,
        `Withdrawals are locked until you reach deposit level ${minLevel} based on your total approved deposits.`
      );
    }

    const cooldownHours = getWithdrawalCooldownHours();
    if (cooldownHours > 0 && user.last_withdrawal_at) {
      const elapsedMs = Date.now() - new Date(user.last_withdrawal_at).getTime();
      if (elapsedMs < cooldownHours * 60 * 60 * 1000) {
        throw new WithdrawalError(429, "Withdrawal cooldown active. Please try again later.");
      }
    }

    const maturity = await computeMaturityEligibility(user, transaction);
    const availableBalance = Math.max(0, Number(user.withdrawable_balance) - maturity.maturingAmount);

    if (amount > availableBalance) {
      throw new WithdrawalError(
        400,
        maturity.maturingAmount > 0
          ? "Requested amount exceeds the funds that have matured and are available to withdraw."
          : "Requested amount exceeds your withdrawable balance."
      );
    }

    const limits = getWithdrawalLimitsFor(definition.platformAsset);
    if (limits.minAmount > 0 && amount < limits.minAmount) {
      throw new WithdrawalError(
        400,
        `The minimum withdrawal for ${definition.symbolLabel} is ${limits.minAmount}.`
      );
    }
    if (limits.maxAmount > 0 && amount > limits.maxAmount) {
      throw new WithdrawalError(
        400,
        `The maximum withdrawal for ${definition.symbolLabel} is ${limits.maxAmount}.`
      );
    }

    const maxDaily = getMaxDailyWithdrawal();
    if (maxDaily > 0 && amount > maxDaily) {
      throw new WithdrawalError(400, "Requested amount exceeds the daily withdrawal limit.");
    }

    const row = await Withdrawal.create(
      {
        user_id: userId,
        amount,
        asset: definition.platformAsset,
        destination_address: validation.normalizedAddress,
        network: definition.networkType,
        network_fee: fees.networkFee,
        platform_fee: fees.platformFee,
        detailed_status: "requested",
        idempotency_key: idempotencyKey
      },
      { transaction }
    );

    user.withdrawable_balance = Number(
      (Number(user.withdrawable_balance) - amount).toFixed(8)
    );
    user.last_withdrawal_at = new Date();
    await user.save({ transaction });

    await postBalancedEntry({
      userId,
      asset: definition.platformAsset,
      amount: fees.amount,
      transactionType: "withdrawal_reserved",
      sourceType: "withdrawal_reserve",
      sourceId: row.withdrawal_id,
      debit: "available_balance",
      credit: "pending_settlement",
      transaction
    });

    return row;
  });

  return { withdrawal, duplicate: false, fees };
}
