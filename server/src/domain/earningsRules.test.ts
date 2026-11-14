import assert from "assert";
import { test } from "node:test";
import {
  absAmount,
  dayKey,
  describeDailyEarnings,
  describeRealisedEarnings,
  earningsDirection,
  isFutureSnapshot,
  isPerformanceDayEligible,
  projectedDailyEarnings,
  projectedEarningsSeries
} from "./earningsRules";

test("starts daily performance only on the day after a verified confirmation", () => {
  const confirmedAt = "2026-03-04T18:30:00.000Z";
  assert.equal(isPerformanceDayEligible(confirmedAt, "2026-03-04"), false);
  assert.equal(isPerformanceDayEligible(confirmedAt, "2026-03-05"), true);
  assert.equal(isPerformanceDayEligible(confirmedAt, "2026-03-06"), true);
  assert.equal(isPerformanceDayEligible(null, "2026-03-05"), false);
});

test("detects snapshots dated in the future", () => {
  const now = new Date("2026-03-04T12:00:00.000Z");
  assert.equal(isFutureSnapshot("2026-03-04", now), false);
  assert.equal(isFutureSnapshot("2026-03-05", now), true);
  assert.equal(dayKey(now), "2026-03-04");
});

test("classifies gain, loss, flat, and unavailable results", () => {
  assert.equal(earningsDirection("25.50000000"), "gain");
  assert.equal(earningsDirection("-25.50000000"), "loss");
  assert.equal(earningsDirection("0.00000000"), "flat");
  assert.equal(earningsDirection(null), "unavailable");
  assert.equal(absAmount("-25.50000000"), "25.50000000");
});

test("describes a verified gain with amount, source, and reference", () => {
  const message = describeDailyEarnings({
    snapshotDate: "2026-03-05",
    asset: "USDT",
    profitLoss: "120.00000000",
    roiPercent: "0.600000",
    source: "custodian:genesis",
    reference: "DEP-ABC123"
  });
  assert.match(message, /Verified gain of 120\.00000000 USDT/);
  assert.match(message, /ROI 0\.600000%/);
  assert.match(message, /Source: custodian:genesis/);
  assert.match(message, /Reference DEP-ABC123/);
  assert.match(message, /Unrealised and not withdrawable/);
});

test("describes a verified loss and a flat day accurately", () => {
  const loss = describeDailyEarnings({
    snapshotDate: "2026-03-06",
    asset: "USDT",
    profitLoss: "-40.00000000",
    roiPercent: "-0.200000",
    source: "custodian:genesis",
    reference: "DEP-ABC123"
  });
  assert.match(loss, /Verified loss of 40\.00000000 USDT/);
  const flat = describeDailyEarnings({
    snapshotDate: "2026-03-07",
    asset: "USDT",
    profitLoss: "0.00000000",
    roiPercent: "0.000000",
    source: "custodian:genesis",
    reference: "DEP-ABC123"
  });
  assert.match(flat, /was flat/);
});

test("reports unavailable performance when no verified valuation exists", () => {
  const message = describeDailyEarnings({
    snapshotDate: "2026-03-08",
    asset: "USDT",
    profitLoss: null,
    roiPercent: null,
    source: null,
    reference: "DEP-ABC123"
  });
  assert.match(message, /is unavailable/);
  assert.match(message, /no independently verified USDT valuation/);
});

test("describes a realised distribution as credited and withdrawable", () => {
  const message = describeRealisedEarnings({
    asset: "USDT",
    amount: "50.00000000",
    reference: "PRF-XYZ789",
    reason: "Verified performance distributed by administrator."
  });
  assert.match(message, /Realised earnings of 50\.00000000 USDT/);
  assert.match(message, /withdrawable balance/);
  assert.match(message, /Reference PRF-XYZ789/);
});

test("projects an illustrative daily series without crediting it", () => {
  assert.equal(projectedDailyEarnings("10000.00000000", "3.000000"), "300.00000000");
  assert.equal(projectedEarningsSeries("10000.00000000", "3.000000", 5), "1500.00000000");
  assert.equal(projectedEarningsSeries("10000.00000000", "3.000000", 0), "0.00000000");
});
