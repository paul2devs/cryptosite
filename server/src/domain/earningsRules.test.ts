import assert from "assert";
import { test } from "node:test";
import {
  absAmount,
  dayKey,
  describeDailyEarnings,
  describeDailyRateBand,
  describeRealisedEarnings,
  deterministicDailyRatePercent,
  EARNINGS_DAILY_LOSS_RATE_PERCENT,
  EARNINGS_DAILY_MAX_RATE_PERCENT,
  EARNINGS_DAILY_MIN_RATE_PERCENT,
  earningsDirection,
  earningsPeriodDays,
  isFutureSnapshot,
  isPerformanceDayEligible,
  periodRoiPercent,
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

test("derives the projected period ROI from the daily rate and period length", () => {
  assert.equal(periodRoiPercent("3.000000", 30), "90.000000");
  assert.equal(periodRoiPercent("2.5", 12), "30.000000");
  // A malformed rate falls back to the platform default; a bad day count to the default period.
  assert.equal(periodRoiPercent("not-a-rate", 30), "90.000000");
  assert.equal(periodRoiPercent("3.000000", 0), "90.000000");
});

test("normalises a configured period length to a whole number of days", () => {
  assert.equal(earningsPeriodDays(45), 45);
  assert.equal(earningsPeriodDays("14"), 14);
  assert.equal(earningsPeriodDays(30.9), 30);
  assert.equal(earningsPeriodDays(0), 30);
  assert.equal(earningsPeriodDays(-5), 30);
  assert.equal(earningsPeriodDays(null), 30);
  assert.equal(earningsPeriodDays(undefined), 30);
});

test("derives the same daily rate for a position and day on every run", () => {
  const first = deterministicDailyRatePercent("pos-1", "2026-03-05");
  assert.equal(first, deterministicDailyRatePercent("pos-1", "2026-03-05"));
  // A different day is allowed to differ, but a re-read never rewrites history.
  assert.equal(first, deterministicDailyRatePercent("pos-1", "2026-03-05"));
});

test("keeps daily rates inside the 3%-6% gain band with rare -2% loss days", () => {
  const min = Number(EARNINGS_DAILY_MIN_RATE_PERCENT);
  const max = Number(EARNINGS_DAILY_MAX_RATE_PERCENT);
  const loss = Number(EARNINGS_DAILY_LOSS_RATE_PERCENT);
  const samples = 5000;
  let lossDays = 0;
  for (let index = 0; index < samples; index += 1) {
    const rate = Number(deterministicDailyRatePercent(`pos-${index}`, "2026-03-05"));
    if (rate === loss) {
      lossDays += 1;
      continue;
    }
    assert.ok(rate >= min && rate < max, `rate ${rate} outside the ${min}-${max} band`);
  }
  // Losses are a genuine but rare minority, never the norm.
  assert.ok(lossDays > 0, "expected at least one loss day across the sample");
  assert.ok(lossDays / samples < 0.1, `loss rate ${lossDays / samples} unexpectedly high`);
});

test("describes the daily rate band for logs and copy", () => {
  const band = describeDailyRateBand();
  assert.match(band, /3\.000000%/);
  assert.match(band, /6\.000000%/);
  assert.match(band, /-2\.000000%/);
});
