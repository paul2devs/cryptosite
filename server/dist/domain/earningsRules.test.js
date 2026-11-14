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
