import assert from "assert";
import { test } from "node:test";
import { computeAccountBalance, type AccountBalanceInput } from "./accountBalanceRules";

function balance(overrides: Partial<AccountBalanceInput> = {}) {
  return computeAccountBalance({
    walletBalance: "0.00000000",
    lockedBalance: "0.00000000",
    investedPrincipal: "0.00000000",
    accruedEarnings: "0.00000000",
    settledEarnings: "0.00000000",
    underMaturity: "0.00000000",
    pendingWithdrawals: "0.00000000",
    ...overrides
  });
}

// --- Scenario 1: $100 invested and $6 genuinely settled earnings -------------
test("settled earnings raise the available withdrawal balance and the total exactly once", () => {
  const result = balance({
    walletBalance: "6.00000000",
    investedPrincipal: "100.00000000",
    accruedEarnings: "6.00000000",
    settledEarnings: "6.00000000"
  });
  assert.equal(result.totalAccountBalance, "106.00000000");
  assert.equal(result.invested, "100.00000000");
  assert.equal(result.availableToWithdraw, "6.00000000");
  assert.equal(result.pendingWithdrawals, "0.00000000");
  assert.equal(result.pendingEarnings, "0.00000000");
  assert.equal(result.settledEarnings, "6.00000000");
});

// --- Scenario 2: $6 pending earnings --------------------------------------
test("pending earnings never increase the available withdrawal balance", () => {
  const result = balance({
    investedPrincipal: "100.00000000",
    accruedEarnings: "6.00000000"
  });
  assert.equal(result.pendingEarnings, "6.00000000");
  assert.equal(result.settledEarnings, "0.00000000");
  assert.equal(result.availableToWithdraw, "0.00000000");
  assert.equal(result.totalAccountBalance, "106.00000000");
});

// --- Scenario 3: both settled and pending earnings ------------------------
test("splits a partly settled accrual between settled and pending without overlap", () => {
  const result = balance({
    walletBalance: "6.00000000",
    investedPrincipal: "100.00000000",
    accruedEarnings: "10.00000000",
    settledEarnings: "6.00000000"
  });
  assert.equal(result.settledEarnings, "6.00000000");
  assert.equal(result.pendingEarnings, "4.00000000");
  assert.equal(result.availableToWithdraw, "6.00000000");
  assert.equal(result.totalAccountBalance, "110.00000000");
});

// --- Scenario 4: active investment whose principal is still locked --------
test("principal under maturity is held back from the available balance", () => {
  const result = balance({
    walletBalance: "100.00000000",
    underMaturity: "100.00000000"
  });
  assert.equal(result.availableToWithdraw, "0.00000000");
  assert.equal(result.underMaturity, "100.00000000");
  assert.equal(result.invested, "0.00000000");
  assert.equal(result.totalAccountBalance, "100.00000000");
});

test("funds under an actual lockup are counted in the total but are not withdrawable", () => {
  const result = balance({
    walletBalance: "6.00000000",
    lockedBalance: "4.00000000",
    investedPrincipal: "100.00000000"
  });
  assert.equal(result.locked, "4.00000000");
  assert.equal(result.availableToWithdraw, "6.00000000");
  assert.equal(result.totalAccountBalance, "110.00000000");
});

// --- Scenario 5: pending withdrawal ---------------------------------------
test("a pending withdrawal is reported but not deducted from the wallet a second time", () => {
  // The request reserved $3 of the $6 settled cash, so the wallet is already $3.
  const result = balance({
    walletBalance: "3.00000000",
    investedPrincipal: "100.00000000",
    accruedEarnings: "6.00000000",
    settledEarnings: "6.00000000",
    pendingWithdrawals: "3.00000000"
  });
  assert.equal(result.pendingWithdrawals, "3.00000000");
  assert.equal(result.availableToWithdraw, "3.00000000");
  assert.equal(result.totalAccountBalance, "103.00000000");
});

// --- Scenario 6: eligible withdrawal balance ------------------------------
test("a matured wallet balance is available to withdraw", () => {
  const result = balance({ walletBalance: "25.00000000", underMaturity: "10.00000000" });
  assert.equal(result.underMaturity, "10.00000000");
  assert.equal(result.availableToWithdraw, "15.00000000");
  assert.equal(result.totalAccountBalance, "25.00000000");
});

test("the maturity hold can never exceed the wallet and never goes negative", () => {
  const result = balance({ walletBalance: "6.00000000", underMaturity: "10.00000000" });
  assert.equal(result.underMaturity, "6.00000000");
  assert.equal(result.availableToWithdraw, "0.00000000");
});

// --- Scenario 7: genuine investment loss ----------------------------------
test("a position trading below principal fabricates neither a gain nor a withdrawal", () => {
  // The valuation floors a below-principal position at zero accrued earnings, so
  // nothing is credited and nothing becomes withdrawable.
  const result = balance({ investedPrincipal: "100.00000000", accruedEarnings: "0.00000000" });
  assert.equal(result.pendingEarnings, "0.00000000");
  assert.equal(result.availableToWithdraw, "0.00000000");
  assert.equal(result.totalAccountBalance, "100.00000000");
});

// --- Scenario 8: multiple active investments ------------------------------
test("combines several positions without double counting their settlement", () => {
  const result = balance({
    walletBalance: "6.00000000",
    investedPrincipal: "300.00000000",
    accruedEarnings: "15.00000000",
    settledEarnings: "6.00000000"
  });
  assert.equal(result.invested, "300.00000000");
  assert.equal(result.pendingEarnings, "9.00000000");
  assert.equal(result.availableToWithdraw, "6.00000000");
  assert.equal(result.totalAccountBalance, "315.00000000");
});

// --- Integrity guards ------------------------------------------------------
test("settling an accrual moves it from pending to withdrawable without changing the total", () => {
  const pending = balance({ investedPrincipal: "100.00000000", accruedEarnings: "6.00000000" });
  const settled = balance({
    walletBalance: "6.00000000",
    investedPrincipal: "100.00000000",
    accruedEarnings: "6.00000000",
    settledEarnings: "6.00000000"
  });
  assert.equal(pending.totalAccountBalance, settled.totalAccountBalance);
  assert.equal(pending.totalAccountBalance, "106.00000000");
  assert.equal(pending.availableToWithdraw, "0.00000000");
  assert.equal(settled.availableToWithdraw, "6.00000000");
});

test("pending earnings never fall below zero when a distribution exceeds the current accrual", () => {
  const result = balance({
    walletBalance: "20.00000000",
    investedPrincipal: "100.00000000",
    accruedEarnings: "6.00000000",
    settledEarnings: "20.00000000"
  });
  assert.equal(result.pendingEarnings, "0.00000000");
  assert.equal(result.availableToWithdraw, "20.00000000");
  assert.equal(result.totalAccountBalance, "120.00000000");
});

// --- Regression: floating-point columns serialised in scientific notation ----
// The wallet lock column is stored as a float. `String(0.0000007753344861)`
// yields "7.753344861060553e-7", which the strict decimal parser used to reject,
// failing the whole withdrawal summary with a 500 for that user only.
test("a lock value below 1e-6 in scientific notation no longer breaks the breakdown", () => {
  const result = balance({
    walletBalance: "0.00000000",
    lockedBalance: "7.753344861060553e-7",
    investedPrincipal: "100.00000000"
  });
  assert.equal(result.locked, "0.00000078");
  assert.equal(result.invested, "100.00000000");
  assert.equal(result.availableToWithdraw, "0.00000000");
  assert.equal(result.totalAccountBalance, "100.00000078");
});

test("a scientific-notation float normalises to the stored 8-decimal precision", () => {
  const fromString = balance({ lockedBalance: "7.753344861060553e-7" });
  const fromNumber = balance({ lockedBalance: "0.00000078" });
  assert.equal(fromString.locked, "0.00000078");
  assert.equal(fromString.locked, fromNumber.locked);
});

test("a genuinely malformed decimal is still rejected", () => {
  assert.throws(() => balance({ walletBalance: "not-a-number" }), /Invalid decimal amount/);
});
