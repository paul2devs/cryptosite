"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const transactionRules_1 = require("./transactionRules");
function buildView(overrides) {
    return {
        reference: "DEP-ABCDEF1234",
        category: "deposit",
        type: "deposit_confirmed",
        typeLabel: "Deposit confirmed",
        asset: "BTC",
        amount: "1.00000000",
        direction: "in",
        status: "completed",
        statusLabel: "Confirmed",
        network: "BTC",
        txHash: "a1b2c3d4e5f6",
        explorerUrl: null,
        destinationAddress: null,
        sourceAddress: null,
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:05:00.000Z",
        completedAt: "2026-03-01T10:05:00.000Z",
        relatedReference: null,
        failureReason: null,
        description: "Deposit confirmed",
        externalCashFlow: true,
        ...overrides
    };
}
(0, node_test_1.test)("builds explorer links only for a supported network and a plausible hash", () => {
    assert_1.default.equal((0, transactionRules_1.explorerUrlFor)("ETH", "0xabcdef1234567890"), "https://etherscan.io/tx/0xabcdef1234567890");
    assert_1.default.equal((0, transactionRules_1.explorerUrlFor)("TRC20", "abcdef1234567890"), "https://tronscan.org/#/transaction/abcdef1234567890");
    assert_1.default.equal((0, transactionRules_1.explorerUrlFor)("DOGE", "abcdef1234567890"), null);
    assert_1.default.equal((0, transactionRules_1.explorerUrlFor)("ETH", "short"), null);
    assert_1.default.equal((0, transactionRules_1.explorerUrlFor)(null, "abcdef1234567890"), null);
});
(0, node_test_1.test)("shortens addresses in the list and masks them for the detail view", () => {
    const address = "0x1234567890abcdef1234567890abcdef12345678";
    assert_1.default.equal((0, transactionRules_1.shortenAddress)(address), "0x1234…5678");
    assert_1.default.equal((0, transactionRules_1.maskAddress)(address), "0x12••••••5678");
    assert_1.default.equal((0, transactionRules_1.shortenAddress)(null), null);
});
(0, node_test_1.test)("generates a stable reference from the source identifiers", () => {
    assert_1.default.equal((0, transactionRules_1.generateReference)("deposit", "12345678-90ab-cdef"), "DEP-1234567890");
    assert_1.default.equal((0, transactionRules_1.generateReference)("withdrawal", "abc-def"), "WIT-ABCDEF");
});
(0, node_test_1.test)("normalizes deposit and withdrawal statuses without inventing completion", () => {
    assert_1.default.equal((0, transactionRules_1.normalizeDepositStatus)("Approved"), "completed");
    assert_1.default.equal((0, transactionRules_1.normalizeDepositStatus)("Pending"), "pending");
    assert_1.default.equal((0, transactionRules_1.normalizeDepositStatus)("Rejected"), "failed");
    assert_1.default.equal((0, transactionRules_1.normalizeWithdrawalStatus)("Pending", "under_review"), "processing");
    assert_1.default.equal((0, transactionRules_1.normalizeWithdrawalStatus)("Pending", "completed"), "completed");
    assert_1.default.equal((0, transactionRules_1.normalizeWithdrawalStatus)("Rejected", null), "rejected");
    assert_1.default.equal((0, transactionRules_1.withdrawalStatusLabel)("Pending", "processing"), "Processing");
    assert_1.default.equal((0, transactionRules_1.withdrawalStatusLabel)("Approved", null), "Completed");
});
(0, node_test_1.test)("classifies ledger transaction types and flags external cash flows", () => {
    const deposit = (0, transactionRules_1.classifyLedgerTransaction)("deposit_confirmed");
    assert_1.default.equal(deposit.category, "deposit");
    assert_1.default.equal(deposit.external, true);
    const allocation = (0, transactionRules_1.classifyLedgerTransaction)("investment_allocation");
    assert_1.default.equal(allocation.category, "investment");
    assert_1.default.equal(allocation.external, false);
    const unknown = (0, transactionRules_1.classifyLedgerTransaction)("mystery_event");
    assert_1.default.equal(unknown.category, "other");
});
(0, node_test_1.test)("resolves date ranges for every supported filter", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");
    assert_1.default.equal((0, transactionRules_1.resolveDateRange)("all", now).from, null);
    const week = (0, transactionRules_1.resolveDateRange)("7d", now);
    assert_1.default.equal(week.from?.toISOString(), "2026-03-08T12:00:00.000Z");
    const day = (0, transactionRules_1.resolveDateRange)("24h", now);
    assert_1.default.equal(day.from?.toISOString(), "2026-03-14T12:00:00.000Z");
    const year = (0, transactionRules_1.resolveDateRange)("1y", now);
    assert_1.default.equal(year.from?.toISOString(), "2025-03-15T12:00:00.000Z");
    const custom = (0, transactionRules_1.resolveDateRange)("custom", now, { from: "2026-01-01", to: "2026-02-01" });
    assert_1.default.equal(custom.from?.toISOString(), "2026-01-01T00:00:00.000Z");
});
(0, node_test_1.test)("searches transactions by reference, hash, asset and type", () => {
    const row = buildView({});
    assert_1.default.equal((0, transactionRules_1.matchesSearch)(row, "DEP-ABCDEF"), true);
    assert_1.default.equal((0, transactionRules_1.matchesSearch)(row, "btc"), true);
    assert_1.default.equal((0, transactionRules_1.matchesSearch)(row, "a1b2c3d4"), true);
    assert_1.default.equal((0, transactionRules_1.matchesSearch)(row, "withdrawal"), false);
    assert_1.default.equal((0, transactionRules_1.matchesSearch)(row, "   "), true);
});
(0, node_test_1.test)("summarizes totals from completed and pending transactions only", () => {
    const rows = [
        buildView({ reference: "DEP-1", amount: "2.00000000", status: "completed" }),
        buildView({ reference: "DEP-2", amount: "1.00000000", status: "pending" }),
        buildView({
            reference: "WIT-1",
            category: "withdrawal",
            type: "withdrawal_completed",
            amount: "0.50000000",
            status: "completed"
        }),
        buildView({
            reference: "WIT-2",
            category: "withdrawal",
            type: "withdrawal_reserve",
            amount: "0.25000000",
            status: "processing"
        })
    ];
    const summary = (0, transactionRules_1.summarizeTransactions)(rows, null, new Date("2026-03-15T00:00:00.000Z"));
    assert_1.default.equal(summary.confirmedDeposits, "2.00000000");
    assert_1.default.equal(summary.completedWithdrawals, "0.50000000");
    assert_1.default.equal(summary.pendingCount, 2);
    assert_1.default.equal(summary.totalCount, 4);
});
(0, node_test_1.test)("paginates server-side and clamps the page size", () => {
    const rows = Array.from({ length: 10 }, (_, index) => index);
    const pageOne = (0, transactionRules_1.paginate)(rows, 1, 3);
    assert_1.default.deepEqual(pageOne.rows, [0, 1, 2]);
    assert_1.default.equal(pageOne.total, 10);
    const clamped = (0, transactionRules_1.paginate)(rows, -1, 500);
    assert_1.default.equal(clamped.pageSize, 100);
    assert_1.default.equal(clamped.page, 1);
});
