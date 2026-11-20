"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const earningsRules_1 = require("./earningsRules");
(0, node_test_1.test)("accrues exactly 3% of eligible principal per period (simple interest)", () => {
    const accrual = (0, earningsRules_1.buildDailyEarningsAccrual)({
        principal: "100.00000000",
        accrued: "0.00000000",
        dailyRatePercent: "3.000000"
    });
    assert_1.default.equal(accrual.profitLoss, "3.00000000");
    assert_1.default.equal(accrual.openingValue, "100.00000000");
    assert_1.default.equal(accrual.closingValue, "103.00000000");
    assert_1.default.equal(accrual.roiPercent, "3.000000");
});
(0, node_test_1.test)("does not compound: every period earns rate x principal", () => {
    const first = (0, earningsRules_1.buildDailyEarningsAccrual)({
        principal: "100.00000000",
        accrued: "0.00000000",
        dailyRatePercent: "3.000000"
    });
    const second = (0, earningsRules_1.buildDailyEarningsAccrual)({
        principal: "100.00000000",
        accrued: first.profitLoss,
        dailyRatePercent: "3.000000"
    });
    assert_1.default.equal(second.profitLoss, "3.00000000");
    assert_1.default.equal(second.openingValue, "103.00000000");
    assert_1.default.equal(second.closingValue, "106.00000000");
    // ROI is expressed against the running value, so it declines from 3% to ~2.91%.
    assert_1.default.equal(second.roiPercent, "2.912621");
});
(0, node_test_1.test)("is deterministic so a re-run cannot produce a different amount", () => {
    const input = { principal: "100.00000000", accrued: "6.00000000", dailyRatePercent: "3.000000" };
    assert_1.default.deepEqual((0, earningsRules_1.buildDailyEarningsAccrual)(input), (0, earningsRules_1.buildDailyEarningsAccrual)(input));
});
(0, node_test_1.test)("produces a stable per-position/per-day idempotency key", () => {
    assert_1.default.equal((0, earningsRules_1.earningsAccrualKey)("POS-1", "2026-03-05"), "POS-1:2026-03-05");
    assert_1.default.equal((0, earningsRules_1.earningsAccrualKey)("POS-1", "2026-03-05"), (0, earningsRules_1.earningsAccrualKey)("POS-1", "2026-03-05"));
    assert_1.default.notEqual((0, earningsRules_1.earningsAccrualKey)("POS-1", "2026-03-05"), (0, earningsRules_1.earningsAccrualKey)("POS-1", "2026-03-06"));
});
(0, node_test_1.test)("defaults to the 3% daily plan when the configured rate is missing or invalid", () => {
    assert_1.default.equal(earningsRules_1.DEFAULT_DAILY_EARNINGS_RATE_PERCENT, "3.000000");
    assert_1.default.equal((0, earningsRules_1.dailyEarningsRatePercent)(null), "3.000000");
    assert_1.default.equal((0, earningsRules_1.dailyEarningsRatePercent)(""), "3.000000");
    assert_1.default.equal((0, earningsRules_1.dailyEarningsRatePercent)("nonsense"), "3.000000");
    assert_1.default.equal((0, earningsRules_1.dailyEarningsRatePercent)("0"), "3.000000");
    assert_1.default.equal((0, earningsRules_1.dailyEarningsRatePercent)("1.5"), "1.500000");
});
