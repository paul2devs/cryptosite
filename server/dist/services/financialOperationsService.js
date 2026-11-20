"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postBalancedEntry = postBalancedEntry;
exports.recordConfirmedDeposit = recordConfirmedDeposit;
exports.ledgerBalancesForUser = ledgerBalancesForUser;
exports.recordVerifiedValuation = recordVerifiedValuation;
exports.markMissingPerformance = markMissingPerformance;
exports.adminOverview = adminOverview;
exports.listUsers = listUsers;
exports.userProfile = userProfile;
exports.listDeposits = listDeposits;
exports.listWithdrawals = listWithdrawals;
exports.reviewWithdrawal = reviewWithdrawal;
exports.listLedger = listLedger;
exports.userPerformance = userPerformance;
exports.listActivity = listActivity;
exports.adminPerformance = adminPerformance;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const earningsRules_1 = require("../domain/earningsRules");
const money_1 = require("../domain/money");
const ledgerRules_1 = require("../domain/ledgerRules");
const performanceRules_1 = require("../domain/performanceRules");
const transactionRules_1 = require("../domain/transactionRules");
const withdrawalRules_1 = require("../domain/withdrawalRules");
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const DailyPerformanceSnapshot_1 = require("../models/DailyPerformanceSnapshot");
const Deposit_1 = require("../models/Deposit");
const InvestmentPosition_1 = require("../models/InvestmentPosition");
const LedgerAccount_1 = require("../models/LedgerAccount");
const LedgerEntry_1 = require("../models/LedgerEntry");
const MembershipHistory_1 = require("../models/MembershipHistory");
const Notification_1 = require("../models/Notification");
const PerformanceCalculationLog_1 = require("../models/PerformanceCalculationLog");
const User_1 = require("../models/User");
const UserActivityEvent_1 = require("../models/UserActivityEvent");
const UserMembership_1 = require("../models/UserMembership");
const Withdrawal_1 = require("../models/Withdrawal");
const activityService_1 = require("./activityService");
const bonusEngineService_1 = require("./bonusEngineService");
const financialNotificationService_1 = require("./financialNotificationService");
const investmentLevelService_1 = require("./investmentLevelService");
const membershipService_1 = require("./membershipService");
const performanceService_1 = require("./performanceService");
const platformSettingsService_1 = require("./platformSettingsService");
const ACCOUNT_CODES = [
    "confirmed_deposits",
    "available_balance",
    "invested_principal",
    "locked_principal",
    "realized_earnings",
    "pending_settlement",
    "withdrawals",
    "fees",
    "adjustments",
    "promotional_credits"
];
async function accountFor(userId, code, asset, transaction) {
    const [account] = await LedgerAccount_1.LedgerAccount.findOrCreate({
        where: { user_id: userId, code, asset },
        defaults: { user_id: userId, code, asset },
        transaction
    });
    return account;
}
async function postBalancedEntry(input) {
    const amount = (0, money_1.formatDecimal)((0, money_1.parseDecimal)(input.amount, 8), 8);
    const debitKey = (0, ledgerRules_1.buildLedgerIdempotencyKey)(input.sourceType, input.sourceId, input.debit);
    const existing = await LedgerEntry_1.LedgerEntry.findOne({ where: { idempotency_key: debitKey }, transaction: input.transaction });
    if (existing)
        return;
    const write = async (transaction) => {
        const debit = await accountFor(input.userId, input.debit, input.asset, transaction);
        const credit = await accountFor(input.userId, input.credit, input.asset, transaction);
        try {
            await LedgerEntry_1.LedgerEntry.create({
                account_id: debit.account_id,
                user_id: input.userId,
                direction: "debit",
                amount,
                asset: input.asset,
                transaction_type: input.transactionType,
                source_type: input.sourceType,
                source_id: input.sourceId,
                idempotency_key: debitKey
            }, { transaction });
            await LedgerEntry_1.LedgerEntry.create({
                account_id: credit.account_id,
                user_id: input.userId,
                direction: "credit",
                amount,
                asset: input.asset,
                transaction_type: input.transactionType,
                source_type: input.sourceType,
                source_id: input.sourceId,
                idempotency_key: (0, ledgerRules_1.buildLedgerIdempotencyKey)(input.sourceType, input.sourceId, input.credit)
            }, { transaction });
        }
        catch (error) {
            if (!(error instanceof sequelize_1.UniqueConstraintError))
                throw error;
        }
    };
    if (input.transaction) {
        await write(input.transaction);
        return;
    }
    await database_1.sequelize.transaction(write);
}
async function recordConfirmedDeposit(deposit) {
    // The independently verified on-chain quantity is the amount credited. The
    // originally requested amount (deposit.amount) stays on the record unchanged,
    // and no market price is ever substituted for what was actually received.
    const amount = Number(deposit.received_amount ?? deposit.amount).toFixed(8);
    await postBalancedEntry({
        userId: deposit.user_id,
        asset: deposit.crypto_type,
        amount,
        transactionType: "deposit_confirmed",
        sourceType: "deposit",
        sourceId: deposit.deposit_id,
        debit: "confirmed_deposits",
        credit: "invested_principal"
    });
    const [position, positionCreated] = await InvestmentPosition_1.InvestmentPosition.findOrCreate({
        where: { deposit_id: deposit.deposit_id },
        defaults: {
            user_id: deposit.user_id,
            deposit_id: deposit.deposit_id,
            asset: deposit.crypto_type,
            principal: amount,
            strategy: "custody_hold",
            status: "active",
            verification_status: "unavailable"
        }
    });
    await (0, membershipService_1.syncUserMembership)(deposit.user_id, "Confirmed deposit changed verified qualifying amount");
    await (0, investmentLevelService_1.syncUserInvestmentLevel)(deposit.user_id, "Confirmed deposit changed verified invested principal");
    const depositReference = (0, transactionRules_1.generateReference)("deposit", deposit.deposit_id);
    await (0, financialNotificationService_1.notifyFinancialEvent)({
        userId: deposit.user_id,
        type: "deposit_confirmed",
        templateKey: "depositConfirmation",
        variables: { amount, asset: deposit.crypto_type, reference: depositReference },
        fallbackMessage: `Deposit ${amount} ${deposit.crypto_type} confirmed. Reference ${depositReference}.`
    });
    if (positionCreated) {
        await (0, financialNotificationService_1.notifyFinancialEvent)({
            userId: deposit.user_id,
            type: "investment_allocation",
            templateKey: "investmentAllocation",
            variables: {
                amount,
                asset: deposit.crypto_type,
                position: position.position_id,
                reference: depositReference
            },
            fallbackMessage: `Investment allocation of ${amount} ${deposit.crypto_type} recorded against position ${position.position_id}. Reference ${depositReference}.`
        });
        await (0, activityService_1.trackUserActivity)(deposit.user_id, "investment_allocation", {
            position_id: position.position_id,
            deposit_id: deposit.deposit_id,
            amount,
            asset: deposit.crypto_type
        });
    }
    await (0, bonusEngineService_1.creditPromotionalBonus)(deposit);
}
async function ledgerBalancesForUser(userId) {
    const accounts = await LedgerAccount_1.LedgerAccount.findAll({ where: { user_id: userId } });
    const entries = await LedgerEntry_1.LedgerEntry.findAll({ where: { user_id: userId }, order: [["created_at", "ASC"]] });
    const byAccount = new Map(accounts.map((account) => [account.account_id, account]));
    const totals = {};
    for (const code of ACCOUNT_CODES)
        totals[code] = "0.00000000";
    for (const entry of entries) {
        const account = byAccount.get(entry.account_id);
        if (!account)
            continue;
        const current = (0, money_1.parseDecimal)(totals[account.code] || "0.00000000", 8);
        const amount = (0, money_1.parseDecimal)(String(entry.amount), 8);
        totals[account.code] = (0, money_1.formatDecimal)(entry.direction === "credit" ? current + amount : current - amount, 8);
    }
    return { totals, entries };
}
async function recordVerifiedValuation(adminId, input) {
    const position = await InvestmentPosition_1.InvestmentPosition.findByPk(input.positionId);
    if (!position)
        throw new Error("Position not found");
    if (!input.reason.trim() || !input.evidenceRef.trim() || !input.dataSource.trim()) {
        throw new Error("A source, evidence reference, and reason are required.");
    }
    const existing = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findOne({
        where: {
            position_id: position.position_id,
            snapshot_date: input.snapshotDate,
            verification_status: "verified",
            correction_of: input.correctionOf ?? null
        }
    });
    if (existing && !input.correctionOf)
        return existing;
    const opening = position.current_valuation || position.principal;
    const result = (0, performanceRules_1.calculateDailyPerformance)({
        openingCents: (0, money_1.parseDecimal)(String(opening), 8),
        closingCents: (0, money_1.parseDecimal)(input.closingValuation, 8),
        cashFlowCents: (0, money_1.parseDecimal)(input.cashFlow || "0", 8),
        verified: true
    });
    const snapshot = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.create({
        user_id: position.user_id,
        position_id: position.position_id,
        snapshot_date: input.snapshotDate,
        opening_valuation: (0, money_1.formatDecimal)((0, money_1.parseDecimal)(String(opening), 8), 8),
        closing_valuation: (0, money_1.formatDecimal)((0, money_1.parseDecimal)(input.closingValuation, 8), 8),
        cash_flow: (0, money_1.formatDecimal)((0, money_1.parseDecimal)(input.cashFlow || "0", 8), 8),
        profit_loss: result.profitCents === null ? null : (0, money_1.formatDecimal)(result.profitCents, 8),
        roi_percent: result.roiPercent,
        strategy: position.strategy,
        data_source: `${input.dataSource}:${input.evidenceRef}`,
        verification_status: "verified",
        correction_of: input.correctionOf ?? null,
        reason: input.reason
    });
    position.current_valuation = snapshot.closing_valuation;
    position.verification_status = "verified";
    position.last_calculated_at = new Date();
    await position.save();
    await PerformanceCalculationLog_1.PerformanceCalculationLog.create({
        position_id: position.position_id,
        snapshot_date: input.snapshotDate,
        outcome: "verified",
        message: `Verified valuation recorded from ${input.dataSource}. Unrealized performance is not withdrawable.`
    });
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: input.correctionOf ? "performance_correction" : "performance_verified",
        entity_type: "daily_performance_snapshot",
        entity_id: snapshot.snapshot_id,
        reason: input.reason,
        metadata: { evidenceRef: input.evidenceRef, dataSource: input.dataSource }
    });
    await notifyVerifiedPerformance(position.user_id, input.snapshotDate, result.roiPercent, result.profitCents);
    return snapshot;
}
function notificationFlag(settings, key) {
    if (!settings || typeof settings !== "object")
        return false;
    const notifications = settings.notifications;
    return Boolean(notifications && notifications[key] === true);
}
async function notifyVerifiedPerformance(userId, snapshotDate, roiPercent, profitCents) {
    const user = await User_1.User.findByPk(userId);
    if (!user || roiPercent === null || profitCents === null)
        return;
    const direction = profitCents < 0n ? "loss" : profitCents === 0n ? "flat" : "gain";
    if (notificationFlag(user.account_settings, "daily_performance")) {
        await Notification_1.Notification.create({
            user_id: userId,
            type: "daily_performance",
            message: `Verified ${direction} for ${snapshotDate}: ${roiPercent}%. This result is unrealized and is not withdrawable cash.`
        });
    }
    const magnitude = (0, money_1.parseDecimal)(roiPercent.replace("-", ""), 6);
    if (notificationFlag(user.account_settings, "significant_moves") && magnitude >= 5000000n) {
        await Notification_1.Notification.create({
            user_id: userId,
            type: "significant_performance",
            message: `Verified performance moved ${roiPercent}% on ${snapshotDate}. The change stays unrealized until a distribution is recorded.`
        });
    }
}
async function markMissingPerformance(snapshotDate) {
    const positions = await InvestmentPosition_1.InvestmentPosition.findAll({ where: { status: "active" } });
    for (const position of positions) {
        const existing = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findOne({
            where: { position_id: position.position_id, snapshot_date: snapshotDate, verification_status: "verified" }
        });
        if (existing)
            continue;
        const already = await PerformanceCalculationLog_1.PerformanceCalculationLog.findOne({
            where: { position_id: position.position_id, snapshot_date: snapshotDate, outcome: "unavailable" }
        });
        if (already)
            continue;
        await PerformanceCalculationLog_1.PerformanceCalculationLog.create({
            position_id: position.position_id,
            snapshot_date: snapshotDate,
            outcome: "unavailable",
            message: "No verified valuation was supplied for this date."
        });
    }
}
function pageQuery(query) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 20)));
    return { page, pageSize, offset: (page - 1) * pageSize };
}
async function adminOverview() {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    const [users, activeUsers, newUsers, deposits, withdrawals, positions, activity] = await Promise.all([
        User_1.User.count(),
        User_1.User.count({ where: { last_activity_at: { [sequelize_1.Op.gte]: since } } }),
        User_1.User.count({ where: { created_at: { [sequelize_1.Op.gte]: day } } }),
        Deposit_1.Deposit.findAll(),
        Withdrawal_1.Withdrawal.findAll(),
        InvestmentPosition_1.InvestmentPosition.count({ where: { status: "active" } }),
        UserActivityEvent_1.UserActivityEvent.findAll({ order: [["timestamp", "DESC"]], limit: 20 })
    ]);
    const confirmed = deposits.filter((row) => row.status === "Approved");
    const pendingDeposits = deposits.filter((row) => row.status === "Pending").length;
    const pendingWithdrawals = withdrawals.filter((row) => row.status === "Pending" || row.detailed_status === "requested" || row.detailed_status === "under_review").length;
    const completedWithdrawals = withdrawals.filter((row) => row.status === "Approved" || row.detailed_status === "completed");
    return {
        totalUsers: users,
        activeUsers,
        newRegistrations: newUsers,
        verifiedUsers: null,
        verificationNote: "Email verification status is not tracked on the user record.",
        confirmedDepositCount: confirmed.length,
        confirmedWithdrawalCount: completedWithdrawals.length,
        pendingDeposits,
        pendingWithdrawals,
        assetsUnderCustody: null,
        custodyNote: "On-chain custody reconciliation is unavailable until a custody balance source is configured.",
        activePositions: positions,
        realizedPerformance: null,
        performanceNote: "Realized performance is unavailable unless verified ledger earnings exist.",
        recentActivity: activity.map((event) => ({
            id: event.id,
            type: event.type,
            userId: event.user_id,
            timestamp: event.timestamp,
            metadata: event.metadata
        }))
    };
}
async function listUsers(query) {
    const { page, pageSize, offset } = pageQuery(query);
    const where = {};
    const q = String(query.q || "").trim();
    if (q) {
        where[sequelize_1.Op.or] = [
            { email: { [sequelize_1.Op.iLike]: `%${q}%` } },
            { name: { [sequelize_1.Op.iLike]: `%${q}%` } },
            { user_id: q }
        ];
    }
    const status = String(query.status || "");
    if (status === "restricted")
        where.bonus_blocked = true;
    if (status === "active")
        where.bonus_blocked = false;
    const tierFilter = String(query.membership || "");
    if (tierFilter) {
        const members = await UserMembership_1.UserMembership.findAll({ where: { tier_id: tierFilter }, attributes: ["user_id"] });
        where.user_id = { [sequelize_1.Op.in]: members.map((member) => member.user_id) };
    }
    const { rows, count } = await User_1.User.findAndCountAll({ where, limit: pageSize, offset, order: [["created_at", "DESC"]] });
    const mapped = [];
    for (const user of rows) {
        const membership = await UserMembership_1.UserMembership.findByPk(user.user_id);
        const confirmed = await Deposit_1.Deposit.sum("amount", { where: { user_id: user.user_id, status: "Approved" } });
        mapped.push({
            userId: user.user_id,
            name: user.name,
            email: user.email,
            createdAt: user.created_at,
            level: user.level,
            membershipTierId: membership?.tier_id ?? null,
            qualifyingAmount: membership ? String(membership.qualifying_amount) : "0.00",
            withdrawableBalance: user.withdrawable_balance,
            lockedBalance: user.locked_balance,
            confirmedDepositTotal: confirmed || 0,
            lastActivityAt: user.last_activity_at,
            accountStatus: user.bonus_blocked ? "restricted" : "active",
            verificationStatus: "not_tracked"
        });
    }
    return { page, pageSize, total: count, users: mapped };
}
async function userProfile(userId) {
    const user = await User_1.User.findByPk(userId);
    if (!user)
        throw new Error("User not found");
    const [deposits, withdrawals, ledger, positions, activity, membership, history] = await Promise.all([
        Deposit_1.Deposit.findAll({ where: { user_id: userId }, order: [["timestamp", "DESC"]], limit: 50 }),
        Withdrawal_1.Withdrawal.findAll({ where: { user_id: userId }, order: [["timestamp", "DESC"]], limit: 50 }),
        ledgerBalancesForUser(userId),
        InvestmentPosition_1.InvestmentPosition.findAll({ where: { user_id: userId } }),
        UserActivityEvent_1.UserActivityEvent.findAll({ where: { user_id: userId }, order: [["timestamp", "DESC"]], limit: 50 }),
        UserMembership_1.UserMembership.findByPk(userId),
        MembershipHistory_1.MembershipHistory.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]], limit: 50 })
    ]);
    return {
        account: { userId: user.user_id, name: user.name, email: user.email, createdAt: user.created_at, isAdmin: user.is_admin },
        membership,
        deposits,
        withdrawals,
        ledger,
        positions,
        activity,
        history
    };
}
async function listDeposits(query) {
    const { page, pageSize, offset } = pageQuery(query);
    const where = {};
    const status = String(query.status || "");
    const statusMap = { pending: "Pending", confirmed: "Approved", failed: "Rejected", under_review: "UnderReview" };
    if (status && statusMap[status])
        where.status = statusMap[status];
    if (query.asset)
        where.crypto_type = String(query.asset);
    if (query.network)
        where.network = String(query.network);
    if (query.from || query.to) {
        where.timestamp = {
            ...(query.from ? { [sequelize_1.Op.gte]: new Date(String(query.from)) } : {}),
            ...(query.to ? { [sequelize_1.Op.lte]: new Date(String(query.to)) } : {})
        };
    }
    const { rows, count } = await Deposit_1.Deposit.findAndCountAll({ where, include: [{ model: User_1.User }], limit: pageSize, offset, order: [["timestamp", "DESC"]] });
    return { page, pageSize, total: count, deposits: rows };
}
async function listWithdrawals(query) {
    const { page, pageSize, offset } = pageQuery(query);
    const where = {};
    if (query.status)
        where.detailed_status = String(query.status);
    const { rows, count } = await Withdrawal_1.Withdrawal.findAndCountAll({ where, include: [{ model: User_1.User }], limit: pageSize, offset, order: [["timestamp", "DESC"]] });
    return { page, pageSize, total: count, withdrawals: rows };
}
async function reviewWithdrawal(adminId, withdrawalId, status, reason, txHash) {
    if (!reason.trim())
        throw new Error("A recorded reason is required");
    const withdrawal = await database_1.sequelize.transaction(async (transaction) => {
        const row = await Withdrawal_1.Withdrawal.findByPk(withdrawalId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row)
            throw new Error("Withdrawal not found");
        const current = (0, withdrawalRules_1.deriveWithdrawalStatus)(row.status, row.detailed_status);
        (0, withdrawalRules_1.assertWithdrawalTransition)(current, status);
        const asset = row.asset || "USD";
        const amount = Number(row.amount).toFixed(8);
        const reservation = await LedgerEntry_1.LedgerEntry.findOne({
            where: { source_type: "withdrawal_reserve", source_id: row.withdrawal_id },
            transaction
        });
        const hasReservation = Boolean(reservation);
        row.detailed_status = status;
        row.review_reason = reason;
        row.processed_at = new Date();
        if (txHash)
            row.tx_hash = txHash;
        row.status = (0, withdrawalRules_1.coarseStatusForDetailed)(status);
        await row.save({ transaction });
        if (status === "completed") {
            await postBalancedEntry({
                userId: row.user_id,
                asset,
                amount,
                transactionType: "withdrawal_completed",
                sourceType: "withdrawal_complete",
                sourceId: row.withdrawal_id,
                debit: hasReservation ? "pending_settlement" : "available_balance",
                credit: "withdrawals",
                transaction
            });
        }
        else if (status === "rejected" || status === "failed" || status === "cancelled") {
            if (hasReservation) {
                await postBalancedEntry({
                    userId: row.user_id,
                    asset,
                    amount,
                    transactionType: "withdrawal_released",
                    sourceType: "withdrawal_release",
                    sourceId: row.withdrawal_id,
                    debit: "pending_settlement",
                    credit: "available_balance",
                    transaction
                });
                const owner = await User_1.User.findByPk(row.user_id, { transaction, lock: transaction.LOCK.UPDATE });
                if (owner) {
                    owner.withdrawable_balance = Number((Number(owner.withdrawable_balance) + Number(row.amount)).toFixed(8));
                    await owner.save({ transaction });
                }
            }
        }
        await AdminAuditLog_1.AdminAuditLog.create({
            admin_id: adminId,
            action: "withdrawal_reviewed",
            entity_type: "withdrawal",
            entity_id: row.withdrawal_id,
            reason,
            metadata: { status, previous: current, reservationReleased: status !== "completed" && hasReservation }
        }, { transaction });
        return row;
    });
    await (0, activityService_1.trackUserActivity)(withdrawal.user_id, "withdrawal_reviewed", {
        withdrawalId: withdrawal.withdrawal_id,
        status,
        outcome: "recorded"
    });
    const owner = await User_1.User.findByPk(withdrawal.user_id);
    if (owner && notificationFlag(owner.account_settings, "withdrawal_updates")) {
        await Notification_1.Notification.create({
            user_id: owner.user_id,
            type: "withdrawal_status",
            message: `Withdrawal ${withdrawal.withdrawal_id} is ${status}. Reason: ${reason}`
        });
    }
    return withdrawal;
}
async function listLedger(query) {
    if (query.entryId) {
        const entry = await LedgerEntry_1.LedgerEntry.findByPk(String(query.entryId));
        if (!entry)
            throw new Error("Ledger entry not found");
        const pair = await LedgerEntry_1.LedgerEntry.findAll({
            where: { source_type: entry.source_type, source_id: entry.source_id },
            order: [["created_at", "ASC"]]
        });
        return { entry, related: pair };
    }
    const { page, pageSize, offset } = pageQuery(query);
    const where = {};
    if (query.type)
        where.transaction_type = String(query.type);
    if (query.asset)
        where.asset = String(query.asset);
    const { rows, count } = await LedgerEntry_1.LedgerEntry.findAndCountAll({ where, limit: pageSize, offset, order: [["created_at", "DESC"]] });
    return { page, pageSize, total: count, entries: rows };
}
function latestByPositionDate(rows) {
    const chosen = new Map();
    for (const row of rows) {
        const key = `${row.position_id}:${row.snapshot_date}`;
        const current = chosen.get(key);
        if (!current || current.created_at < row.created_at)
            chosen.set(key, row);
    }
    return [...chosen.values()].sort((left, right) => String(left.snapshot_date).localeCompare(String(right.snapshot_date)));
}
async function userPerformance(userId, range) {
    const [overview, settings] = await Promise.all([(0, performanceService_1.getPerformanceOverview)(userId, range), (0, platformSettingsService_1.getPerformanceSettings)()]);
    const principal = overview.overview.investedPrincipal;
    return {
        range,
        methodology: overview.methodology,
        metrics: overview.overview,
        chart: overview.chart,
        history: overview.snapshots,
        dailyHistory: overview.history,
        today: overview.today,
        cumulative: overview.cumulative,
        realizedEarnings: overview.realizedEarnings,
        note: overview.note,
        projection: {
            dailyRatePercent: settings.illustrativeDailyRatePercent,
            periodDays: settings.illustrativePeriodDays,
            periodRoiPercent: (0, earningsRules_1.periodRoiPercent)(settings.illustrativeDailyRatePercent, settings.illustrativePeriodDays),
            disclaimer: settings.illustrativeDisclaimer,
            principal,
            projectedDailyEarnings: (0, earningsRules_1.projectedDailyEarnings)(principal, settings.illustrativeDailyRatePercent),
            projectedPeriodEarnings: (0, earningsRules_1.projectedEarningsSeries)(principal, settings.illustrativeDailyRatePercent, settings.illustrativePeriodDays),
            credited: false,
            guaranteed: false
        }
    };
}
async function listActivity(query) {
    const { page, pageSize, offset } = pageQuery(query);
    const { rows, count } = await UserActivityEvent_1.UserActivityEvent.findAndCountAll({
        limit: pageSize,
        offset,
        order: [["timestamp", "DESC"]]
    });
    const audits = await AdminAuditLog_1.AdminAuditLog.findAll({ order: [["created_at", "DESC"]], limit: pageSize });
    return {
        page,
        pageSize,
        total: count,
        events: rows.map((event) => ({
            id: event.id,
            type: event.type,
            actorId: event.user_id,
            entityId: event.user_id,
            timestamp: event.timestamp,
            metadata: event.metadata,
            outcome: "recorded"
        })),
        adminActions: audits.map((audit) => ({
            id: audit.audit_id,
            type: audit.action,
            actorId: audit.admin_id,
            entityId: audit.entity_id,
            timestamp: audit.created_at,
            metadata: { entityType: audit.entity_type },
            outcome: "recorded",
            reason: audit.reason
        }))
    };
}
async function adminPerformance() {
    const [snapshots, logs, positions] = await Promise.all([
        DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findAll({ order: [["created_at", "DESC"]], limit: 200 }),
        PerformanceCalculationLog_1.PerformanceCalculationLog.findAll({ order: [["created_at", "DESC"]], limit: 200 }),
        InvestmentPosition_1.InvestmentPosition.findAll({ where: { status: "active" }, limit: 200 })
    ]);
    const latest = latestByPositionDate(snapshots);
    const verified = latest.filter((row) => row.verification_status === "verified" && row.profit_loss !== null);
    const totals = (0, performanceRules_1.sumVerifiedPerformance)(verified.map((row) => (0, money_1.parseDecimal)(String(row.profit_loss), 8)), 0n);
    const byStrategy = new Map();
    for (const row of verified) {
        const current = byStrategy.get(row.strategy) ?? 0n;
        byStrategy.set(row.strategy, current + (0, money_1.parseDecimal)(String(row.profit_loss), 8));
    }
    return {
        snapshots,
        logs,
        positions,
        verifiedProfitLoss: totals.profitCents === null ? null : (0, money_1.formatDecimal)(totals.profitCents, 8),
        missing: logs.filter((row) => row.outcome === "unavailable").length,
        failed: logs.filter((row) => row.outcome === "failed").length,
        byStrategy: [...byStrategy.entries()].map(([strategy, profit]) => ({
            strategy,
            profitLoss: (0, money_1.formatDecimal)(profit, 8)
        }))
    };
}
