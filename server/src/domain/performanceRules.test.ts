import assert from "assert";
import { test } from "node:test";
import {
  buildDailyPerformanceHistory,
  calculateDailyPerformance,
  canDistribute,
  capitalWeightedReturn,
  chainDailyReturns,
  computeDailyRoi,
  ledgerBalances,
  netProfitCents,
  sumVerifiedPerformance
} from "./performanceRules";

test("calculates a verified daily gain without treating it as withdrawable", () => {
  const result = calculateDailyPerformance({
    openingCents: 100000n,
    closingCents: 100500n,
    cashFlowCents: 0n,
    verified: true
  });
  assert.equal(result.status, "verified");
  assert.equal(result.profitCents, 500n);
  assert.equal(result.roiPercent, "0.500000");
  assert.equal(canDistribute(result.profitCents ?? 0n, 0n), false);
});

test("returns negative and zero results and unavailable data when unverified", () => {
  const loss = calculateDailyPerformance({
    openingCents: 100000n,
    closingCents: 99500n,
    cashFlowCents: 0n,
    verified: true
  });
  assert.equal(loss.profitCents, -500n);
  assert.ok(loss.roiPercent?.startsWith("-"));
  const flat = calculateDailyPerformance({
    openingCents: 100000n,
    closingCents: 100000n,
    cashFlowCents: 0n,
    verified: true
  });
  assert.equal(flat.profitCents, 0n);
  const missing = calculateDailyPerformance({
    openingCents: 100000n,
    closingCents: null,
    cashFlowCents: 0n,
    verified: false
  });
  assert.equal(missing.status, "unavailable");
  assert.equal(missing.roiPercent, null);
});

test("adjusts opening value for cash flow and keeps ledger lines balanced", () => {
  const result = calculateDailyPerformance({
    openingCents: 100000n,
    closingCents: 150500n,
    cashFlowCents: 50000n,
    verified: true
  });
  assert.equal(result.profitCents, 500n);
  const balances = ledgerBalances([
    { account: "custody", direction: "credit", amountCents: 100000n },
    { account: "custody", direction: "debit", amountCents: 20000n }
  ]);
  assert.equal(balances.custody, 80000n);
});

test("sums verified profits and leaves an empty history unavailable", () => {
  const summed = sumVerifiedPerformance([500n, -200n], 100000n);
  assert.equal(summed.profitCents, 300n);
  assert.equal(summed.status, "verified");
  const empty = sumVerifiedPerformance([null], 100000n);
  assert.equal(empty.status, "unavailable");
  assert.equal(empty.roiPercent, null);
});

test("chains daily returns geometrically for a time-weighted period return", () => {
  assert.equal(chainDailyReturns(["2.500000", "2.500000"]), "5.062500");
  assert.equal(chainDailyReturns(["1.000000", "-1.000000"]), "-0.010000");
  assert.equal(chainDailyReturns(["0.000000"]), "0.000000");
  assert.equal(chainDailyReturns([null, undefined]), null);
});

test("excludes external cash flow from daily profit", () => {
  assert.equal(netProfitCents(100000n, 130000n, 0n), 30000n);
  assert.equal(netProfitCents(100000n, 130000n, 20000n), 10000n);
  assert.equal(computeDailyRoi(10000n, 120000n), "8.333333");
  assert.equal(capitalWeightedReturn(30000n, 150000n), "20.000000");
});

test("aggregates per-position snapshots into a daily history row", () => {
  const unit = 100000000n;
  const rows = buildDailyPerformanceHistory([
    {
      date: "2026-03-01",
      openingCents: 100000n * unit,
      closingCents: 103000n * unit,
      externalContributionCents: 0n,
      externalWithdrawalCents: 0n,
      feeCents: 0n,
      realizedCents: 0n,
      unrealizedCents: 3000n * unit,
      netProfitCents: 3000n * unit,
      roiPercent: "3.000000",
      verified: true,
      methodology: "twr_daily",
      source: "admin:ref-1"
    },
    {
      date: "2026-03-01",
      openingCents: 50000n * unit,
      closingCents: 51000n * unit,
      externalContributionCents: 0n,
      externalWithdrawalCents: 0n,
      feeCents: 0n,
      realizedCents: 0n,
      unrealizedCents: 1000n * unit,
      netProfitCents: 1000n * unit,
      roiPercent: "2.000000",
      verified: true,
      methodology: "twr_daily",
      source: "admin:ref-2"
    }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].openingValue, "150000.00000000");
  assert.equal(rows[0].closingValue, "154000.00000000");
  assert.equal(rows[0].netProfitLoss, "4000.00000000");
  assert.equal(rows[0].unrealizedProfitLoss, "4000.00000000");
  assert.equal(rows[0].status, "verified");
});

test("marks a day unavailable when any position is unverified", () => {
  const rows = buildDailyPerformanceHistory([
    {
      date: "2026-03-02",
      openingCents: 100000n,
      closingCents: 101000n,
      externalContributionCents: 0n,
      externalWithdrawalCents: 0n,
      feeCents: 0n,
      realizedCents: 0n,
      unrealizedCents: 1000n,
      netProfitCents: 1000n,
      roiPercent: "1.000000",
      verified: true,
      methodology: "twr_daily",
      source: "admin:ref-1"
    },
    {
      date: "2026-03-02",
      openingCents: 100000n,
      closingCents: null,
      externalContributionCents: 0n,
      externalWithdrawalCents: 0n,
      feeCents: 0n,
      realizedCents: 0n,
      unrealizedCents: null,
      netProfitCents: null,
      roiPercent: null,
      verified: false,
      methodology: "twr_daily",
      source: null
    }
  ]);
  assert.equal(rows[0].status, "unavailable");
  assert.equal(rows[0].closingValue, null);
  assert.equal(rows[0].netProfitLoss, null);
});
