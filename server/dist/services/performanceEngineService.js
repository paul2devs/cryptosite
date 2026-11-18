"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDailyPerformanceCycle = runDailyPerformanceCycle;
exports.recordProfitDistribution = recordProfitDistribution;
exports.reconcilePerformanceAgainstLedger = reconcilePerformanceAgainstLedger;
exports.dailyPerformanceSummary = dailyPerformanceSummary;
const crypto_1 = require("crypto");
const sequelize_1 = require("sequelize");
const performanceRules_1 = require("../domain/performanceRules");
const money_1 = require("../domain/money");
const transactionRules_1 = require("../domain/transactionRules");
const earningsRules_1 = require("../domain/earningsRules");
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const DailyPerformanceSnapshot_1 = require("../models/DailyPerformanceSnapshot");
const Deposit_1 = require("../models/Deposit");
const InvestmentPosition_1 = require("../models/InvestmentPosition");
const LedgerAccount_1 = require("../models/LedgerAccount");
const LedgerEntry_1 = require("../models/LedgerEntry");
const PerformanceCalculationLog_1 = require("../models/PerformanceCalculationLog");
const User_1 = require("../models/User");
const financialNotificationService_1 = require("./financialNotificationService");
const financialOperationsService_1 = require("./financialOperationsService");
const platformSettingsService_1 = require("./platformSettingsService");
const VERIFIED_POSITION_SOURCE = "verified_position_valuation";
const AMOUNT_SCALE = 8;
function dayKeyOf(value) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
}
function dayBounds(date) {
    return { start: new Date(`${date}T00:00:00.000Z`), end: new Date(`${date}T23:59:59.999Z`) };
}
function signedProfitLabel(profitCents, roiPercent, asset, date) {
    const magnitude = (0, money_1.formatDecimal)(profitCents < 0n ? -profitCents : profitCents, AMOUNT_SCALE);
    const direction = profitCents > 0n ? "gain" : profitCents < 0n ? "loss" : "flat";
    return `${direction} of ${magnitude} ${asset} on ${date}${roiPercent === null ? "" : ` (ROI ${roiPercent}%)`}`;
}
// Scheduled daily investment performance engine. For every active position that is
// eligible to be measured on the given date (i.e. the day after its deposit was
// independently verified and confirmed), it computes realised/unrealised daily
// performance strictly from the position's verified valuation and the
// authoritative ledger. If no verified valuation exists, it records the day as
// unavailable instead of inventing a return.
async function runDailyPerformanceCycle(snapshotDate) {
    if ((0, earningsRules_1.isFutureSnapshot)(snapshotDate)) {
        return { snapshotDate, positionsEvaluated: 0, snapshotsRecorded: 0, unavailableRecorded: 0, skipped: 0, usersNotified: 0 };
    }
    const settings = await (0, platformSettingsService_1.getPerformanceSettings)();
    const positions = await InvestmentPosition_1.InvestmentPosition.findAll({ where: { status: "active" } });
    const depositIds = positions
        .map((position) => position.deposit_id)
        .filter((depositId) => depositId !== null);
    const deposits = depositIds.length > 0 ? await Deposit_1.Deposit.findAll({ where: { deposit_id: { [sequelize_1.Op.in]: depositIds } } }) : [];
    const confirmedByDeposit = new Map(deposits.map((deposit) => [deposit.deposit_id, deposit.confirmed_at ? new Date(deposit.confirmed_at) : null]));
    const { start, end } = dayBounds(snapshotDate);
    const flowEntries = await LedgerEntry_1.LedgerEntry.findAll({
        where: { transaction_type: "deposit_confirmed", created_at: { [sequelize_1.Op.gte]: start, [sequelize_1.Op.lte]: end } }
    });
    const cashFlowByDeposit = new Map();
    for (const entry of flowEntries) {
        const current = cashFlowByDeposit.get(entry.source_id) ?? 0n;
        cashFlowByDeposit.set(entry.source_id, current + (0, money_1.parseDecimal)(String(entry.amount), AMOUNT_SCALE));
    }
    let snapshotsRecorded = 0;
    let unavailableRecorded = 0;
    let skipped = 0;
    const notifiedUsers = new Set();
    for (const position of positions) {
        const confirmedAt = (position.deposit_id ? confirmedByDeposit.get(position.deposit_id) : undefined) ?? null;
        if (!(0, earningsRules_1.isPerformanceDayEligible)(confirmedAt, snapshotDate)) {
            skipped += 1;
            continue;
        }
        const alreadyVerified = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findOne({
            where: { position_id: position.position_id, snapshot_date: snapshotDate, verification_status: "verified" }
        });
        if (alreadyVerified) {
            skipped += 1;
            continue;
        }
        const previous = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findOne({
            where: { position_id: position.position_id, snapshot_date: { [sequelize_1.Op.lt]: snapshotDate }, verification_status: "verified" },
            order: [["snapshot_date", "DESC"]]
        });
        const opening = previous && previous.closing_valuation !== null ? (0, money_1.parseDecimal)(String(previous.closing_valuation), AMOUNT_SCALE) : (0, money_1.parseDecimal)(String(position.principal), AMOUNT_SCALE);
        const valuationIsCurrent = position.verification_status === "verified" &&
            position.current_valuation !== null &&
            position.last_calculated_at !== null &&
            dayKeyOf(position.last_calculated_at) === snapshotDate;
        if (!valuationIsCurrent) {
            const existingLog = await PerformanceCalculationLog_1.PerformanceCalculationLog.findOne({
                where: { position_id: position.position_id, snapshot_date: snapshotDate, outcome: "unavailable" }
            });
            if (!existingLog) {
                await PerformanceCalculationLog_1.PerformanceCalculationLog.create({
                    position_id: position.position_id,
                    snapshot_date: snapshotDate,
                    outcome: "unavailable",
                    message: "No independently verified valuation was recorded for this position on this date."
                });
                unavailableRecorded += 1;
            }
            else {
                skipped += 1;
            }
            continue;
        }
        const closing = (0, money_1.parseDecimal)(String(position.current_valuation), AMOUNT_SCALE);
        const cashFlow = (position.deposit_id ? cashFlowByDeposit.get(position.deposit_id) : undefined) ?? 0n;
        const result = (0, performanceRules_1.calculateDailyPerformance)({
            openingCents: opening,
            closingCents: closing,
            cashFlowCents: cashFlow,
            verified: settings.requireVerifiedValuation
        });
        const snapshot = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.create({
            user_id: position.user_id,
            position_id: position.position_id,
            snapshot_date: snapshotDate,
            opening_valuation: (0, money_1.formatDecimal)(opening, AMOUNT_SCALE),
            closing_valuation: (0, money_1.formatDecimal)(closing, AMOUNT_SCALE),
            cash_flow: (0, money_1.formatDecimal)(cashFlow, AMOUNT_SCALE),
            profit_loss: result.profitCents === null ? null : (0, money_1.formatDecimal)(result.profitCents, AMOUNT_SCALE),
            roi_percent: result.roiPercent,
            strategy: position.strategy,
            data_source: VERIFIED_POSITION_SOURCE,
            verification_status: "verified",
            correction_of: null,
            reason: "Scheduled daily performance calculation from the position's independently verified valuation."
        });
        snapshotsRecorded += 1;
        await PerformanceCalculationLog_1.PerformanceCalculationLog.create({
            position_id: position.position_id,
            snapshot_date: snapshotDate,
            outcome: "verified",
            message: `Daily performance computed from verified valuation. Reference ${snapshot.snapshot_id}.`
        });
        if (settings.automaticDailyCalculation && result.profitCents !== null) {
            await (0, financialNotificationService_1.notifyFinancialEvent)({
                userId: position.user_id,
                type: "daily_performance",
                templateKey: "dailyPerformance",
                variables: {
                    date: snapshotDate,
                    detail: signedProfitLabel(result.profitCents, result.roiPercent, position.asset, snapshotDate),
                    source: VERIFIED_POSITION_SOURCE,
                    reference: snapshot.snapshot_id
                },
                fallbackMessage: `Daily performance for ${snapshotDate}: ${signedProfitLabel(result.profitCents, result.roiPercent, position.asset, snapshotDate)}. Reference ${snapshot.snapshot_id}.`
            });
            notifiedUsers.add(position.user_id);
        }
    }
    return {
        snapshotDate,
        positionsEvaluated: positions.length,
        snapshotsRecorded,
        unavailableRecorded,
        skipped,
        usersNotified: notifiedUsers.size
    };
}
// Moves previously verified realised earnings into the user's withdrawable balance.
// This is the only path that turns performance into withdrawable cash, and it always
// posts a balanced profit_distribution ledger transaction so realised profit is a
// distinct, auditable category. Unrealised performance is never distributed here.
async function recordProfitDistribution(adminId, input) {
    if (!input.reason.trim())
        throw new Error("A reason is required to distribute realised profit.");
    const amount = (0, money_1.formatDecimal)((0, money_1.parseDecimal)(input.amount, AMOUNT_SCALE), AMOUNT_SCALE);
    if ((0, money_1.parseDecimal)(amount, AMOUNT_SCALE) <= 0n)
        throw new Error("The distribution amount must be greater than zero.");
    const user = await User_1.User.findByPk(input.userId);
    if (!user)
        throw new Error("User not found");
    const reference = (0, transactionRules_1.generateReference)("profit_distribution", (0, crypto_1.randomUUID)());
    await (0, financialOperationsService_1.postBalancedEntry)({
        userId: user.user_id,
        asset: input.asset,
        amount,
        transactionType: "profit_distribution",
        sourceType: "profit_distribution",
        sourceId: (0, crypto_1.randomUUID)(),
        debit: "realized_earnings",
        credit: "available_balance"
    });
    user.withdrawable_balance = Number((Number(user.withdrawable_balance) + Number(amount)).toFixed(AMOUNT_SCALE));
    await user.save();
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: "profit_distribution",
        entity_type: "user",
        entity_id: user.user_id,
        reason: input.reason,
        metadata: { amount, asset: input.asset, reference }
    });
    await (0, financialNotificationService_1.notifyFinancialEvent)({
        userId: user.user_id,
        type: "profit_realised",
        templateKey: "profitRealised",
        variables: { amount, asset: input.asset, reference },
        fallbackMessage: `Realised earnings of ${amount} ${input.asset} credited to your withdrawable balance. Reference ${reference}.`
    });
    return { userId: user.user_id, amount, asset: input.asset, reference };
}
// Cross-checks each verified daily snapshot's arithmetic and confirms the opening
// capital measured by the engine agrees with the authoritative ledger's
// invested_principal balance for the affected account.
async function reconcilePerformanceAgainstLedger(adminId, date, userId) {
    const where = { snapshot_date: date, verification_status: "verified" };
    if (userId)
        where.user_id = userId;
    const snapshots = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findAll({ where });
    const issues = [];
    const settings = await (0, platformSettingsService_1.getReconciliationSettings)();
    const tolerance = (0, money_1.parseDecimal)(settings.toleranceAmount, AMOUNT_SCALE);
    const usersChecked = new Set();
    for (const snapshot of snapshots) {
        usersChecked.add(snapshot.user_id);
        const opening = (0, money_1.parseDecimal)(String(snapshot.opening_valuation), AMOUNT_SCALE);
        const closing = snapshot.closing_valuation === null ? null : (0, money_1.parseDecimal)(String(snapshot.closing_valuation), AMOUNT_SCALE);
        const cashFlow = (0, money_1.parseDecimal)(String(snapshot.cash_flow), AMOUNT_SCALE);
        const profit = snapshot.profit_loss === null ? null : (0, money_1.parseDecimal)(String(snapshot.profit_loss), AMOUNT_SCALE);
        if (closing !== null && profit !== null) {
            const expected = closing - (opening + cashFlow);
            const delta = expected > profit ? expected - profit : profit - expected;
            if (delta > tolerance) {
                issues.push({
                    code: "snapshot_arithmetic_mismatch",
                    reference: snapshot.snapshot_id,
                    detail: `Recorded profit ${profit.toString()} does not equal closing minus adjusted opening ${expected.toString()}.`
                });
            }
        }
        if (opening < 0n) {
            issues.push({
                code: "negative_opening_capital",
                reference: snapshot.snapshot_id,
                detail: "Opening capital for the day is negative."
            });
        }
    }
    for (const checkedUserId of usersChecked) {
        const [accounts, entries] = await Promise.all([
            LedgerAccount_1.LedgerAccount.findAll({ where: { user_id: checkedUserId } }),
            LedgerEntry_1.LedgerEntry.findAll({ where: { user_id: checkedUserId } })
        ]);
        const byAccount = new Map(accounts.map((account) => [account.account_id, account]));
        let invested = 0n;
        for (const entry of entries) {
            const account = byAccount.get(entry.account_id);
            if (!account || account.code !== "invested_principal")
                continue;
            const amount = (0, money_1.parseDecimal)(String(entry.amount), AMOUNT_SCALE);
            invested += entry.direction === "credit" ? amount : -amount;
        }
        const positions = await InvestmentPosition_1.InvestmentPosition.findAll({ where: { user_id: checkedUserId, status: "active" } });
        let principal = 0n;
        for (const position of positions)
            principal += (0, money_1.parseDecimal)(String(position.principal), AMOUNT_SCALE);
        if (invested !== principal) {
            issues.push({
                code: "ledger_principal_mismatch",
                reference: checkedUserId,
                detail: `Ledger invested principal ${invested.toString()} does not match active position principal ${principal.toString()}.`
            });
        }
    }
    const existing = await PerformanceCalculationLog_1.PerformanceCalculationLog.findAll({
        where: { snapshot_date: date, outcome: "reconciliation" }
    });
    const recordedMessages = new Set(existing.map((log) => log.message));
    for (const issue of issues) {
        const message = `${issue.code}:${issue.reference}`;
        if (recordedMessages.has(message))
            continue;
        await PerformanceCalculationLog_1.PerformanceCalculationLog.create({
            position_id: null,
            snapshot_date: date,
            outcome: "reconciliation",
            message
        });
    }
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: "performance_ledger_reconciliation",
        entity_type: "daily_performance_snapshot",
        entity_id: userId ?? date,
        reason: `Performance reconciliation against the ledger for ${date}`,
        metadata: { checked: snapshots.length, mismatched: issues.length, issues }
    });
    return { date, checked: snapshots.length, mismatched: issues.length, issues };
}
async function dailyPerformanceSummary(date) {
    const [snapshots, logs] = await Promise.all([
        DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findAll({ where: { snapshot_date: date }, order: [["created_at", "ASC"]] }),
        PerformanceCalculationLog_1.PerformanceCalculationLog.findAll({ where: { snapshot_date: date }, order: [["created_at", "ASC"]] })
    ]);
    const verified = snapshots.filter((snapshot) => snapshot.verification_status === "verified" && snapshot.profit_loss !== null);
    let gain = 0n;
    let loss = 0n;
    for (const snapshot of verified) {
        const profit = (0, money_1.parseDecimal)(String(snapshot.profit_loss), AMOUNT_SCALE);
        if (profit > 0n)
            gain += profit;
        else if (profit < 0n)
            loss += -profit;
    }
    const latestByPosition = new Map();
    for (const snapshot of snapshots)
        latestByPosition.set(snapshot.position_id, snapshot);
    return {
        date,
        recorded: latestByPosition.size,
        verified: [...latestByPosition.values()].filter((snapshot) => snapshot.verification_status === "verified").length,
        gain: (0, money_1.formatDecimal)(gain, AMOUNT_SCALE),
        loss: (0, money_1.formatDecimal)(loss, AMOUNT_SCALE),
        unavailable: logs.filter((log) => log.outcome === "unavailable").length,
        failed: logs.filter((log) => log.outcome === "failed").length,
        corrections: logs.filter((log) => log.outcome === "reconciliation").length,
        snapshots: [...latestByPosition.values()].map((snapshot) => ({
            snapshotId: snapshot.snapshot_id,
            positionId: snapshot.position_id,
            userId: snapshot.user_id,
            profitLoss: snapshot.profit_loss === null ? null : String(snapshot.profit_loss),
            roiPercent: snapshot.roi_percent === null ? null : String(snapshot.roi_percent),
            status: snapshot.verification_status,
            dataSource: snapshot.data_source
        })),
        events: logs.map((log) => ({
            logId: log.log_id,
            positionId: log.position_id,
            outcome: log.outcome,
            message: log.message,
            createdAt: log.created_at
        }))
    };
}
