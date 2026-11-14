"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalError = void 0;
exports.getWithdrawalMinLevel = getWithdrawalMinLevel;
exports.getWithdrawalCooldownHours = getWithdrawalCooldownHours;
exports.getMaxDailyWithdrawal = getMaxDailyWithdrawal;
exports.getPlatformFeePercent = getPlatformFeePercent;
exports.getNetworkFeeFor = getNetworkFeeFor;
exports.getWithdrawalLimitsFor = getWithdrawalLimitsFor;
exports.supportedWithdrawalAssets = supportedWithdrawalAssets;
exports.withdrawalFeesFor = withdrawalFeesFor;
exports.getMaturityPolicy = getMaturityPolicy;
exports.computeMaturityEligibility = computeMaturityEligibility;
exports.pendingWithdrawalAmountFor = pendingWithdrawalAmountFor;
exports.getUserWithdrawalSummary = getUserWithdrawalSummary;
exports.reserveWithdrawal = reserveWithdrawal;
const crypto_1 = require("crypto");
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const withdrawalRules_1 = require("../domain/withdrawalRules");
const Deposit_1 = require("../models/Deposit");
const User_1 = require("../models/User");
const Withdrawal_1 = require("../models/Withdrawal");
const depositLevelService_1 = require("./depositLevelService");
const financialOperationsService_1 = require("./financialOperationsService");
const marketDataService_1 = require("./marketDataService");
class WithdrawalError extends Error {
    constructor(status, message) {
        super(message);
        this.name = "WithdrawalError";
        this.status = status;
    }
}
exports.WithdrawalError = WithdrawalError;
function numberFromEnv(key, fallback, minimum = -Infinity, maximum = Infinity) {
    const raw = process.env[key];
    const parsed = raw === undefined ? NaN : Number(raw);
    if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
        return fallback;
    }
    return parsed;
}
function getWithdrawalMinLevel() {
    return Math.max(numberFromEnv("WITHDRAWAL_MIN_LEVEL", 5, 1), 5);
}
function getWithdrawalCooldownHours() {
    return numberFromEnv("WITHDRAWAL_COOLDOWN_HOURS", 24, 0);
}
function getMaxDailyWithdrawal() {
    return numberFromEnv("WITHDRAWAL_MAX_DAILY_AMOUNT", 0, 0);
}
function getPlatformFeePercent() {
    return numberFromEnv("WITHDRAWAL_PLATFORM_FEE_PERCENT", 0, 0, 100);
}
function getNetworkFeeFor(platformAsset) {
    return numberFromEnv(`WITHDRAWAL_NETWORK_FEE_${platformAsset}`, 0, 0);
}
function getWithdrawalLimitsFor(platformAsset) {
    return {
        minAmount: numberFromEnv(`WITHDRAWAL_MIN_AMOUNT_${platformAsset}`, 0, 0),
        maxAmount: numberFromEnv(`WITHDRAWAL_MAX_AMOUNT_${platformAsset}`, 0, 0)
    };
}
function supportedWithdrawalAssets() {
    return withdrawalRules_1.WITHDRAWAL_SYMBOLS.map((entry) => ({
        symbol: entry.symbol,
        name: entry.name,
        networks: entry.networks.map((cryptoType) => {
            const definition = withdrawalRules_1.WITHDRAWAL_NETWORK_DEFINITIONS[cryptoType];
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
function withdrawalFeesFor(platformAsset, amount) {
    return (0, withdrawalRules_1.computeWithdrawalFees)({
        amount,
        networkFee: getNetworkFeeFor(platformAsset),
        platformFeePercent: getPlatformFeePercent()
    });
}
function getMaturityPolicy() {
    const requested = String(process.env.WITHDRAWAL_MATURITY_ENABLED || "").toLowerCase() === "true";
    const days = numberFromEnv("WITHDRAWAL_MATURITY_DAYS", 14, 0, 90);
    const policyVersion = (process.env.WITHDRAWAL_MATURITY_POLICY_VERSION || "v1").trim() || "v1";
    const rawEffectiveAt = process.env.WITHDRAWAL_MATURITY_EFFECTIVE_AT;
    const parsedEffectiveAt = rawEffectiveAt ? new Date(rawEffectiveAt) : null;
    const effectiveAt = parsedEffectiveAt && !Number.isNaN(parsedEffectiveAt.getTime()) ? parsedEffectiveAt : null;
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
            configWarning: "A maturity period was requested but is not active because WITHDRAWAL_MATURITY_DAYS or WITHDRAWAL_MATURITY_EFFECTIVE_AT is missing. No holding period is being applied."
        };
    }
    return { enabled: true, days, policyVersion, effectiveAt, configWarning: null };
}
const NO_POLICY_TERMS = "This platform does not apply a lockup or maturity period to withdrawal balances. Withdrawals are reviewed for security but are not held for a fixed period.";
async function computeMaturityEligibility(user, transaction) {
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
    const deposits = await Deposit_1.Deposit.findAll({
        where: {
            user_id: user.user_id,
            status: "Approved",
            confirmed_at: { [sequelize_1.Op.gte]: policy.effectiveAt }
        },
        transaction
    });
    let maturingValue = 0;
    let maturedValue = 0;
    let earliestStart = null;
    let latestMaturity = null;
    if (deposits.length > 0) {
        const prices = await (0, marketDataService_1.getAllMarketPrices)();
        for (const deposit of deposits) {
            const confirmedAt = deposit.confirmed_at ? new Date(deposit.confirmed_at) : null;
            if (!confirmedAt) {
                continue;
            }
            const symbol = deposit.crypto_type === "ERC20" || deposit.crypto_type === "TRC20"
                ? "USDT"
                : deposit.crypto_type;
            const pricePoint = prices[symbol];
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
            }
            else {
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
        reason: maturingAmount > 0
            ? `Funds received under maturity policy ${policy.policyVersion} are held for ${policy.days} days before they become withdrawable.`
            : `All funds received under maturity policy ${policy.policyVersion} have matured and are withdrawable.`,
        terms: `Maturity policy ${policy.policyVersion}: deposits confirmed on or after ${policy.effectiveAt.toISOString()} are eligible for withdrawal ${policy.days} days after their confirmation. The countdown is authoritative on the server and is never reset or extended.`
    };
}
const IN_FLIGHT_STATES = ["requested", "under_review", "approved", "processing", "broadcast"];
async function pendingWithdrawalAmountFor(userId) {
    const rows = await Withdrawal_1.Withdrawal.findAll({
        where: {
            user_id: userId,
            [sequelize_1.Op.or]: [
                { detailed_status: { [sequelize_1.Op.in]: IN_FLIGHT_STATES } },
                { detailed_status: { [sequelize_1.Op.is]: (0, sequelize_1.literal)("null") }, status: "Pending" }
            ]
        }
    });
    return rows.reduce((total, row) => total + (Number.isFinite(Number(row.amount)) ? Number(row.amount) : 0), 0);
}
async function getUserWithdrawalSummary(userId) {
    const user = await User_1.User.findByPk(userId);
    if (!user) {
        throw new WithdrawalError(404, "User not found");
    }
    const [depositStats, pendingWithdrawalAmount, maturity] = await Promise.all([
        (0, depositLevelService_1.calculateDepositLevelForUser)(userId),
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
    const reasons = [];
    if (!levelMet) {
        reasons.push(`Withdrawals unlock at deposit level ${minLevel}. You are currently at level ${depositStats.level}.`);
    }
    if (!cooldownCleared) {
        reasons.push("A withdrawal cooldown is active. Please try again once it clears.");
    }
    if (levelMet && cooldownCleared && !balanceAvailable) {
        reasons.push(maturity.maturingAmount > 0
            ? "Your available funds are still within the disclosed maturity period."
            : "You do not have an available withdrawal balance yet.");
    }
    const pendingEarnings = user.pending_earnings?.total !== undefined
        ? Number(user.pending_earnings.total)
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
function resolveIdempotencyKey(userId, raw) {
    const candidate = typeof raw === "string" ? raw.trim() : "";
    const scoped = candidate.length >= 8 && candidate.length <= 200 ? candidate : `auto-${(0, crypto_1.randomUUID)()}`;
    return `wd:${userId}:${scoped}`;
}
async function reserveWithdrawal(userId, input) {
    const validation = (0, withdrawalRules_1.validateWithdrawalSubmission)(input);
    if (!validation.valid || !validation.cryptoType || !validation.platformAsset) {
        throw new WithdrawalError(400, validation.errors[0] || "Invalid withdrawal request.");
    }
    const definition = (0, withdrawalRules_1.resolveWithdrawalDefinition)(validation.cryptoType);
    const amount = validation.numericAmount;
    const idempotencyKey = resolveIdempotencyKey(userId, input.idempotencyKey);
    const fees = withdrawalFeesFor(definition.platformAsset, amount);
    const existing = await Withdrawal_1.Withdrawal.findOne({ where: { idempotency_key: idempotencyKey } });
    if (existing) {
        return { withdrawal: existing, duplicate: true, fees };
    }
    const withdrawal = await database_1.sequelize.transaction(async (transaction) => {
        const user = await User_1.User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!user) {
            throw new WithdrawalError(404, "User not found");
        }
        const depositStats = await (0, depositLevelService_1.calculateDepositLevelForUser)(userId);
        const minLevel = getWithdrawalMinLevel();
        if (depositStats.level < minLevel) {
            throw new WithdrawalError(403, `Withdrawals are locked until you reach deposit level ${minLevel} based on your total approved deposits.`);
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
            throw new WithdrawalError(400, maturity.maturingAmount > 0
                ? "Requested amount exceeds the funds that have matured and are available to withdraw."
                : "Requested amount exceeds your withdrawable balance.");
        }
        const limits = getWithdrawalLimitsFor(definition.platformAsset);
        if (limits.minAmount > 0 && amount < limits.minAmount) {
            throw new WithdrawalError(400, `The minimum withdrawal for ${definition.symbolLabel} is ${limits.minAmount}.`);
        }
        if (limits.maxAmount > 0 && amount > limits.maxAmount) {
            throw new WithdrawalError(400, `The maximum withdrawal for ${definition.symbolLabel} is ${limits.maxAmount}.`);
        }
        const maxDaily = getMaxDailyWithdrawal();
        if (maxDaily > 0 && amount > maxDaily) {
            throw new WithdrawalError(400, "Requested amount exceeds the daily withdrawal limit.");
        }
        const row = await Withdrawal_1.Withdrawal.create({
            user_id: userId,
            amount,
            asset: definition.platformAsset,
            destination_address: validation.normalizedAddress,
            network: definition.networkType,
            network_fee: fees.networkFee,
            platform_fee: fees.platformFee,
            detailed_status: "requested",
            idempotency_key: idempotencyKey
        }, { transaction });
        user.withdrawable_balance = Number((Number(user.withdrawable_balance) - amount).toFixed(8));
        user.last_withdrawal_at = new Date();
        await user.save({ transaction });
        await (0, financialOperationsService_1.postBalancedEntry)({
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
