"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const earningsRules_1 = require("./earningsRules");
(0, node_test_1.test)("starts daily performance only on the day after a verified confirmation", () => {
    const confirmedAt = "2026-03-04T18:30:00.000Z";
    assert_1.default.equal((0, earningsRules_1.isPerformanceDayEligible)(confirmedAt, "2026-03-04"), false);
    assert_1.default.equal((0, earningsRules_1.isPerformanceDayEligible)(confirmedAt, "2026-03-05"), true);
    assert_1.default.equal((0, earningsRules_1.isPerformanceDayEligible)(confirmedAt, "2026-03-06"), true);
    assert_1.default.equal((0, earningsRules_1.isPerformanceDayEligible)(null, "2026-03-05"), false);
});
(0, node_test_1.test)("detects snapshots dated in the future", () => {
    const now = new Date("2026-03-04T12:00:00.000Z");
    assert_1.default.equal((0, earningsRules_1.isFutureSnapshot)("2026-03-04", now), false);
    assert_1.default.equal((0, earningsRules_1.isFutureSnapshot)("2026-03-05", now), true);
    assert_1.default.equal((0, earningsRules_1.dayKey)(now), "2026-03-04");
});
(0, node_test_1.test)("classifies gain, loss, flat, and unavailable results", () => {
    assert_1.default.equal((0, earningsRules_1.earningsDirection)("25.50000000"), "gain");
    assert_1.default.equal((0, earningsRules_1.earningsDirection)("-25.50000000"), "loss");
    assert_1.default.equal((0, earningsRules_1.earningsDirection)("0.00000000"), "flat");
    assert_1.default.equal((0, earningsRules_1.earningsDirection)(null), "unavailable");
    assert_1.default.equal((0, earningsRules_1.absAmount)("-25.50000000"), "25.50000000");
});
(0, node_test_1.test)("describes a verified gain with amount, source, and reference", () => {
    const message = (0, earningsRules_1.describeDailyEarnings)({
        snapshotDate: "2026-03-05",
        asset: "USDT",
        profitLoss: "120.00000000",
        roiPercent: "0.600000",
        source: "custodian:genesis",
        reference: "DEP-ABC123"
    });
    assert_1.default.match(message, /Verified gain of 120\.00000000 USDT/);
    assert_1.default.match(message, /ROI 0\.600000%/);
    assert_1.default.match(message, /Source: custodian:genesis/);
    assert_1.default.match(message, /Reference DEP-ABC123/);
    assert_1.default.match(message, /Unrealised and not withdrawable/);
});
(0, node_test_1.test)("describes a verified loss and a flat day accurately", () => {
    const loss = (0, earningsRules_1.describeDailyEarnings)({
        snapshotDate: "2026-03-06",
        asset: "USDT",
        profitLoss: "-40.00000000",
        roiPercent: "-0.200000",
        source: "custodian:genesis",
        reference: "DEP-ABC123"
    });
    assert_1.default.match(loss, /Verified loss of 40\.00000000 USDT/);
    const flat = (0, earningsRules_1.describeDailyEarnings)({
        snapshotDate: "2026-03-07",
        asset: "USDT",
        profitLoss: "0.00000000",
        roiPercent: "0.000000",
        source: "custodian:genesis",
        reference: "DEP-ABC123"
    });
    assert_1.default.match(flat, /was flat/);
});
(0, node_test_1.test)("reports unavailable performance when no verified valuation exists", () => {
    const message = (0, earningsRules_1.describeDailyEarnings)({
        snapshotDate: "2026-03-08",
        asset: "USDT",
        profitLoss: null,
        roiPercent: null,
        source: null,
        reference: "DEP-ABC123"
    });
    assert_1.default.match(message, /is unavailable/);
    assert_1.default.match(message, /no independently verified USDT valuation/);
});
(0, node_test_1.test)("describes a realised distribution as credited and withdrawable", () => {
    const message = (0, earningsRules_1.describeRealisedEarnings)({
        asset: "USDT",
        amount: "50.00000000",
        reference: "PRF-XYZ789",
        reason: "Verified performance distributed by administrator."
    });
    assert_1.default.match(message, /Realised earnings of 50\.00000000 USDT/);
    assert_1.default.match(message, /withdrawable balance/);
    assert_1.default.match(message, /Reference PRF-XYZ789/);
});
(0, node_test_1.test)("projects an illustrative daily series without crediting it", () => {
    assert_1.default.equal((0, earningsRules_1.projectedDailyEarnings)("10000.00000000", "3.000000"), "300.00000000");
    assert_1.default.equal((0, earningsRules_1.projectedEarningsSeries)("10000.00000000", "3.000000", 5), "1500.00000000");
    assert_1.default.equal((0, earningsRules_1.projectedEarningsSeries)("10000.00000000", "3.000000", 0), "0.00000000");
});
(0, node_test_1.test)("derives the projected period ROI from the daily rate and period length", () => {
    assert_1.default.equal((0, earningsRules_1.periodRoiPercent)("3.000000", 30), "90.000000");
    assert_1.default.equal((0, earningsRules_1.periodRoiPercent)("2.5", 12), "30.000000");
    // A malformed rate falls back to the platform default; a bad day count to the default period.
    assert_1.default.equal((0, earningsRules_1.periodRoiPercent)("not-a-rate", 30), "90.000000");
    assert_1.default.equal((0, earningsRules_1.periodRoiPercent)("3.000000", 0), "90.000000");
});
(0, node_test_1.test)("normalises a configured period length to a whole number of days", () => {
    assert_1.default.equal((0, earningsRules_1.earningsPeriodDays)(45), 45);
    assert_1.default.equal((0, earningsRules_1.earningsPeriodDays)("14"), 14);
    assert_1.default.equal((0, earningsRules_1.earningsPeriodDays)(30.9), 30);
    assert_1.default.equal((0, earningsRules_1.earningsPeriodDays)(0), 30);
    assert_1.default.equal((0, earningsRules_1.earningsPeriodDays)(-5), 30);
    assert_1.default.equal((0, earningsRules_1.earningsPeriodDays)(null), 30);
    assert_1.default.equal((0, earningsRules_1.earningsPeriodDays)(undefined), 30);
});
(0, node_test_1.test)("derives the same daily rate for a position and day on every run", () => {
    const first = (0, earningsRules_1.deterministicDailyRatePercent)("pos-1", "2026-03-05");
    assert_1.default.equal(first, (0, earningsRules_1.deterministicDailyRatePercent)("pos-1", "2026-03-05"));
    // A different day is allowed to differ, but a re-read never rewrites history.
    assert_1.default.equal(first, (0, earningsRules_1.deterministicDailyRatePercent)("pos-1", "2026-03-05"));
});
(0, node_test_1.test)("keeps daily rates inside the 3%-6% gain band with rare -2% loss days", () => {
    const min = Number(earningsRules_1.EARNINGS_DAILY_MIN_RATE_PERCENT);
    const max = Number(earningsRules_1.EARNINGS_DAILY_MAX_RATE_PERCENT);
    const loss = Number(earningsRules_1.EARNINGS_DAILY_LOSS_RATE_PERCENT);
    const samples = 5000;
    let lossDays = 0;
    for (let index = 0; index < samples; index += 1) {
        const rate = Number((0, earningsRules_1.deterministicDailyRatePercent)(`pos-${index}`, "2026-03-05"));
        if (rate === loss) {
            lossDays += 1;
            continue;
        }
        assert_1.default.ok(rate >= min && rate < max, `rate ${rate} outside the ${min}-${max} band`);
    }
    // Losses are a genuine but rare minority, never the norm.
    assert_1.default.ok(lossDays > 0, "expected at least one loss day across the sample");
    assert_1.default.ok(lossDays / samples < 0.1, `loss rate ${lossDays / samples} unexpectedly high`);
});
(0, node_test_1.test)("describes the daily rate band for logs and copy", () => {
    const band = (0, earningsRules_1.describeDailyRateBand)();
    assert_1.default.match(band, /3\.000000%/);
    assert_1.default.match(band, /6\.000000%/);
    assert_1.default.match(band, /-2\.000000%/);
});
