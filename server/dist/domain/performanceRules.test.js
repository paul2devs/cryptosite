"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const performanceRules_1 = require("./performanceRules");
(0, node_test_1.test)("calculates a verified daily gain without treating it as withdrawable", () => {
    const result = (0, performanceRules_1.calculateDailyPerformance)({
        openingCents: 100000n,
        closingCents: 100500n,
        cashFlowCents: 0n,
        verified: true
    });
    assert_1.default.equal(result.status, "verified");
    assert_1.default.equal(result.profitCents, 500n);
    assert_1.default.equal(result.roiPercent, "0.500000");
    assert_1.default.equal((0, performanceRules_1.canDistribute)(result.profitCents ?? 0n, 0n), false);
});
(0, node_test_1.test)("returns negative and zero results and unavailable data when unverified", () => {
    const loss = (0, performanceRules_1.calculateDailyPerformance)({
        openingCents: 100000n,
        closingCents: 99500n,
        cashFlowCents: 0n,
        verified: true
    });
    assert_1.default.equal(loss.profitCents, -500n);
    assert_1.default.ok(loss.roiPercent?.startsWith("-"));
    const flat = (0, performanceRules_1.calculateDailyPerformance)({
        openingCents: 100000n,
        closingCents: 100000n,
        cashFlowCents: 0n,
        verified: true
    });
    assert_1.default.equal(flat.profitCents, 0n);
    const missing = (0, performanceRules_1.calculateDailyPerformance)({
        openingCents: 100000n,
        closingCents: null,
        cashFlowCents: 0n,
        verified: false
    });
    assert_1.default.equal(missing.status, "unavailable");
    assert_1.default.equal(missing.roiPercent, null);
});
(0, node_test_1.test)("adjusts opening value for cash flow and keeps ledger lines balanced", () => {
    const result = (0, performanceRules_1.calculateDailyPerformance)({
        openingCents: 100000n,
        closingCents: 150500n,
        cashFlowCents: 50000n,
        verified: true
    });
    assert_1.default.equal(result.profitCents, 500n);
    const balances = (0, performanceRules_1.ledgerBalances)([
        { account: "custody", direction: "credit", amountCents: 100000n },
        { account: "custody", direction: "debit", amountCents: 20000n }
    ]);
    assert_1.default.equal(balances.custody, 80000n);
});
(0, node_test_1.test)("sums verified profits and leaves an empty history unavailable", () => {
    const summed = (0, performanceRules_1.sumVerifiedPerformance)([500n, -200n], 100000n);
    assert_1.default.equal(summed.profitCents, 300n);
    assert_1.default.equal(summed.status, "verified");
    const empty = (0, performanceRules_1.sumVerifiedPerformance)([null], 100000n);
    assert_1.default.equal(empty.status, "unavailable");
    assert_1.default.equal(empty.roiPercent, null);
});
(0, node_test_1.test)("chains daily returns geometrically for a time-weighted period return", () => {
    assert_1.default.equal((0, performanceRules_1.chainDailyReturns)(["2.500000", "2.500000"]), "5.062500");
    assert_1.default.equal((0, performanceRules_1.chainDailyReturns)(["1.000000", "-1.000000"]), "-0.010000");
    assert_1.default.equal((0, performanceRules_1.chainDailyReturns)(["0.000000"]), "0.000000");
    assert_1.default.equal((0, performanceRules_1.chainDailyReturns)([null, undefined]), null);
});
(0, node_test_1.test)("excludes external cash flow from daily profit", () => {
    assert_1.default.equal((0, performanceRules_1.netProfitCents)(100000n, 130000n, 0n), 30000n);
    assert_1.default.equal((0, performanceRules_1.netProfitCents)(100000n, 130000n, 20000n), 10000n);
    assert_1.default.equal((0, performanceRules_1.computeDailyRoi)(10000n, 120000n), "8.333333");
    assert_1.default.equal((0, performanceRules_1.capitalWeightedReturn)(30000n, 150000n), "20.000000");
});
(0, node_test_1.test)("aggregates per-position snapshots into a daily history row", () => {
    const unit = 100000000n;
    const rows = (0, performanceRules_1.buildDailyPerformanceHistory)([
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
    assert_1.default.equal(rows.length, 1);
    assert_1.default.equal(rows[0].openingValue, "150000.00000000");
    assert_1.default.equal(rows[0].closingValue, "154000.00000000");
    assert_1.default.equal(rows[0].netProfitLoss, "4000.00000000");
    assert_1.default.equal(rows[0].unrealizedProfitLoss, "4000.00000000");
    assert_1.default.equal(rows[0].status, "verified");
});
(0, node_test_1.test)("marks a day unavailable when any position is unverified", () => {
    const rows = (0, performanceRules_1.buildDailyPerformanceHistory)([
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
    assert_1.default.equal(rows[0].status, "unavailable");
    assert_1.default.equal(rows[0].closingValue, null);
    assert_1.default.equal(rows[0].netProfitLoss, null);
});
