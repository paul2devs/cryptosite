"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.portfolioValuation = exports.PERFORMANCE_METHODOLOGY = void 0;
exports.getPerformanceOverview = getPerformanceOverview;
exports.getPortfolioValuation = getPortfolioValuation;
exports.getDailyPerformanceDetail = getDailyPerformanceDetail;
exports.reconcilePerformance = reconcilePerformance;
exports.performanceReconciliationHistory = performanceReconciliationHistory;
exports.performanceAdminOverview = performanceAdminOverview;
const sequelize_1 = require("sequelize");
const performanceRules_1 = require("../domain/performanceRules");
const money_1 = require("../domain/money");
const portfolioRules_1 = require("../domain/portfolioRules");
Object.defineProperty(exports, "portfolioValuation", { enumerable: true, get: function () { return portfolioRules_1.portfolioValuation; } });
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const DailyPerformanceSnapshot_1 = require("../models/DailyPerformanceSnapshot");
const InvestmentPosition_1 = require("../models/InvestmentPosition");
const LedgerAccount_1 = require("../models/LedgerAccount");
const LedgerEntry_1 = require("../models/LedgerEntry");
const PerformanceCalculationLog_1 = require("../models/PerformanceCalculationLog");
const User_1 = require("../models/User");
exports.PERFORMANCE_METHODOLOGY = {
    investment: "time_weighted_return",
    account: "money_weighted_return",
    version: "twr-mwr.1",
    note: "Period ROI is a time-weighted return that chains cash-flow-adjusted daily returns so external deposits and withdrawals do not distort investment performance. Overall return is capital-weighted (money-weighted) to reflect the investor's actual average capital."
};
const FLOW_ACCOUNT = {
    deposit_confirmed: { code: "invested_principal", kind: "contribution" },
    withdrawal_completed: { code: "withdrawals", kind: "withdrawal" },
    fee_charged: { code: "fees", kind: "fee" },
    profit_distribution: { code: "realized_earnings", kind: "realized" },
    account_adjustment: { code: "adjustments", kind: "adjustment" },
    adjustment_reversal: { code: "adjustments", kind: "adjustment" }
};
function emptyBucket() {
    return { contribution: 0n, withdrawal: 0n, fee: 0n, realized: 0n, adjustment: 0n };
}
function dateKeyOf(value) {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString().slice(0, 10);
}
async function ledgerFlowsByDate(userId) {
    const [accounts, entries] = await Promise.all([
        LedgerAccount_1.LedgerAccount.findAll({ where: { user_id: userId } }),
        LedgerEntry_1.LedgerEntry.findAll({ where: { user_id: userId }, order: [["created_at", "ASC"]] })
    ]);
    const byAccountId = new Map(accounts.map((account) => [account.account_id, account]));
    const buckets = new Map();
    for (const entry of entries) {
        const account = byAccountId.get(entry.account_id);
        if (!account)
            continue;
        const rule = FLOW_ACCOUNT[entry.transaction_type];
        if (!rule || rule.code !== account.code)
            continue;
        const key = dateKeyOf(entry.created_at);
        const bucket = buckets.get(key) ?? emptyBucket();
        const amount = (0, money_1.parseDecimal)(String(entry.amount), 8);
        bucket[rule.kind] += amount;
        buckets.set(key, bucket);
    }
    return buckets;
}
function latestVerifiedSnapshots(rows) {
    const chosen = new Map();
    for (const row of rows) {
        const key = `${row.position_id}:${row.snapshot_date}`;
        const current = chosen.get(key);
        if (!current) {
            chosen.set(key, row);
            continue;
        }
        const rowIsCorrection = row.correction_of !== null;
        const currentIsCorrection = current.correction_of !== null;
        if (rowIsCorrection && !currentIsCorrection) {
            chosen.set(key, row);
        }
        else if (rowIsCorrection === currentIsCorrection && current.created_at < row.created_at) {
            chosen.set(key, row);
        }
    }
    return [...chosen.values()];
}
function buildEntries(snapshots, flows) {
    const entries = [];
    for (const snapshot of snapshots) {
        const date = String(snapshot.snapshot_date).slice(0, 10);
        const verified = snapshot.verification_status === "verified";
        const opening = (0, money_1.parseDecimal)(String(snapshot.opening_valuation), 8);
        const closing = snapshot.closing_valuation === null ? null : (0, money_1.parseDecimal)(String(snapshot.closing_valuation), 8);
        const bucket = flows.get(date) ?? emptyBucket();
        const profitLoss = snapshot.profit_loss === null ? null : (0, money_1.parseDecimal)(String(snapshot.profit_loss), 8);
        const realized = bucket.realized;
        const unrealized = profitLoss === null ? null : profitLoss - realized;
        entries.push({
            date,
            openingCents: opening,
            closingCents: closing,
            externalContributionCents: bucket.contribution,
            externalWithdrawalCents: bucket.withdrawal,
            feeCents: bucket.fee + bucket.adjustment,
            realizedCents: realized,
            unrealizedCents: unrealized,
            netProfitCents: profitLoss,
            roiPercent: snapshot.roi_percent === null ? null : String(snapshot.roi_percent),
            verified,
            methodology: exports.PERFORMANCE_METHODOLOGY.investment,
            source: snapshot.data_source
        });
    }
    return { entries, history: (0, performanceRules_1.buildDailyPerformanceHistory)(entries) };
}
function rangeStart(range, end) {
    const days = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
    const span = days[range];
    if (!span)
        return null;
    const start = new Date(end.getTime());
    if (range === "24h")
        start.setUTCHours(start.getUTCHours() - 24);
    else
        start.setUTCDate(start.getUTCDate() - span);
    return start;
}
async function getPerformanceOverview(userId, range) {
    const [positions, snapshotRows, flows] = await Promise.all([
        InvestmentPosition_1.InvestmentPosition.findAll({ where: { user_id: userId } }),
        DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findAll({
            where: { user_id: userId, verification_status: "verified" },
            order: [["snapshot_date", "ASC"], ["created_at", "ASC"]]
        }),
        ledgerFlowsByDate(userId)
    ]);
    const latest = latestVerifiedSnapshots(snapshotRows);
    const { history } = buildEntries(latest, flows);
    const activePositions = positions.filter((position) => position.status === "active");
    let investedPrincipal = 0n;
    let currentValue = 0n;
    let valuationComplete = true;
    for (const position of activePositions) {
        const principal = (0, money_1.parseDecimal)(String(position.principal), 8);
        investedPrincipal += principal;
        if (position.current_valuation !== null && position.verification_status === "verified") {
            currentValue += (0, money_1.parseDecimal)(String(position.current_valuation), 8);
        }
        else {
            currentValue += principal;
            valuationComplete = false;
        }
    }
    const now = new Date();
    const start = rangeStart(range, now);
    const scoped = start
        ? history.filter((row) => {
            const date = new Date(`${row.date}T00:00:00.000Z`);
            return date.getTime() >= start.getTime();
        })
        : history;
    const periodRois = scoped.map((row) => row.roiPercent);
    const periodReturn = (0, performanceRules_1.chainDailyReturns)(periodRois);
    const periodProfit = scoped.reduce((total, row) => (row.netProfitLoss === null ? total : total + (0, money_1.parseDecimal)(row.netProfitLoss, 8)), 0n);
    const anyVerifiedPeriod = scoped.some((row) => row.status === "verified" && row.netProfitLoss !== null);
    // Capital-weighted (money-weighted) overall return across the full verified history.
    let totalProfit = 0n;
    let capitalSum = 0n;
    let capitalDays = 0n;
    for (const row of history) {
        if (row.status !== "verified" || row.netProfitLoss === null)
            continue;
        totalProfit += (0, money_1.parseDecimal)(row.netProfitLoss, 8);
        capitalSum +=
            (0, money_1.parseDecimal)(row.openingValue, 8) +
                (0, money_1.parseDecimal)(row.externalContributions, 8) -
                (0, money_1.parseDecimal)(row.externalWithdrawals, 8);
        capitalDays += 1n;
    }
    const averageCapital = capitalDays > 0n ? capitalSum / capitalDays : 0n;
    const overallReturn = averageCapital > 0n ? (0, performanceRules_1.capitalWeightedReturn)(totalProfit, averageCapital) : null;
    let realizedTotal = 0n;
    for (const bucket of flows.values()) {
        realizedTotal += bucket.realized;
    }
    const todayKey = now.toISOString().slice(0, 10);
    const todayRow = history.find((row) => row.date === todayKey) ?? null;
    const chartPoints = scoped.map((row) => {
        const externalFlow = (0, money_1.parseDecimal)(row.externalContributions, 8) - (0, money_1.parseDecimal)(row.externalWithdrawals, 8);
        return {
            date: row.date,
            portfolioValue: row.closingValue,
            profitLoss: row.netProfitLoss,
            cumulativeProfitLoss: null,
            roiPercent: row.roiPercent,
            externalFlow: (0, money_1.formatDecimal)(externalFlow, 8),
            status: row.status
        };
    });
    let running = 0n;
    let runningVerified = false;
    for (const point of chartPoints) {
        if (point.profitLoss !== null) {
            running += (0, money_1.parseDecimal)(point.profitLoss, 8);
            runningVerified = true;
        }
        point.cumulativeProfitLoss = runningVerified ? (0, money_1.formatDecimal)(running, 8) : null;
    }
    const firstRow = scoped[0] ?? null;
    const lastRow = scoped[scoped.length - 1] ?? null;
    const totalContributions = scoped.reduce((total, row) => total + (0, money_1.parseDecimal)(row.externalContributions, 8), 0n);
    const totalWithdrawals = scoped.reduce((total, row) => total + (0, money_1.parseDecimal)(row.externalWithdrawals, 8), 0n);
    const unrealizedTotal = history.reduce((acc, row) => {
        if (row.unrealizedProfitLoss === null)
            return acc;
        const next = (acc.value ?? 0n) + (0, money_1.parseDecimal)(row.unrealizedProfitLoss, 8);
        return { value: next };
    }, { value: null }).value;
    return {
        range,
        methodology: exports.PERFORMANCE_METHODOLOGY,
        overview: {
            currentInvestmentValue: (0, money_1.formatDecimal)(currentValue, 8),
            investedPrincipal: (0, money_1.formatDecimal)(investedPrincipal, 8),
            valuationComplete,
            todayProfitLoss: todayRow?.netProfitLoss ?? null,
            todayRoiPercent: todayRow?.roiPercent ?? null,
            todayStatus: todayRow?.status ?? "unavailable",
            totalRealizedProfitLoss: (0, money_1.formatDecimal)(realizedTotal, 8),
            totalUnrealizedProfitLoss: unrealizedTotal === null ? null : (0, money_1.formatDecimal)(unrealizedTotal, 8),
            overallReturnPercent: overallReturn,
            periodReturnPercent: periodReturn,
            periodProfitLoss: periodProfit === 0n && !anyVerifiedPeriod ? null : (0, money_1.formatDecimal)(periodProfit, 8),
            periodStatus: anyVerifiedPeriod ? "verified" : "unavailable"
        },
        chart: {
            rangeStart: start ? start.toISOString() : null,
            rangeEnd: now.toISOString(),
            openingValue: firstRow?.openingValue ?? null,
            closingValue: lastRow?.closingValue ?? null,
            externalContributions: (0, money_1.formatDecimal)(totalContributions, 8),
            externalWithdrawals: (0, money_1.formatDecimal)(totalWithdrawals, 8),
            points: chartPoints
        },
        history,
        snapshots: latest.map((snapshot) => ({
            snapshot_id: snapshot.snapshot_id,
            snapshot_date: String(snapshot.snapshot_date),
            profit_loss: snapshot.profit_loss === null ? null : String(snapshot.profit_loss),
            roi_percent: snapshot.roi_percent === null ? null : String(snapshot.roi_percent),
            verification_status: snapshot.verification_status,
            data_source: snapshot.data_source
        })),
        today: {
            roiPercent: todayRow?.roiPercent ?? null,
            profitLoss: todayRow?.netProfitLoss ?? null,
            status: todayRow?.status ?? "unavailable",
            source: todayRow?.source ?? null,
            realized: false
        },
        cumulative: {
            roiPercent: overallReturn,
            profitLoss: history.some((row) => row.netProfitLoss !== null) ? (0, money_1.formatDecimal)(totalProfit, 8) : null,
            status: history.some((row) => row.status === "verified") ? "verified" : "unavailable",
            realized: false
        },
        realizedEarnings: (0, money_1.formatDecimal)(realizedTotal, 8),
        note: "Values are produced only from verified valuations and ledger events. Unverified positions are shown at principal and flagged. Unrealised performance is never withdrawable."
    };
}
async function getPortfolioValuation(userId, range = "all") {
    const overview = await getPerformanceOverview(userId, range);
    return (0, portfolioRules_1.portfolioValuation)(overview.overview);
}
async function getDailyPerformanceDetail(userId, date) {
    const overview = await getPerformanceOverview(userId, "all");
    const summary = overview.history.find((row) => row.date === date) ?? null;
    const [snapshots, entries, positions] = await Promise.all([
        DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findAll({ where: { user_id: userId, snapshot_date: date }, order: [["created_at", "ASC"]] }),
        LedgerEntry_1.LedgerEntry.findAll({
            where: { user_id: userId, created_at: { [sequelize_1.Op.gte]: new Date(`${date}T00:00:00.000Z`), [sequelize_1.Op.lt]: new Date(`${date}T23:59:59.999Z`) } },
            order: [["created_at", "ASC"]]
        }),
        InvestmentPosition_1.InvestmentPosition.findAll({ where: { user_id: userId } })
    ]);
    const assetByPosition = new Map(positions.map((position) => [position.position_id, position.asset]));
    const latest = latestVerifiedSnapshots(snapshots);
    return {
        date,
        summary,
        positions: latest.map((snapshot) => ({
            positionId: snapshot.position_id,
            asset: assetByPosition.get(snapshot.position_id) ?? "UNKNOWN",
            strategy: snapshot.strategy,
            openingValuation: String(snapshot.opening_valuation),
            closingValuation: snapshot.closing_valuation === null ? null : String(snapshot.closing_valuation),
            cashFlow: String(snapshot.cash_flow),
            profitLoss: snapshot.profit_loss === null ? null : String(snapshot.profit_loss),
            roiPercent: snapshot.roi_percent === null ? null : String(snapshot.roi_percent),
            verificationStatus: snapshot.verification_status,
            dataSource: snapshot.data_source,
            reason: snapshot.reason,
            correctionOf: snapshot.correction_of
        })),
        events: entries.map((entry) => ({
            entryId: entry.entry_id,
            direction: entry.direction,
            amount: String(entry.amount),
            asset: entry.asset,
            transactionType: entry.transaction_type,
            createdAt: entry.created_at.toISOString()
        }))
    };
}
async function reconcilePerformance(adminId, date) {
    const [positions, snapshots, entries] = await Promise.all([
        InvestmentPosition_1.InvestmentPosition.findAll({ where: { status: "active" } }),
        DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findAll({ where: { snapshot_date: date, verification_status: "verified" } }),
        LedgerEntry_1.LedgerEntry.findAll({ where: { source_type: "deposit", transaction_type: "deposit_confirmed" } })
    ]);
    const issues = [];
    const positionsById = new Map(positions.map((position) => [position.position_id, position]));
    for (const snapshot of snapshots) {
        const position = positionsById.get(snapshot.position_id);
        if (!position) {
            issues.push({
                code: "snapshot_without_position",
                reference: snapshot.snapshot_id,
                detail: "A verified snapshot references a position that is no longer active."
            });
            continue;
        }
        const opening = (0, money_1.parseDecimal)(String(snapshot.opening_valuation), 8);
        const closing = snapshot.closing_valuation === null ? null : (0, money_1.parseDecimal)(String(snapshot.closing_valuation), 8);
        const profit = snapshot.profit_loss === null ? null : (0, money_1.parseDecimal)(String(snapshot.profit_loss), 8);
        if (closing !== null && profit !== null) {
            const expected = closing - (opening + (0, money_1.parseDecimal)(String(snapshot.cash_flow), 8));
            if (expected !== profit) {
                issues.push({
                    code: "profit_mismatch",
                    reference: snapshot.snapshot_id,
                    detail: `Recorded profit ${profit.toString()} does not equal closing minus adjusted opening ${expected.toString()}.`
                });
            }
        }
        const principal = (0, money_1.parseDecimal)(String(position.principal), 8);
        const lastKnown = position.current_valuation === null ? null : (0, money_1.parseDecimal)(String(position.current_valuation), 8);
        if (lastKnown !== null && snapshot.snapshot_date === date && lastKnown !== closing) {
            issues.push({
                code: "position_valuation_mismatch",
                reference: position.position_id,
                detail: "The position's latest valuation does not match today's verified snapshot."
            });
        }
        if (principal < 0n) {
            issues.push({ code: "negative_principal", reference: position.position_id, detail: "Position principal is negative." });
        }
    }
    for (const entry of entries) {
        const positionExists = positions.some((position) => position.deposit_id === entry.source_id);
        if (!positionExists) {
            issues.push({
                code: "deposit_without_position",
                reference: entry.source_id,
                detail: "A confirmed deposit ledger entry has no matching investment position."
            });
        }
    }
    let correctionsRecorded = 0;
    for (const issue of issues) {
        const existing = await PerformanceCalculationLog_1.PerformanceCalculationLog.findOne({
            where: { snapshot_date: date, outcome: "reconciliation", message: `${issue.code}:${issue.reference}` }
        });
        if (existing)
            continue;
        await PerformanceCalculationLog_1.PerformanceCalculationLog.create({
            position_id: null,
            snapshot_date: date,
            outcome: "reconciliation",
            message: `${issue.code}:${issue.reference}`
        });
        correctionsRecorded += 1;
    }
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: "performance_reconciliation",
        entity_type: "daily_performance_snapshot",
        entity_id: date,
        reason: `Reconciliation run for ${date}`,
        metadata: { checked: snapshots.length, mismatched: issues.length, issues }
    });
    return {
        date,
        checked: snapshots.length,
        mismatched: issues.length,
        correctionsRecorded,
        issues
    };
}
async function performanceReconciliationHistory(limit = 50) {
    const [logs, audits] = await Promise.all([
        PerformanceCalculationLog_1.PerformanceCalculationLog.findAll({ where: { outcome: "reconciliation" }, order: [["created_at", "DESC"]], limit }),
        AdminAuditLog_1.AdminAuditLog.findAll({ where: { action: "performance_reconciliation" }, order: [["created_at", "DESC"]], limit })
    ]);
    return {
        logs: logs.map((log) => ({
            logId: log.log_id,
            snapshotDate: log.snapshot_date,
            message: log.message,
            createdAt: log.created_at
        })),
        audits: audits.map((audit) => ({
            auditId: audit.audit_id,
            adminId: audit.admin_id,
            entityId: audit.entity_id,
            reason: audit.reason,
            metadata: audit.metadata,
            createdAt: audit.created_at
        }))
    };
}
async function performanceAdminOverview(userId) {
    const user = await User_1.User.findByPk(userId);
    if (!user)
        throw new Error("User not found");
    const overview = await getPerformanceOverview(userId, "all");
    return overview;
}
