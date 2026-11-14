"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUserTransactions = listUserTransactions;
exports.getUserTransactionDetail = getUserTransactionDetail;
exports.listAdminTransactions = listAdminTransactions;
exports.reconcileTransactions = reconcileTransactions;
exports.notifyTransactionEvent = notifyTransactionEvent;
exports.reconciliationHistory = reconciliationHistory;
exports.transactionTotalsForUser = transactionTotalsForUser;
const sequelize_1 = require("sequelize");
const money_1 = require("../domain/money");
const transactionRules_1 = require("../domain/transactionRules");
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const Deposit_1 = require("../models/Deposit");
const InvestmentPosition_1 = require("../models/InvestmentPosition");
const LedgerAccount_1 = require("../models/LedgerAccount");
const LedgerEntry_1 = require("../models/LedgerEntry");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const UserActivityEvent_1 = require("../models/UserActivityEvent");
const Withdrawal_1 = require("../models/Withdrawal");
const LEDGER_PRIMARY_CODE = {
    promotional_bonus_credited: "promotional_credits",
    investment_allocation: "invested_principal",
    investment_redemption: "invested_principal",
    profit_distribution: "realized_earnings",
    fee_charged: "fees",
    fee_refund: "fees",
    account_adjustment: "adjustments",
    adjustment_reversal: "adjustments"
};
// Transaction types that already exist as dedicated deposit/withdrawal records are excluded
// from the ledger feed so a single economic event is never shown twice.
const DEPOSIT_WITHDRAWAL_TYPES = new Set([
    "deposit_confirmed",
    "withdrawal_reserved",
    "withdrawal_released",
    "withdrawal_completed"
]);
const CATEGORY_FILTER = {
    all: ["deposit", "bonus", "withdrawal", "investment", "distribution", "fee", "adjustment", "other"],
    deposits: ["deposit"],
    bonuses: ["bonus"],
    withdrawals: ["withdrawal"],
    investments: ["investment"],
    returns: ["distribution"],
    fees: ["fee"],
    other: ["adjustment", "other"]
};
function money(value) {
    return (0, money_1.formatDecimal)((0, money_1.parseDecimal)(String(value), 8), 8);
}
function toIso(value) {
    if (!value)
        return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function depositToView(deposit) {
    const status = (0, transactionRules_1.normalizeDepositStatus)(deposit.status);
    const amount = money(deposit.amount);
    const completedAt = deposit.status === "Approved" ? toIso(deposit.confirmed_at ?? deposit.approved_at ?? deposit.timestamp) : null;
    return {
        reference: (0, transactionRules_1.generateReference)("deposit", deposit.deposit_id),
        category: "deposit",
        type: "deposit_confirmed",
        typeLabel: "Deposit",
        asset: deposit.crypto_type,
        amount,
        direction: "in",
        status,
        statusLabel: status === "completed" ? "Confirmed" : status === "failed" ? "Rejected" : "Pending",
        network: deposit.network ?? null,
        txHash: deposit.tx_hash ?? null,
        explorerUrl: (0, transactionRules_1.explorerUrlFor)(deposit.network, deposit.tx_hash),
        destinationAddress: null,
        sourceAddress: deposit.deposit_wallet ?? null,
        createdAt: toIso(deposit.timestamp) ?? new Date().toISOString(),
        updatedAt: toIso(deposit.approved_at ?? deposit.confirmed_at ?? deposit.timestamp) ?? new Date().toISOString(),
        completedAt,
        relatedReference: null,
        failureReason: deposit.status === "Rejected" ? "The deposit could not be verified and was rejected." : null,
        description: `Confirmed ${deposit.crypto_type} deposit`,
        externalCashFlow: status === "completed",
        fees: "0.00000000",
        netAmount: amount
    };
}
function withdrawalToView(withdrawal) {
    const status = (0, transactionRules_1.normalizeWithdrawalStatus)(withdrawal.status, withdrawal.detailed_status);
    const amount = money(withdrawal.amount);
    const fees = (0, money_1.formatDecimal)((0, money_1.parseDecimal)(String(withdrawal.network_fee ?? "0"), 8) + (0, money_1.parseDecimal)(String(withdrawal.platform_fee ?? "0"), 8), 8);
    const net = (0, money_1.formatDecimal)((0, money_1.parseDecimal)(amount, 8) - (0, money_1.parseDecimal)(fees, 8), 8);
    const label = status === "completed"
        ? "Completed"
        : status === "failed"
            ? "Failed"
            : status === "rejected"
                ? "Rejected"
                : status === "cancelled"
                    ? "Cancelled"
                    : status === "processing"
                        ? "Processing"
                        : "Requested";
    return {
        reference: (0, transactionRules_1.generateReference)("withdrawal", withdrawal.withdrawal_id),
        category: "withdrawal",
        type: "withdrawal_completed",
        typeLabel: "Withdrawal",
        asset: withdrawal.asset ?? "USDT",
        amount,
        direction: "out",
        status,
        statusLabel: label,
        network: withdrawal.network ?? null,
        txHash: withdrawal.tx_hash ?? null,
        explorerUrl: (0, transactionRules_1.explorerUrlFor)(withdrawal.network, withdrawal.tx_hash),
        destinationAddress: withdrawal.destination_address ?? null,
        sourceAddress: null,
        createdAt: toIso(withdrawal.timestamp) ?? new Date().toISOString(),
        updatedAt: toIso(withdrawal.processed_at ?? withdrawal.timestamp) ?? new Date().toISOString(),
        completedAt: status === "completed" ? toIso(withdrawal.processed_at ?? withdrawal.timestamp) : null,
        relatedReference: null,
        failureReason: withdrawal.review_reason && (status === "failed" || status === "rejected" || status === "cancelled")
            ? withdrawal.review_reason
            : null,
        description: `Withdrawal of ${withdrawal.asset ?? "USDT"}`,
        externalCashFlow: status === "completed",
        fees,
        netAmount: net
    };
}
function relatedReferenceFor(sourceType, sourceId) {
    if (sourceType === "deposit")
        return (0, transactionRules_1.generateReference)("deposit", sourceId);
    if (sourceType.startsWith("withdrawal"))
        return (0, transactionRules_1.generateReference)("withdrawal", sourceId);
    return null;
}
function ledgerEntryToView(entry) {
    const classified = (0, transactionRules_1.classifyLedgerTransaction)(entry.transaction_type);
    const relatedReference = relatedReferenceFor(entry.source_type, entry.source_id);
    return {
        reference: (0, transactionRules_1.generateReference)(entry.source_type, entry.source_id),
        category: classified.category,
        type: entry.transaction_type,
        typeLabel: classified.label,
        asset: entry.asset,
        amount: String(entry.amount),
        direction: classified.direction,
        status: "completed",
        statusLabel: "Completed",
        network: null,
        txHash: null,
        explorerUrl: null,
        destinationAddress: null,
        sourceAddress: null,
        createdAt: toIso(entry.created_at) ?? new Date().toISOString(),
        updatedAt: toIso(entry.created_at) ?? new Date().toISOString(),
        completedAt: toIso(entry.created_at),
        relatedReference,
        failureReason: null,
        description: classified.label,
        externalCashFlow: classified.external,
        fees: classified.category === "fee" ? String(entry.amount) : "0.00000000",
        netAmount: classified.category === "fee" ? `-${String(entry.amount)}` : String(entry.amount)
    };
}
async function collectUserTransactions(userId) {
    const [deposits, withdrawals, accounts, entries] = await Promise.all([
        Deposit_1.Deposit.findAll({ where: { user_id: userId } }),
        Withdrawal_1.Withdrawal.findAll({ where: { user_id: userId } }),
        LedgerAccount_1.LedgerAccount.findAll({ where: { user_id: userId } }),
        LedgerEntry_1.LedgerEntry.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]] })
    ]);
    const codeByAccount = new Map(accounts.map((account) => [account.account_id, account.code]));
    const rows = [
        ...deposits.map(depositToView),
        ...withdrawals.map(withdrawalToView)
    ];
    for (const entry of entries) {
        if (DEPOSIT_WITHDRAWAL_TYPES.has(entry.transaction_type))
            continue;
        const primary = LEDGER_PRIMARY_CODE[entry.transaction_type];
        if (!primary)
            continue;
        if (codeByAccount.get(entry.account_id) !== primary)
            continue;
        rows.push(ledgerEntryToView(entry));
    }
    return (0, transactionRules_1.sortTransactionsByDate)(rows);
}
function applyFilters(rows, query) {
    const category = CATEGORY_FILTER[query.category ?? "all"] ?? CATEGORY_FILTER.all;
    const statusFilter = query.status && query.status !== "all" ? query.status : null;
    const { from, to } = (0, transactionRules_1.resolveDateRange)(query.range ?? "all", new Date(), { from: query.from, to: query.to });
    return rows.filter((row) => {
        if (!category.includes(row.category))
            return false;
        if (statusFilter && row.status !== statusFilter)
            return false;
        if (query.asset && row.asset.toUpperCase() !== query.asset.toUpperCase())
            return false;
        const created = new Date(row.createdAt).getTime();
        if (from && created < from.getTime())
            return false;
        if (to && created > to.getTime())
            return false;
        if (query.search && !(0, transactionRules_1.matchesSearch)(row, query.search))
            return false;
        return true;
    });
}
function shortenForList(row) {
    return {
        ...row,
        destinationAddress: (0, transactionRules_1.shortenAddress)(row.destinationAddress),
        sourceAddress: (0, transactionRules_1.shortenAddress)(row.sourceAddress),
        txHash: row.txHash ? `${row.txHash.slice(0, 10)}…${row.txHash.slice(-6)}` : null
    };
}
async function listUserTransactions(userId, query) {
    const all = await collectUserTransactions(userId);
    const summary = (0, transactionRules_1.summarizeTransactions)(all, null, new Date());
    const filtered = applyFilters(all, query);
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize ?? 20)));
    const offset = (page - 1) * pageSize;
    return {
        summary,
        page,
        pageSize,
        total: filtered.length,
        transactions: filtered.slice(offset, offset + pageSize).map(shortenForList),
        reportingPeriod: "All confirmed financial events recorded on the account."
    };
}
async function getUserTransactionDetail(userId, reference) {
    const all = await collectUserTransactions(userId);
    const match = all.find((row) => row.reference === reference);
    if (!match)
        throw new Error("Transaction not found");
    const [deposits, withdrawals, audits, activity] = await Promise.all([
        Deposit_1.Deposit.findAll({ where: { user_id: userId } }),
        Withdrawal_1.Withdrawal.findAll({ where: { user_id: userId } }),
        AdminAuditLog_1.AdminAuditLog.findAll({ order: [["created_at", "DESC"]], limit: 200 }),
        UserActivityEvent_1.UserActivityEvent.findAll({ where: { user_id: userId }, order: [["timestamp", "DESC"]], limit: 200 })
    ]);
    const sourceIds = new Set();
    for (const deposit of deposits) {
        if ((0, transactionRules_1.generateReference)("deposit", deposit.deposit_id) === reference)
            sourceIds.add(deposit.deposit_id);
    }
    for (const withdrawal of withdrawals) {
        if ((0, transactionRules_1.generateReference)("withdrawal", withdrawal.withdrawal_id) === reference)
            sourceIds.add(withdrawal.withdrawal_id);
    }
    const relatedAudits = audits.filter((audit) => {
        if (sourceIds.has(audit.entity_id))
            return true;
        const metadata = audit.metadata;
        if (!metadata)
            return false;
        if (metadata.reference === reference)
            return true;
        if (metadata.withdrawalId && sourceIds.has(metadata.withdrawalId))
            return true;
        if (metadata.depositId && sourceIds.has(metadata.depositId))
            return true;
        return false;
    });
    const relatedActivity = activity.filter((event) => {
        const metadata = event.metadata;
        if (metadata?.withdrawal_id && sourceIds.has(metadata.withdrawal_id))
            return true;
        if (metadata?.deposit_id && sourceIds.has(metadata.deposit_id))
            return true;
        return false;
    });
    const events = [
        {
            id: `${reference}-created`,
            type: "created",
            source: "record",
            timestamp: match.createdAt,
            detail: `${match.typeLabel} recorded`
        },
        ...relatedAudits.map((audit) => ({
            id: audit.audit_id,
            type: audit.action,
            source: "audit",
            timestamp: toIso(audit.created_at),
            detail: audit.reason
        })),
        ...relatedActivity.map((event) => ({
            id: event.id,
            type: event.type,
            source: "activity",
            timestamp: toIso(event.timestamp),
            detail: event.type.replace(/_/g, " ")
        }))
    ];
    if (match.completedAt) {
        events.push({
            id: `${reference}-completed`,
            type: "completed",
            source: "record",
            timestamp: match.completedAt,
            detail: "Marked completed"
        });
    }
    else if (match.failureReason) {
        events.push({
            id: `${reference}-failed`,
            type: "failed",
            source: "record",
            timestamp: match.updatedAt,
            detail: match.failureReason
        });
    }
    events.sort((left, right) => new Date(right.timestamp ?? 0).getTime() - new Date(left.timestamp ?? 0).getTime());
    return {
        transaction: { ...match },
        processingEvents: events.slice(0, 40)
    };
}
async function listAdminTransactions(query) {
    const where = {};
    if (query.userId)
        where.user_id = query.userId;
    const users = await User_1.User.findAll({
        where,
        limit: 200,
        order: [["created_at", "DESC"]]
    });
    const rows = [];
    for (const user of users) {
        const collected = await collectUserTransactions(user.user_id);
        for (const row of collected) {
            rows.push({ ...row, userId: user.user_id, userEmail: user.email });
        }
    }
    const summary = (0, transactionRules_1.summarizeTransactions)(rows, null, new Date());
    const filtered = applyFilters(rows, query);
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25)));
    const offset = (page - 1) * pageSize;
    return {
        summary,
        page,
        pageSize,
        total: filtered.length,
        // Admin views are permission-controlled, so full on-chain references are returned
        // to allow verification instead of the shortened list representations.
        transactions: filtered
            .slice(offset, offset + pageSize)
            .map((row) => ({ ...row, userId: row.userId, userEmail: row.userEmail }))
    };
}
async function reconcileTransactions(adminId, userId) {
    const depositWhere = { status: "Approved" };
    if (userId)
        depositWhere.user_id = userId;
    const withdrawalWhere = { detailed_status: "completed" };
    if (userId)
        withdrawalWhere.user_id = userId;
    const [deposits, withdrawals, positions, confirmedEntries, completedEntries] = await Promise.all([
        Deposit_1.Deposit.findAll({ where: depositWhere }),
        Withdrawal_1.Withdrawal.findAll({ where: withdrawalWhere }),
        InvestmentPosition_1.InvestmentPosition.findAll(userId ? { where: { user_id: userId } } : {}),
        LedgerEntry_1.LedgerEntry.findAll({ where: { transaction_type: "deposit_confirmed" } }),
        LedgerEntry_1.LedgerEntry.findAll({ where: { transaction_type: "withdrawal_completed" } })
    ]);
    const depositIds = new Set(deposits.map((deposit) => deposit.deposit_id));
    const withdrawalIds = new Set(withdrawals.map((withdrawal) => withdrawal.withdrawal_id));
    const positionDepositIds = new Set(positions.map((position) => position.deposit_id));
    const confirmedEntryIds = new Set(confirmedEntries.map((entry) => entry.source_id));
    const completedEntryIds = new Set(completedEntries.map((entry) => entry.source_id));
    const issues = [];
    for (const deposit of deposits) {
        if (!confirmedEntryIds.has(deposit.deposit_id)) {
            issues.push({
                code: "confirmed_deposit_without_ledger",
                reference: (0, transactionRules_1.generateReference)("deposit", deposit.deposit_id),
                detail: "Confirmed deposit has no matching ledger credit entry."
            });
        }
        if (!positionDepositIds.has(deposit.deposit_id)) {
            issues.push({
                code: "confirmed_deposit_without_position",
                reference: (0, transactionRules_1.generateReference)("deposit", deposit.deposit_id),
                detail: "Confirmed deposit has no investment position."
            });
        }
    }
    for (const entry of confirmedEntries) {
        if (!depositIds.has(entry.source_id) && (!userId || entry.user_id === userId)) {
            issues.push({
                code: "ledger_deposit_without_record",
                reference: (0, transactionRules_1.generateReference)("deposit", entry.source_id),
                detail: "Ledger credit references a deposit that is not confirmed."
            });
        }
    }
    for (const withdrawal of withdrawals) {
        if (!completedEntryIds.has(withdrawal.withdrawal_id)) {
            issues.push({
                code: "completed_withdrawal_without_ledger",
                reference: (0, transactionRules_1.generateReference)("withdrawal", withdrawal.withdrawal_id),
                detail: "Completed withdrawal has no matching ledger debit entry."
            });
        }
    }
    for (const entry of completedEntries) {
        if (!withdrawalIds.has(entry.source_id) && (!userId || entry.user_id === userId)) {
            issues.push({
                code: "ledger_withdrawal_without_record",
                reference: (0, transactionRules_1.generateReference)("withdrawal", entry.source_id),
                detail: "Ledger debit references a withdrawal that is not completed."
            });
        }
    }
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: "transaction_reconciliation",
        entity_type: "transaction_ledger",
        entity_id: userId ?? "all",
        reason: `Transaction reconciliation${userId ? ` for user ${userId}` : ""}`,
        metadata: { deposits: deposits.length, withdrawals: withdrawals.length, issues }
    });
    return {
        scope: userId ?? "all",
        depositsChecked: deposits.length,
        withdrawalsChecked: withdrawals.length,
        mismatched: issues.length,
        issues
    };
}
async function notifyTransactionEvent(userId, type, message) {
    const user = await User_1.User.findByPk(userId);
    if (!user)
        return;
    const settings = user.account_settings;
    const enabled = settings?.notifications?.transaction_updates === true;
    if (!enabled)
        return;
    await Notification_1.Notification.create({
        user_id: userId,
        type,
        message: message.slice(0, 500)
    });
}
async function reconciliationHistory(limit = 50) {
    const audits = await AdminAuditLog_1.AdminAuditLog.findAll({
        where: { action: { [sequelize_1.Op.in]: ["transaction_reconciliation", "performance_reconciliation"] } },
        order: [["created_at", "DESC"]],
        limit
    });
    return audits.map((audit) => ({
        auditId: audit.audit_id,
        adminId: audit.admin_id,
        action: audit.action,
        scope: audit.entity_id,
        reason: audit.reason,
        metadata: audit.metadata,
        createdAt: audit.created_at
    }));
}
async function transactionTotalsForUser(userId) {
    const rows = await collectUserTransactions(userId);
    return (0, transactionRules_1.summarizeTransactions)(rows, null, new Date());
}
