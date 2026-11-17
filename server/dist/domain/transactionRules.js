"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.explorerUrlFor = explorerUrlFor;
exports.shortenAddress = shortenAddress;
exports.maskAddress = maskAddress;
exports.generateReference = generateReference;
exports.normalizeDepositStatus = normalizeDepositStatus;
exports.normalizeWithdrawalStatus = normalizeWithdrawalStatus;
exports.withdrawalStatusLabel = withdrawalStatusLabel;
exports.classifyLedgerTransaction = classifyLedgerTransaction;
exports.ledgerDirectionToFlow = ledgerDirectionToFlow;
exports.resolveDateRange = resolveDateRange;
exports.matchesSearch = matchesSearch;
exports.summarizeTransactions = summarizeTransactions;
exports.sortTransactionsByDate = sortTransactionsByDate;
exports.paginate = paginate;
const money_1 = require("./money");
const EXPLORERS = {
    BTC: "https://blockchain.com/btc/tx/",
    BITCOIN: "https://blockchain.com/btc/tx/",
    ETH: "https://etherscan.io/tx/",
    ETHEREUM: "https://etherscan.io/tx/",
    ERC20: "https://etherscan.io/tx/",
    USDT_ERC20: "https://etherscan.io/tx/",
    BNB: "https://bscscan.com/tx/",
    BSC: "https://bscscan.com/tx/",
    SOL: "https://solscan.io/tx/",
    TRX: "https://tronscan.org/#/transaction/",
    TRC20: "https://tronscan.org/#/transaction/",
    USDT_TRC20: "https://tronscan.org/#/transaction/",
    XRP: "https://xrpscan.com/tx/"
};
function explorerUrlFor(network, txHash) {
    if (!network || !txHash || txHash.trim().length < 8)
        return null;
    const base = EXPLORERS[network.toUpperCase()];
    if (!base)
        return null;
    return `${base}${txHash.trim()}`;
}
function shortenAddress(value, head = 6, tail = 4) {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (trimmed.length <= head + tail + 3)
        return trimmed;
    return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}
function maskAddress(value) {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (trimmed.length <= 8)
        return trimmed;
    return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-4)}`;
}
function generateReference(sourceType, sourceId) {
    const prefix = sourceType.slice(0, 3).toUpperCase();
    const compact = sourceId.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
    return `${prefix}-${compact.slice(0, 10)}`;
}
function normalizeDepositStatus(status) {
    if (status === "Approved")
        return "completed";
    if (status === "Rejected")
        return "failed";
    if (status === "UnderReview")
        return "processing";
    return "pending";
}
const WITHDRAWAL_STATUS_MAP = {
    requested: "pending",
    under_review: "processing",
    approved: "processing",
    processing: "processing",
    completed: "completed",
    failed: "failed",
    rejected: "rejected",
    cancelled: "cancelled"
};
function normalizeWithdrawalStatus(status, detailedStatus) {
    if (detailedStatus && WITHDRAWAL_STATUS_MAP[detailedStatus]) {
        return WITHDRAWAL_STATUS_MAP[detailedStatus];
    }
    if (status === "Approved")
        return "completed";
    if (status === "Rejected")
        return "rejected";
    return "pending";
}
function withdrawalStatusLabel(status, detailedStatus) {
    const key = detailedStatus && WITHDRAWAL_STATUS_MAP[detailedStatus] ? detailedStatus : null;
    if (key === "requested")
        return "Requested";
    if (key === "under_review")
        return "Under review";
    if (key === "approved")
        return "Approved";
    if (key === "processing")
        return "Processing";
    if (key === "completed")
        return "Completed";
    if (key === "failed")
        return "Failed";
    if (key === "rejected")
        return "Rejected";
    if (key === "cancelled")
        return "Cancelled";
    if (status === "Approved")
        return "Completed";
    if (status === "Rejected")
        return "Rejected";
    return "Pending";
}
const LEDGER_TYPE_MAP = {
    deposit_confirmed: { category: "deposit", label: "Deposit confirmed", direction: "in", external: true },
    promotional_bonus_credited: { category: "bonus", label: "Promotional bonus credited", direction: "in", external: false },
    reward_granted: { category: "reward", label: "Reward granted", direction: "in", external: false },
    reward_redeemed: { category: "reward", label: "Reward redeemed", direction: "in", external: false },
    withdrawal_reserved: { category: "withdrawal", label: "Withdrawal reserved", direction: "internal", external: false },
    withdrawal_completed: { category: "withdrawal", label: "Withdrawal completed", direction: "out", external: true },
    withdrawal_released: { category: "withdrawal", label: "Withdrawal released", direction: "internal", external: false },
    investment_allocation: { category: "investment", label: "Investment allocation", direction: "internal", external: false },
    investment_redemption: { category: "investment", label: "Investment redemption", direction: "internal", external: false },
    profit_distribution: { category: "distribution", label: "Realised profit distribution", direction: "internal", external: false },
    fee_charged: { category: "fee", label: "Fee charged", direction: "out", external: false },
    fee_refund: { category: "fee", label: "Fee refund", direction: "in", external: false },
    account_adjustment: { category: "adjustment", label: "Account adjustment", direction: "internal", external: false },
    adjustment_reversal: { category: "adjustment", label: "Adjustment reversal", direction: "internal", external: false }
};
function classifyLedgerTransaction(transactionType) {
    const match = LEDGER_TYPE_MAP[transactionType];
    if (match)
        return match;
    return { category: "other", label: transactionType.replace(/_/g, " "), direction: "internal", external: false };
}
function ledgerDirectionToFlow(direction) {
    return direction === "credit" ? "in" : "out";
}
function resolveDateRange(range, now = new Date(), custom) {
    const to = custom?.to ? new Date(custom.to) : now;
    const validTo = Number.isNaN(to.getTime()) ? now : to;
    if (range === "custom") {
        const from = custom?.from ? new Date(custom.from) : null;
        return { from: from && !Number.isNaN(from.getTime()) ? from : null, to: validTo };
    }
    const days = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
    const span = days[range];
    if (!span)
        return { from: null, to: validTo };
    const from = new Date(validTo.getTime());
    if (range === "24h")
        from.setUTCHours(from.getUTCHours() - 24);
    else
        from.setUTCDate(from.getUTCDate() - span);
    return { from, to: validTo };
}
function matchesSearch(row, query) {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed)
        return true;
    const haystack = [
        row.reference,
        row.type,
        row.typeLabel,
        row.asset,
        row.network ?? "",
        row.txHash ?? "",
        row.destinationAddress ?? "",
        row.relatedReference ?? ""
    ]
        .join(" ")
        .toLowerCase();
    return haystack.includes(trimmed);
}
function summarizeTransactions(rows, periodStart, periodEnd) {
    let confirmedDeposits = 0n;
    let completedWithdrawals = 0n;
    let pendingCount = 0;
    for (const row of rows) {
        if (row.category === "deposit" && row.status === "completed") {
            confirmedDeposits += (0, money_1.parseDecimal)(row.amount, 8);
        }
        if (row.category === "withdrawal" && row.status === "completed") {
            completedWithdrawals += (0, money_1.parseDecimal)(row.amount, 8);
        }
        if (row.status === "pending" || row.status === "processing") {
            pendingCount += 1;
        }
    }
    return {
        confirmedDeposits: (0, money_1.formatDecimal)(confirmedDeposits, 8),
        completedWithdrawals: (0, money_1.formatDecimal)(completedWithdrawals, 8),
        pendingCount,
        totalCount: rows.length,
        periodStart: periodStart ? periodStart.toISOString() : null,
        periodEnd: periodEnd.toISOString()
    };
}
function sortTransactionsByDate(rows) {
    return [...rows].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}
function paginate(rows, page, pageSize) {
    const safePage = Math.max(1, Math.floor(page));
    const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
    const offset = (safePage - 1) * safeSize;
    return {
        rows: rows.slice(offset, offset + safeSize),
        page: safePage,
        pageSize: safeSize,
        total: rows.length
    };
}
