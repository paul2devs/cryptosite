import assert from "assert";
import { test } from "node:test";
import {
  classifyLedgerTransaction,
  explorerUrlFor,
  generateReference,
  maskAddress,
  matchesSearch,
  normalizeDepositStatus,
  normalizeWithdrawalStatus,
  paginate,
  resolveDateRange,
  shortenAddress,
  summarizeTransactions,
  withdrawalStatusLabel,
  type TransactionView
} from "./transactionRules";

function buildView(overrides: Partial<TransactionView>): TransactionView {
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

test("builds explorer links only for a supported network and a plausible hash", () => {
  assert.equal(explorerUrlFor("ETH", "0xabcdef1234567890"), "https://etherscan.io/tx/0xabcdef1234567890");
  assert.equal(explorerUrlFor("TRC20", "abcdef1234567890"), "https://tronscan.org/#/transaction/abcdef1234567890");
  assert.equal(explorerUrlFor("DOGE", "abcdef1234567890"), null);
  assert.equal(explorerUrlFor("ETH", "short"), null);
  assert.equal(explorerUrlFor(null, "abcdef1234567890"), null);
});

test("shortens addresses in the list and masks them for the detail view", () => {
  const address = "0x1234567890abcdef1234567890abcdef12345678";
  assert.equal(shortenAddress(address), "0x1234…5678");
  assert.equal(maskAddress(address), "0x12••••••5678");
  assert.equal(shortenAddress(null), null);
});

test("generates a stable reference from the source identifiers", () => {
  assert.equal(generateReference("deposit", "12345678-90ab-cdef"), "DEP-1234567890");
  assert.equal(generateReference("withdrawal", "abc-def"), "WIT-ABCDEF");
});

test("normalizes deposit and withdrawal statuses without inventing completion", () => {
  assert.equal(normalizeDepositStatus("Approved"), "completed");
  assert.equal(normalizeDepositStatus("Pending"), "pending");
  assert.equal(normalizeDepositStatus("Rejected"), "failed");
  assert.equal(normalizeWithdrawalStatus("Pending", "under_review"), "processing");
  assert.equal(normalizeWithdrawalStatus("Pending", "completed"), "completed");
  assert.equal(normalizeWithdrawalStatus("Rejected", null), "rejected");
  assert.equal(withdrawalStatusLabel("Pending", "processing"), "Processing");
  assert.equal(withdrawalStatusLabel("Approved", null), "Completed");
});

test("classifies ledger transaction types and flags external cash flows", () => {
  const deposit = classifyLedgerTransaction("deposit_confirmed");
  assert.equal(deposit.category, "deposit");
  assert.equal(deposit.external, true);
  const allocation = classifyLedgerTransaction("investment_allocation");
  assert.equal(allocation.category, "investment");
  assert.equal(allocation.external, false);
  const unknown = classifyLedgerTransaction("mystery_event");
  assert.equal(unknown.category, "other");
});

test("resolves date ranges for every supported filter", () => {
  const now = new Date("2026-03-15T12:00:00.000Z");
  assert.equal(resolveDateRange("all", now).from, null);
  const week = resolveDateRange("7d", now);
  assert.equal(week.from?.toISOString(), "2026-03-08T12:00:00.000Z");
  const day = resolveDateRange("24h", now);
  assert.equal(day.from?.toISOString(), "2026-03-14T12:00:00.000Z");
  const year = resolveDateRange("1y", now);
  assert.equal(year.from?.toISOString(), "2025-03-15T12:00:00.000Z");
  const custom = resolveDateRange("custom", now, { from: "2026-01-01", to: "2026-02-01" });
  assert.equal(custom.from?.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("searches transactions by reference, hash, asset and type", () => {
  const row = buildView({});
  assert.equal(matchesSearch(row, "DEP-ABCDEF"), true);
  assert.equal(matchesSearch(row, "btc"), true);
  assert.equal(matchesSearch(row, "a1b2c3d4"), true);
  assert.equal(matchesSearch(row, "withdrawal"), false);
  assert.equal(matchesSearch(row, "   "), true);
});

test("summarizes totals from completed and pending transactions only", () => {
  const rows: TransactionView[] = [
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
  const summary = summarizeTransactions(rows, null, new Date("2026-03-15T00:00:00.000Z"));
  assert.equal(summary.confirmedDeposits, "2.00000000");
  assert.equal(summary.completedWithdrawals, "0.50000000");
  assert.equal(summary.pendingCount, 2);
  assert.equal(summary.totalCount, 4);
});

test("paginates server-side and clamps the page size", () => {
  const rows = Array.from({ length: 10 }, (_, index) => index);
  const pageOne = paginate(rows, 1, 3);
  assert.deepEqual(pageOne.rows, [0, 1, 2]);
  assert.equal(pageOne.total, 10);
  const clamped = paginate(rows, -1, 500);
  assert.equal(clamped.pageSize, 100);
  assert.equal(clamped.page, 1);
});
