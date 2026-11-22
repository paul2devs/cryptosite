"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financialOverviewForUser = financialOverviewForUser;
exports.applyAdjustment = applyAdjustment;
exports.reverseAdjustment = reverseAdjustment;
exports.listAdjustments = listAdjustments;
const crypto_1 = require("crypto");
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const balanceAdjustmentRules_1 = require("../domain/balanceAdjustmentRules");
const money_1 = require("../domain/money");
const transactionRules_1 = require("../domain/transactionRules");
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const BalanceAdjustment_1 = require("../models/BalanceAdjustment");
const Deposit_1 = require("../models/Deposit");
const EarningsLog_1 = require("../models/EarningsLog");
const InvestmentPosition_1 = require("../models/InvestmentPosition");
const MembershipTier_1 = require("../models/MembershipTier");
const User_1 = require("../models/User");
const UserMembership_1 = require("../models/UserMembership");
const Withdrawal_1 = require("../models/Withdrawal");
const activityService_1 = require("./activityService");
const financialOperationsService_1 = require("./financialOperationsService");
const investmentLevelService_1 = require("./investmentLevelService");
const membershipService_1 = require("./membershipService");
const performanceService_1 = require("./performanceService");
const AMOUNT_SCALE = 8;
const SOURCE_TYPE = "balance_adjustment";
const DEFAULT_ASSET = "USD";
function decimal(value) {
    return (0, money_1.parseDecimal)(String(value ?? "0"), AMOUNT_SCALE);
}
function amount(value) {
    return (0, money_1.formatDecimal)(decimal(value), AMOUNT_SCALE);
}
function sumPrincipals(positions) {
    return positions.reduce((total, position) => total + decimal(position.principal), 0n);
}
// Reads the user's pending earnings figure from the JSONB column, tolerating a null or
// missing shape without ever inventing a value.
function pendingEarningsOf(user) {
    const raw = user.pending_earnings?.total;
    if (raw === undefined || raw === null)
        return 0n;
    return decimal(raw);
}
// A single, reusable position mutation so allocation and deallocation keep the
// position's principal and valuation in step with the ledger.
async function movePosition(position, principalDelta, transaction) {
    const nextPrincipal = decimal(position.principal) + principalDelta;
    if (nextPrincipal < 0n) {
        throw new Error("The deallocation exceeds this investment position.");
    }
    const instance = await InvestmentPosition_1.InvestmentPosition.findByPk(position.position_id, { transaction });
    if (!instance)
        throw new Error("Investment position not found");
    instance.principal = (0, money_1.formatDecimal)(nextPrincipal, AMOUNT_SCALE);
    if (instance.current_valuation !== null) {
        const nextValuation = decimal(instance.current_valuation) + principalDelta;
        instance.current_valuation = (0, money_1.formatDecimal)(nextValuation < 0n ? 0n : nextValuation, AMOUNT_SCALE);
    }
    instance.status = nextPrincipal === 0n ? "closed" : "active";
    instance.last_calculated_at = instance.last_calculated_at ?? null;
    await instance.save({ transaction });
    return instance;
}
// Applies an authorised valuation correction to a single position. The position is the
// source of truth for the derived portfolio value, so the correction is written onto the
// component (never the derived total). The position is marked admin-verified because the
// correction is a recorded, auditable valuation, not a silent overwrite.
async function applyValuationCorrection(positionId, valuationDelta, transaction) {
    const instance = await InvestmentPosition_1.InvestmentPosition.findByPk(positionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!instance)
        throw new Error("The investment position to correct was not found.");
    const base = decimal(instance.current_valuation ?? instance.principal);
    const next = base + valuationDelta;
    if (next < 0n) {
        throw new Error("The correction would make the position valuation negative.");
    }
    instance.current_valuation = (0, money_1.formatDecimal)(next, AMOUNT_SCALE);
    instance.verification_status = "verified";
    instance.last_calculated_at = new Date();
    await instance.save({ transaction });
    return instance;
}
async function createAllocationPosition(userId, asset, principalDelta, transaction) {
    // Admin-allocated principal starts unvalued and carries no deposit, so it is
    // reported at principal until an independent valuation is recorded.
    return InvestmentPosition_1.InvestmentPosition.create({
        user_id: userId,
        deposit_id: null,
        asset,
        principal: (0, money_1.formatDecimal)(principalDelta, AMOUNT_SCALE),
        strategy: "custody_hold",
        status: "active",
        verification_status: "unavailable",
        current_valuation: null
    }, { transaction });
}
function serializeAdjustment(row) {
    return {
        adjustmentId: row.adjustment_id,
        userId: row.user_id,
        adminId: row.admin_id,
        type: row.type,
        typeLabel: balanceAdjustmentRules_1.BALANCE_ADJUSTMENT_LABEL[row.type] ?? row.type,
        direction: row.direction,
        amount: String(row.amount),
        asset: row.asset,
        balanceBefore: String(row.balance_before),
        balanceAfter: String(row.balance_after),
        principalBefore: String(row.principal_before),
        principalAfter: String(row.principal_after),
        valuationBefore: row.valuation_before === null ? null : String(row.valuation_before),
        valuationAfter: row.valuation_after === null ? null : String(row.valuation_after),
        earningsBefore: row.earnings_before === null ? null : String(row.earnings_before),
        earningsAfter: row.earnings_after === null ? null : String(row.earnings_after),
        positionId: row.position_id,
        reason: row.reason,
        note: row.note,
        reference: row.reference,
        reversalOf: row.reversal_of,
        reversedBy: row.reversed_by,
        status: row.status,
        createdAt: row.created_at
    };
}
// Full, separated financial picture for one user. Available balance, invested principal,
// current valuation, pending earnings and realised profit are reported independently so
// no single number is presented as if it were another. The total portfolio value is a
// derived figure (wallet + current investment value) and never a stored number.
async function financialOverviewForUser(userId) {
    const user = await User_1.User.findByPk(userId);
    if (!user)
        throw new Error("User not found");
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [ledger, overview, positions, deposits, withdrawals, todayEarningsRaw, totalEarningsRaw, membership, recentAdjustments] = await Promise.all([
        (0, financialOperationsService_1.ledgerBalancesForUser)(userId),
        (0, performanceService_1.getPerformanceOverview)(userId, "all"),
        InvestmentPosition_1.InvestmentPosition.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]] }),
        Deposit_1.Deposit.findAll({ where: { user_id: userId } }),
        Withdrawal_1.Withdrawal.findAll({ where: { user_id: userId } }),
        EarningsLog_1.EarningsLog.sum("earned_amount", { where: { user_id: userId, timestamp: { [sequelize_1.Op.gte]: startOfDay } } }),
        EarningsLog_1.EarningsLog.sum("earned_amount", { where: { user_id: userId } }),
        UserMembership_1.UserMembership.findByPk(userId),
        BalanceAdjustment_1.BalanceAdjustment.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]], limit: 10 })
    ]);
    const tier = membership?.tier_id ? await MembershipTier_1.MembershipTier.findByPk(membership.tier_id) : null;
    const approvedDeposits = deposits.filter((row) => row.status === "Approved");
    const completedWithdrawals = withdrawals.filter((row) => row.status === "Approved" || row.detailed_status === "completed");
    const pendingDeposits = deposits.filter((row) => row.status === "Pending");
    const pendingWithdrawals = withdrawals.filter((row) => row.status === "Pending" ||
        row.detailed_status === "requested" ||
        row.detailed_status === "under_review");
    const activePositions = positions.filter((position) => position.status === "active");
    const pendingEarnings = pendingEarningsOf(user);
    // Total portfolio value is the authoritative investment valuation: invested
    // principal plus the earnings accrued on active positions. It already carries
    // accrued (pending) earnings, so they are never added again. Wallet balances
    // are reported separately and are never folded into the investment valuation.
    const valuation = (0, performanceService_1.portfolioValuation)(overview.overview);
    const totalPortfolioValue = decimal(valuation.totalValue);
    return {
        account: {
            userId: user.user_id,
            name: user.name,
            email: user.email,
            isAdmin: user.is_admin,
            createdAt: user.created_at
        },
        balance: {
            available: amount(user.withdrawable_balance),
            locked: amount(user.locked_balance),
            ledgerAvailable: ledger.totals.available_balance ?? "0.00000000"
        },
        portfolio: {
            totalPortfolioValue: (0, money_1.formatDecimal)(totalPortfolioValue, AMOUNT_SCALE),
            available: amount(user.withdrawable_balance),
            locked: amount(user.locked_balance),
            currentInvestmentValue: overview.overview.currentInvestmentValue,
            investedPrincipal: overview.overview.investedPrincipal,
            accruedEarnings: (0, money_1.formatDecimal)(decimal(valuation.accruedEarnings), AMOUNT_SCALE),
            settledEarnings: (0, money_1.formatDecimal)(decimal(valuation.settledEarnings), AMOUNT_SCALE),
            pendingEarnings: (0, money_1.formatDecimal)(pendingEarnings, AMOUNT_SCALE),
            formula: "totalPortfolioValue = invested principal + accrued earnings from verified positions. Accrued earnings are included as pending the moment they accrue; settled earnings are not added again. Available and locked wallet balances are reported separately."
        },
        totals: {
            totalDeposited: amount(approvedDeposits.reduce((total, row) => total + decimal(row.amount), 0n)),
            totalWithdrawn: amount(completedWithdrawals.reduce((total, row) => total + decimal(row.amount), 0n)),
            pendingDepositCount: pendingDeposits.length,
            pendingDepositAmount: amount(pendingDeposits.reduce((total, row) => total + decimal(row.amount), 0n)),
            pendingWithdrawalCount: pendingWithdrawals.length,
            pendingWithdrawalAmount: amount(pendingWithdrawals.reduce((total, row) => total + decimal(row.amount), 0n)),
            activeInvestmentCount: activePositions.length
        },
        investment: {
            investedPrincipal: overview.overview.investedPrincipal,
            currentInvestmentValue: overview.overview.currentInvestmentValue,
            valuationComplete: overview.overview.valuationComplete,
            unrealisedProfitLoss: overview.overview.totalUnrealizedProfitLoss,
            totalRealisedProfitLoss: overview.overview.totalRealizedProfitLoss,
            overallReturnPercent: overview.overview.overallReturnPercent
        },
        earnings: {
            pendingEarnings: (0, money_1.formatDecimal)(pendingEarnings, AMOUNT_SCALE),
            todayEarnings: amount(todayEarningsRaw ?? 0),
            totalInvestmentEarnings: amount(totalEarningsRaw ?? 0),
            todayProfitLoss: overview.overview.todayProfitLoss,
            todayRoiPercent: overview.overview.todayRoiPercent,
            todayStatus: overview.overview.todayStatus,
            totalRealisedProfitLoss: overview.overview.totalRealizedProfitLoss,
            totalUnrealisedProfitLoss: overview.overview.totalUnrealizedProfitLoss,
            overallReturnPercent: overview.overview.overallReturnPercent,
            note: "Pending earnings are accrued but unsettled. They are never credited to the available wallet balance until the settlement workflow authorises a payout."
        },
        membership: membership
            ? {
                tierId: membership.tier_id,
                tierName: tier?.name ?? null,
                qualifyingAmount: String(membership.qualifying_amount),
                source: membership.manual_tier_id ? "admin" : "automatic",
                manualReason: membership.manual_reason,
                achievedAt: membership.achieved_at
            }
            : {
                tierId: null,
                tierName: null,
                qualifyingAmount: "0.00",
                source: "unqualified",
                manualReason: null,
                achievedAt: null
            },
        positions: positions.map((position) => ({
            positionId: position.position_id,
            asset: position.asset,
            principal: String(position.principal),
            currentValuation: position.current_valuation === null ? null : String(position.current_valuation),
            verificationStatus: position.verification_status,
            status: position.status,
            strategy: position.strategy,
            depositId: position.deposit_id,
            createdAt: position.created_at
        })),
        recentAdjustments: recentAdjustments.map((row) => serializeAdjustment(row)),
        ledgerTotals: ledger.totals
    };
}
// Recalculates the derived membership and investment level after a committed adjustment.
// A failure here never fails the adjustment itself (which is already stored and audited);
// it is logged so the next recalculation pass can repair the derived state.
async function syncDerivedState(userId, type) {
    try {
        if (type === "investment_allocation" || type === "investment_deallocation") {
            await (0, investmentLevelService_1.syncUserInvestmentLevel)(userId, "Administrator adjusted invested principal");
        }
        await (0, membershipService_1.syncUserMembership)(userId, "Administrator adjustment recalculated membership qualification");
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[admin-balance] post-adjustment recalculation failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function findExistingAdjustment(idempotencyKey) {
    return BalanceAdjustment_1.BalanceAdjustment.findOne({ where: { idempotency_key: idempotencyKey } });
}
// Applies one administrator balance, principal, valuation or earnings adjustment atomically.
// The user row is locked for the whole write so two concurrent adjustments can never read
// the same starting balance, and the idempotency key makes a double submit a no-op.
async function applyAdjustment(adminId, input) {
    if (!(0, balanceAdjustmentRules_1.isBalanceAdjustmentType)(input.type) || input.type === "reversal") {
        throw new Error("Unsupported adjustment type.");
    }
    const type = input.type;
    const reason = String(input.reason ?? "").trim();
    if (reason.length < 3) {
        throw new Error("A reason of at least 3 characters is required.");
    }
    const asset = String(input.asset ?? "").trim() || DEFAULT_ASSET;
    const normalizedAmount = (0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)(input.amount);
    const amountUnits = (0, money_1.parseDecimal)(normalizedAmount, AMOUNT_SCALE);
    const direction = (0, balanceAdjustmentRules_1.directionForAdjustment)(type, input.direction ?? null);
    const idempotencyKey = String(input.idempotencyKey ?? "").trim() || null;
    const adjustmentId = (0, crypto_1.randomUUID)();
    let record;
    try {
        record = await database_1.sequelize.transaction(async (transaction) => {
            const user = await User_1.User.findByPk(input.userId, { transaction, lock: transaction.LOCK.UPDATE });
            if (!user)
                throw new Error("User not found");
            if (idempotencyKey) {
                const existing = await BalanceAdjustment_1.BalanceAdjustment.findOne({
                    where: { idempotency_key: idempotencyKey },
                    transaction
                });
                if (existing)
                    return existing;
            }
            const balanceBefore = decimal(user.withdrawable_balance);
            const positions = await InvestmentPosition_1.InvestmentPosition.findAll({
                where: { user_id: user.user_id, status: "active" },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            const principalBefore = sumPrincipals(positions);
            const earningsBefore = pendingEarningsOf(user);
            const plan = (0, balanceAdjustmentRules_1.planAdjustment)({ type, direction, amountUnits });
            const balanceAfter = balanceBefore + plan.availableDelta;
            if (balanceAfter < 0n) {
                throw new Error("Insufficient available balance for this adjustment.");
            }
            // Resolve the target position for any adjustment that changes principal or valuation.
            let target = null;
            if (plan.principalDelta > 0n || plan.valuationDelta !== 0n) {
                if (input.positionId) {
                    target = positions.find((position) => position.position_id === input.positionId) ?? null;
                    if (!target) {
                        throw new Error("The selected investment position was not found for this user.");
                    }
                }
                else if (plan.valuationDelta !== 0n) {
                    throw new Error("Select which investment position to correct.");
                }
            }
            if (plan.principalDelta < 0n) {
                const candidates = input.positionId
                    ? positions.filter((position) => position.position_id === input.positionId)
                    : positions;
                if (candidates.length === 0) {
                    throw new Error("The user has no eligible active investment to deallocate from.");
                }
                if (!input.positionId && candidates.length > 1) {
                    throw new Error("Select which investment position to deallocate from.");
                }
                target = candidates[0];
            }
            const principalAfter = principalBefore + plan.principalDelta;
            if (principalAfter < 0n) {
                throw new Error("The deallocation exceeds the invested principal.");
            }
            let valuationBefore = null;
            let valuationAfter = null;
            if (plan.valuationDelta !== 0n && target) {
                valuationBefore = decimal(target.current_valuation ?? target.principal);
                valuationAfter = valuationBefore + plan.valuationDelta;
                if (valuationAfter < 0n) {
                    throw new Error("The correction would make the position valuation negative.");
                }
            }
            let earningsAfter = null;
            if (type === "pending_earnings") {
                earningsAfter = earningsBefore + (direction === "debit" ? -amountUnits : amountUnits);
                if (earningsAfter < 0n) {
                    throw new Error("The correction would make pending earnings negative.");
                }
            }
            if (plan.ledger) {
                await (0, financialOperationsService_1.postBalancedEntry)({
                    userId: user.user_id,
                    asset,
                    amount: normalizedAmount,
                    transactionType: plan.ledger.transactionType,
                    sourceType: SOURCE_TYPE,
                    sourceId: adjustmentId,
                    debit: plan.ledger.debit,
                    credit: plan.ledger.credit,
                    transaction
                });
            }
            if (plan.availableDelta !== 0n) {
                user.withdrawable_balance = Number((0, money_1.formatDecimal)(balanceAfter, AMOUNT_SCALE));
            }
            if (type === "pending_earnings" && earningsAfter !== null) {
                user.pending_earnings = { total: Number((0, money_1.formatDecimal)(earningsAfter, AMOUNT_SCALE)) };
            }
            if (plan.availableDelta !== 0n || type === "pending_earnings") {
                await user.save({ transaction });
            }
            let positionId = null;
            if (plan.principalDelta !== 0n) {
                const position = target
                    ? await movePosition(target, plan.principalDelta, transaction)
                    : await createAllocationPosition(user.user_id, asset, plan.principalDelta, transaction);
                positionId = position.position_id;
            }
            else if (plan.valuationDelta !== 0n && target) {
                const position = await applyValuationCorrection(target.position_id, plan.valuationDelta, transaction);
                positionId = position.position_id;
            }
            const created = await BalanceAdjustment_1.BalanceAdjustment.create({
                adjustment_id: adjustmentId,
                user_id: user.user_id,
                admin_id: adminId,
                type,
                direction,
                amount: normalizedAmount,
                asset,
                balance_before: (0, money_1.formatDecimal)(balanceBefore, AMOUNT_SCALE),
                balance_after: (0, money_1.formatDecimal)(balanceAfter, AMOUNT_SCALE),
                principal_before: (0, money_1.formatDecimal)(principalBefore, AMOUNT_SCALE),
                principal_after: (0, money_1.formatDecimal)(principalAfter, AMOUNT_SCALE),
                valuation_before: valuationBefore === null ? null : (0, money_1.formatDecimal)(valuationBefore, AMOUNT_SCALE),
                valuation_after: valuationAfter === null ? null : (0, money_1.formatDecimal)(valuationAfter, AMOUNT_SCALE),
                earnings_before: type === "pending_earnings" ? (0, money_1.formatDecimal)(earningsBefore, AMOUNT_SCALE) : null,
                earnings_after: earningsAfter === null ? null : (0, money_1.formatDecimal)(earningsAfter, AMOUNT_SCALE),
                position_id: positionId,
                reason,
                note: String(input.note ?? "").trim() || null,
                reference: (0, transactionRules_1.generateReference)(SOURCE_TYPE, adjustmentId),
                idempotency_key: idempotencyKey,
                reversal_of: null,
                reversed_by: null,
                status: "applied"
            }, { transaction });
            await AdminAuditLog_1.AdminAuditLog.create({
                admin_id: adminId,
                action: `balance_${type}`,
                entity_type: "balance_adjustment",
                entity_id: created.adjustment_id,
                reason,
                metadata: {
                    userId: user.user_id,
                    type,
                    direction,
                    amount: normalizedAmount,
                    asset,
                    reference: created.reference,
                    positionId,
                    balanceBefore: (0, money_1.formatDecimal)(balanceBefore, AMOUNT_SCALE),
                    balanceAfter: (0, money_1.formatDecimal)(balanceAfter, AMOUNT_SCALE),
                    valuationBefore: valuationBefore === null ? null : (0, money_1.formatDecimal)(valuationBefore, AMOUNT_SCALE),
                    valuationAfter: valuationAfter === null ? null : (0, money_1.formatDecimal)(valuationAfter, AMOUNT_SCALE),
                    earningsBefore: type === "pending_earnings" ? (0, money_1.formatDecimal)(earningsBefore, AMOUNT_SCALE) : null,
                    earningsAfter: earningsAfter === null ? null : (0, money_1.formatDecimal)(earningsAfter, AMOUNT_SCALE)
                }
            }, { transaction });
            return created;
        });
    }
    catch (error) {
        if (idempotencyKey && error instanceof sequelize_1.UniqueConstraintError) {
            const existing = await findExistingAdjustment(idempotencyKey);
            if (existing)
                return { adjustment: serializeAdjustment(existing), overview: await financialOverviewForUser(existing.user_id) };
        }
        throw error;
    }
    await (0, activityService_1.trackUserActivity)(record.user_id, "admin_action", {
        adjustmentId: record.adjustment_id,
        type: record.type,
        amount: String(record.amount),
        reference: record.reference
    });
    await syncDerivedState(record.user_id, record.type);
    return {
        adjustment: serializeAdjustment(record),
        overview: await financialOverviewForUser(record.user_id)
    };
}
// Reverses a prior adjustment with a brand new, linked ledger entry. The original
// row is never deleted or rewritten; it is marked reversed and points at its reversal.
async function reverseAdjustment(adminId, adjustmentId, reason, note) {
    const trimmed = String(reason ?? "").trim();
    if (trimmed.length < 3) {
        throw new Error("A reason of at least 3 characters is required.");
    }
    const reversalId = (0, crypto_1.randomUUID)();
    const record = await database_1.sequelize.transaction(async (transaction) => {
        const original = await BalanceAdjustment_1.BalanceAdjustment.findByPk(adjustmentId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!original)
            throw new Error("Adjustment not found.");
        if (original.type === "reversal")
            throw new Error("A reversal cannot be reversed.");
        if (original.reversed_by)
            throw new Error("This adjustment has already been reversed.");
        const user = await User_1.User.findByPk(original.user_id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!user)
            throw new Error("User not found");
        const balanceBefore = decimal(user.withdrawable_balance);
        const positions = await InvestmentPosition_1.InvestmentPosition.findAll({
            where: { user_id: user.user_id, status: "active" },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        const principalBefore = sumPrincipals(positions);
        const earningsBefore = pendingEarningsOf(user);
        const amountUnits = decimal(original.amount);
        const plan = (0, balanceAdjustmentRules_1.planReversal)({
            type: original.type,
            direction: original.direction,
            amountUnits
        });
        const balanceAfter = balanceBefore + plan.availableDelta;
        if (balanceAfter < 0n) {
            throw new Error("Reversing this adjustment would overdraw the available balance.");
        }
        let target = null;
        if (plan.principalDelta !== 0n) {
            const reference = original.position_id
                ? positions.filter((position) => position.position_id === original.position_id)
                : positions;
            if (plan.principalDelta < 0n) {
                if (reference.length === 0) {
                    throw new Error("The original investment position is no longer available to reverse.");
                }
                target = reference[0];
            }
            else {
                target = reference[0] ?? null;
            }
        }
        const principalAfter = principalBefore + plan.principalDelta;
        if (principalAfter < 0n) {
            throw new Error("Reversing this adjustment would exceed the invested principal.");
        }
        // Valuation reversals restore the position's valuation from the recorded delta.
        let valuationBefore = null;
        let valuationAfter = null;
        if (plan.valuationDelta !== 0n) {
            if (!original.position_id)
                throw new Error("The corrected investment position is no longer available.");
            const position = await InvestmentPosition_1.InvestmentPosition.findByPk(original.position_id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!position)
                throw new Error("The corrected investment position is no longer available.");
            valuationBefore = decimal(position.current_valuation ?? position.principal);
            valuationAfter = valuationBefore + plan.valuationDelta;
            if (valuationAfter < 0n) {
                throw new Error("Reversing this adjustment would make the position valuation negative.");
            }
        }
        // Pending-earnings reversals restore the recorded before/after earnings figure.
        let earningsAfter = null;
        if (original.type === "pending_earnings" && original.earnings_before !== null && original.earnings_after !== null) {
            const delta = decimal(original.earnings_after) - decimal(original.earnings_before);
            earningsAfter = earningsBefore - delta;
            if (earningsAfter < 0n) {
                throw new Error("Reversing this adjustment would make pending earnings negative.");
            }
        }
        if (plan.ledger) {
            await (0, financialOperationsService_1.postBalancedEntry)({
                userId: user.user_id,
                asset: original.asset,
                amount: (0, money_1.formatDecimal)(amountUnits, AMOUNT_SCALE),
                transactionType: plan.ledger.transactionType,
                sourceType: SOURCE_TYPE,
                sourceId: reversalId,
                debit: plan.ledger.debit,
                credit: plan.ledger.credit,
                transaction
            });
        }
        if (plan.availableDelta !== 0n) {
            user.withdrawable_balance = Number((0, money_1.formatDecimal)(balanceAfter, AMOUNT_SCALE));
        }
        if (earningsAfter !== null) {
            user.pending_earnings = { total: Number((0, money_1.formatDecimal)(earningsAfter, AMOUNT_SCALE)) };
        }
        if (plan.availableDelta !== 0n || earningsAfter !== null) {
            await user.save({ transaction });
        }
        let positionId = original.position_id;
        if (plan.principalDelta !== 0n) {
            const position = target
                ? await movePosition(target, plan.principalDelta, transaction)
                : await createAllocationPosition(user.user_id, original.asset, plan.principalDelta, transaction);
            positionId = position.position_id;
        }
        else if (plan.valuationDelta !== 0n && original.position_id) {
            const position = await applyValuationCorrection(original.position_id, plan.valuationDelta, transaction);
            positionId = position.position_id;
        }
        const created = await BalanceAdjustment_1.BalanceAdjustment.create({
            adjustment_id: reversalId,
            user_id: original.user_id,
            admin_id: adminId,
            type: "reversal",
            direction: plan.availableDelta > 0n ? "credit" : "debit",
            amount: (0, money_1.formatDecimal)(amountUnits, AMOUNT_SCALE),
            asset: original.asset,
            balance_before: (0, money_1.formatDecimal)(balanceBefore, AMOUNT_SCALE),
            balance_after: (0, money_1.formatDecimal)(balanceAfter, AMOUNT_SCALE),
            principal_before: (0, money_1.formatDecimal)(principalBefore, AMOUNT_SCALE),
            principal_after: (0, money_1.formatDecimal)(principalAfter, AMOUNT_SCALE),
            valuation_before: valuationBefore === null ? null : (0, money_1.formatDecimal)(valuationBefore, AMOUNT_SCALE),
            valuation_after: valuationAfter === null ? null : (0, money_1.formatDecimal)(valuationAfter, AMOUNT_SCALE),
            earnings_before: original.type === "pending_earnings" ? (0, money_1.formatDecimal)(earningsBefore, AMOUNT_SCALE) : null,
            earnings_after: earningsAfter === null ? null : (0, money_1.formatDecimal)(earningsAfter, AMOUNT_SCALE),
            position_id: positionId,
            reason: trimmed,
            note: String(note ?? "").trim() || null,
            reference: (0, transactionRules_1.generateReference)(SOURCE_TYPE, reversalId),
            idempotency_key: null,
            reversal_of: original.adjustment_id,
            reversed_by: null,
            status: "applied"
        }, { transaction });
        original.reversed_by = created.adjustment_id;
        original.status = "reversed";
        await original.save({ transaction });
        await AdminAuditLog_1.AdminAuditLog.create({
            admin_id: adminId,
            action: "balance_reversal",
            entity_type: "balance_adjustment",
            entity_id: created.adjustment_id,
            reason: trimmed,
            metadata: {
                userId: original.user_id,
                reversalOf: original.adjustment_id,
                originalType: original.type,
                amount: String(original.amount),
                reference: created.reference,
                balanceBefore: (0, money_1.formatDecimal)(balanceBefore, AMOUNT_SCALE),
                balanceAfter: (0, money_1.formatDecimal)(balanceAfter, AMOUNT_SCALE)
            }
        }, { transaction });
        return created;
    });
    await (0, activityService_1.trackUserActivity)(record.user_id, "admin_action", {
        adjustmentId: record.adjustment_id,
        type: record.type,
        reversalOf: record.reversal_of,
        reference: record.reference
    });
    await syncDerivedState(record.user_id, "reversal");
    return {
        adjustment: serializeAdjustment(record),
        overview: await financialOverviewForUser(record.user_id)
    };
}
async function listAdjustments(query) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    const where = {};
    if (query.userId)
        where.user_id = String(query.userId);
    if (query.adminId)
        where.admin_id = String(query.adminId);
    if (query.type)
        where.type = String(query.type);
    if (query.status)
        where.status = String(query.status);
    if (query.reference)
        where.reference = String(query.reference);
    if (query.from || query.to) {
        where.created_at = {
            ...(query.from ? { [sequelize_1.Op.gte]: new Date(String(query.from)) } : {}),
            ...(query.to ? { [sequelize_1.Op.lte]: new Date(String(query.to)) } : {})
        };
    }
    const { rows, count } = await BalanceAdjustment_1.BalanceAdjustment.findAndCountAll({
        where,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        order: [["created_at", "DESC"]]
    });
    const ids = new Set();
    for (const row of rows) {
        ids.add(row.user_id);
        ids.add(row.admin_id);
    }
    const actors = ids.size > 0
        ? await User_1.User.findAll({
            where: { user_id: { [sequelize_1.Op.in]: [...ids] } },
            attributes: ["user_id", "name", "email"]
        })
        : [];
    const byId = new Map(actors.map((actor) => [actor.user_id, actor]));
    return {
        page,
        pageSize,
        total: count,
        adjustments: rows.map((row) => {
            const subject = byId.get(row.user_id);
            const admin = byId.get(row.admin_id);
            return {
                ...serializeAdjustment(row),
                userEmail: subject?.email ?? null,
                userName: subject?.name ?? null,
                adminEmail: admin?.email ?? null,
                adminName: admin?.name ?? null
            };
        })
    };
}
