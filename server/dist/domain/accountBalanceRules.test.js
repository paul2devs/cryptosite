"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const accountBalanceRules_1 = require("./accountBalanceRules");
function balance(overrides = {}) {
    return (0, accountBalanceRules_1.computeAccountBalance)({
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
(0, node_test_1.test)("settled earnings raise the available withdrawal balance and the total exactly once", () => {
    const result = balance({
        walletBalance: "6.00000000",
        investedPrincipal: "100.00000000",
        accruedEarnings: "6.00000000",
        settledEarnings: "6.00000000"
    });
    assert_1.default.equal(result.totalAccountBalance, "106.00000000");
    assert_1.default.equal(result.invested, "100.00000000");
    assert_1.default.equal(result.availableToWithdraw, "6.00000000");
    assert_1.default.equal(result.pendingWithdrawals, "0.00000000");
    assert_1.default.equal(result.pendingEarnings, "0.00000000");
    assert_1.default.equal(result.settledEarnings, "6.00000000");
});
// --- Scenario 2: $6 pending earnings --------------------------------------
(0, node_test_1.test)("pending earnings never increase the available withdrawal balance", () => {
    const result = balance({
        investedPrincipal: "100.00000000",
        accruedEarnings: "6.00000000"
    });
    assert_1.default.equal(result.pendingEarnings, "6.00000000");
    assert_1.default.equal(result.settledEarnings, "0.00000000");
    assert_1.default.equal(result.availableToWithdraw, "0.00000000");
    assert_1.default.equal(result.totalAccountBalance, "106.00000000");
});
// --- Scenario 3: both settled and pending earnings ------------------------
(0, node_test_1.test)("splits a partly settled accrual between settled and pending without overlap", () => {
    const result = balance({
        walletBalance: "6.00000000",
        investedPrincipal: "100.00000000",
        accruedEarnings: "10.00000000",
        settledEarnings: "6.00000000"
    });
    assert_1.default.equal(result.settledEarnings, "6.00000000");
    assert_1.default.equal(result.pendingEarnings, "4.00000000");
    assert_1.default.equal(result.availableToWithdraw, "6.00000000");
    assert_1.default.equal(result.totalAccountBalance, "110.00000000");
});
// --- Scenario 4: active investment whose principal is still locked --------
(0, node_test_1.test)("principal under maturity is held back from the available balance", () => {
    const result = balance({
        walletBalance: "100.00000000",
        underMaturity: "100.00000000"
    });
    assert_1.default.equal(result.availableToWithdraw, "0.00000000");
    assert_1.default.equal(result.underMaturity, "100.00000000");
    assert_1.default.equal(result.invested, "0.00000000");
    assert_1.default.equal(result.totalAccountBalance, "100.00000000");
});
(0, node_test_1.test)("funds under an actual lockup are counted in the total but are not withdrawable", () => {
    const result = balance({
        walletBalance: "6.00000000",
        lockedBalance: "4.00000000",
        investedPrincipal: "100.00000000"
    });
    assert_1.default.equal(result.locked, "4.00000000");
    assert_1.default.equal(result.availableToWithdraw, "6.00000000");
    assert_1.default.equal(result.totalAccountBalance, "110.00000000");
});
// --- Scenario 5: pending withdrawal ---------------------------------------
(0, node_test_1.test)("a pending withdrawal is reported but not deducted from the wallet a second time", () => {
    // The request reserved $3 of the $6 settled cash, so the wallet is already $3.
    const result = balance({
        walletBalance: "3.00000000",
        investedPrincipal: "100.00000000",
        accruedEarnings: "6.00000000",
        settledEarnings: "6.00000000",
        pendingWithdrawals: "3.00000000"
    });
    assert_1.default.equal(result.pendingWithdrawals, "3.00000000");
    assert_1.default.equal(result.availableToWithdraw, "3.00000000");
    assert_1.default.equal(result.totalAccountBalance, "103.00000000");
});
// --- Scenario 6: eligible withdrawal balance ------------------------------
(0, node_test_1.test)("a matured wallet balance is available to withdraw", () => {
    const result = balance({ walletBalance: "25.00000000", underMaturity: "10.00000000" });
    assert_1.default.equal(result.underMaturity, "10.00000000");
    assert_1.default.equal(result.availableToWithdraw, "15.00000000");
    assert_1.default.equal(result.totalAccountBalance, "25.00000000");
});
(0, node_test_1.test)("the maturity hold can never exceed the wallet and never goes negative", () => {
    const result = balance({ walletBalance: "6.00000000", underMaturity: "10.00000000" });
    assert_1.default.equal(result.underMaturity, "6.00000000");
    assert_1.default.equal(result.availableToWithdraw, "0.00000000");
});
// --- Scenario 7: genuine investment loss ----------------------------------
(0, node_test_1.test)("a position trading below principal fabricates neither a gain nor a withdrawal", () => {
    // The valuation floors a below-principal position at zero accrued earnings, so
    // nothing is credited and nothing becomes withdrawable.
    const result = balance({ investedPrincipal: "100.00000000", accruedEarnings: "0.00000000" });
    assert_1.default.equal(result.pendingEarnings, "0.00000000");
    assert_1.default.equal(result.availableToWithdraw, "0.00000000");
    assert_1.default.equal(result.totalAccountBalance, "100.00000000");
});
// --- Scenario 8: multiple active investments ------------------------------
(0, node_test_1.test)("combines several positions without double counting their settlement", () => {
    const result = balance({
        walletBalance: "6.00000000",
        investedPrincipal: "300.00000000",
        accruedEarnings: "15.00000000",
        settledEarnings: "6.00000000"
    });
    assert_1.default.equal(result.invested, "300.00000000");
    assert_1.default.equal(result.pendingEarnings, "9.00000000");
    assert_1.default.equal(result.availableToWithdraw, "6.00000000");
    assert_1.default.equal(result.totalAccountBalance, "315.00000000");
});
// --- Integrity guards ------------------------------------------------------
(0, node_test_1.test)("settling an accrual moves it from pending to withdrawable without changing the total", () => {
    const pending = balance({ investedPrincipal: "100.00000000", accruedEarnings: "6.00000000" });
    const settled = balance({
        walletBalance: "6.00000000",
        investedPrincipal: "100.00000000",
        accruedEarnings: "6.00000000",
        settledEarnings: "6.00000000"
    });
    assert_1.default.equal(pending.totalAccountBalance, settled.totalAccountBalance);
    assert_1.default.equal(pending.totalAccountBalance, "106.00000000");
    assert_1.default.equal(pending.availableToWithdraw, "0.00000000");
    assert_1.default.equal(settled.availableToWithdraw, "6.00000000");
});
(0, node_test_1.test)("pending earnings never fall below zero when a distribution exceeds the current accrual", () => {
    const result = balance({
        walletBalance: "20.00000000",
        investedPrincipal: "100.00000000",
        accruedEarnings: "6.00000000",
        settledEarnings: "20.00000000"
    });
    assert_1.default.equal(result.pendingEarnings, "0.00000000");
    assert_1.default.equal(result.availableToWithdraw, "20.00000000");
    assert_1.default.equal(result.totalAccountBalance, "120.00000000");
});
