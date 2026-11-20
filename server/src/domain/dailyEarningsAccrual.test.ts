import assert from "assert";
import { test } from "node:test";
import {
  DEFAULT_DAILY_EARNINGS_RATE_PERCENT,
  buildDailyEarningsAccrual,
  dailyEarningsRatePercent,
  earningsAccrualKey
} from "./earningsRules";

test("accrues exactly 3% of eligible principal per period (simple interest)", () => {
  const accrual = buildDailyEarningsAccrual({
    principal: "100.00000000",
    accrued: "0.00000000",
    dailyRatePercent: "3.000000"
  });
  assert.equal(accrual.profitLoss, "3.00000000");
  assert.equal(accrual.openingValue, "100.00000000");
  assert.equal(accrual.closingValue, "103.00000000");
  assert.equal(accrual.roiPercent, "3.000000");
});

test("does not compound: every period earns rate x principal", () => {
  const first = buildDailyEarningsAccrual({
    principal: "100.00000000",
    accrued: "0.00000000",
    dailyRatePercent: "3.000000"
  });
  const second = buildDailyEarningsAccrual({
    principal: "100.00000000",
    accrued: first.profitLoss,
    dailyRatePercent: "3.000000"
  });
  assert.equal(second.profitLoss, "3.00000000");
  assert.equal(second.openingValue, "103.00000000");
  assert.equal(second.closingValue, "106.00000000");
  // ROI is expressed against the running value, so it declines from 3% to ~2.91%.
  assert.equal(second.roiPercent, "2.912621");
});

test("is deterministic so a re-run cannot produce a different amount", () => {
  const input = { principal: "100.00000000", accrued: "6.00000000", dailyRatePercent: "3.000000" };
  assert.deepEqual(buildDailyEarningsAccrual(input), buildDailyEarningsAccrual(input));
});

test("produces a stable per-position/per-day idempotency key", () => {
  assert.equal(earningsAccrualKey("POS-1", "2026-03-05"), "POS-1:2026-03-05");
  assert.equal(
    earningsAccrualKey("POS-1", "2026-03-05"),
    earningsAccrualKey("POS-1", "2026-03-05")
  );
  assert.notEqual(
    earningsAccrualKey("POS-1", "2026-03-05"),
    earningsAccrualKey("POS-1", "2026-03-06")
  );
});

test("defaults to the 3% daily plan when the configured rate is missing or invalid", () => {
  assert.equal(DEFAULT_DAILY_EARNINGS_RATE_PERCENT, "3.000000");
  assert.equal(dailyEarningsRatePercent(null), "3.000000");
  assert.equal(dailyEarningsRatePercent(""), "3.000000");
  assert.equal(dailyEarningsRatePercent("nonsense"), "3.000000");
  assert.equal(dailyEarningsRatePercent("0"), "3.000000");
  assert.equal(dailyEarningsRatePercent("1.5"), "1.500000");
});
