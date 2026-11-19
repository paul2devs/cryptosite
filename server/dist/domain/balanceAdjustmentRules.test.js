"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const balanceAdjustmentRules_1 = require("./balanceAdjustmentRules");
const money_1 = require("./money");
const SCALE = 8;
(0, node_test_1.test)("accepts adjustment types and rejects unknown values", () => {
    assert_1.default.equal((0, balanceAdjustmentRules_1.isBalanceAdjustmentType)("credit"), true);
    assert_1.default.equal((0, balanceAdjustmentRules_1.isBalanceAdjustmentType)("investment_allocation"), true);
    assert_1.default.equal((0, balanceAdjustmentRules_1.isBalanceAdjustmentType)("reversal"), true);
    assert_1.default.equal((0, balanceAdjustmentRules_1.isBalanceAdjustmentType)("transfer"), false);
    assert_1.default.equal((0, balanceAdjustmentRules_1.isBalanceAdjustmentType)(undefined), false);
});
(0, node_test_1.test)("normalizes precise decimal amounts without losing precision", () => {
    assert_1.default.equal((0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)("10"), "10.00000000");
    assert_1.default.equal((0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)("0.00000001"), "0.00000001");
    assert_1.default.equal((0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)("1234567.89"), "1234567.89000000");
    assert_1.default.equal((0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)(42.5), "42.50000000");
});
(0, node_test_1.test)("rejects zero, negative, malformed and over-precise amounts", () => {
    assert_1.default.throws(() => (0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)("0"), /greater than zero/);
    assert_1.default.throws(() => (0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)("-5"), /positive number/);
    assert_1.default.throws(() => (0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)("abc"), /positive number/);
    assert_1.default.throws(() => (0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)("1.123456789"), /precision/);
    assert_1.default.throws(() => (0, balanceAdjustmentRules_1.normalizeAdjustmentAmount)(""), /positive number/);
});
(0, node_test_1.test)("credit increases available balance and never touches principal", () => {
    const plan = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "credit", direction: "credit", amountUnits: (0, money_1.parseDecimal)("25.5", SCALE) });
    assert_1.default.equal(plan.availableDelta, (0, money_1.parseDecimal)("25.5", SCALE));
    assert_1.default.equal(plan.principalDelta, 0n);
    assert_1.default.deepEqual(plan.ledger, {
        debit: "adjustments",
        credit: "available_balance",
        transactionType: "account_adjustment"
    });
});
(0, node_test_1.test)("debit decreases available balance and never touches principal", () => {
    const plan = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "debit", direction: "debit", amountUnits: (0, money_1.parseDecimal)("12", SCALE) });
    assert_1.default.equal(plan.availableDelta, (0, money_1.parseDecimal)("-12", SCALE));
    assert_1.default.equal(plan.principalDelta, 0n);
    assert_1.default.deepEqual(plan.ledger, {
        debit: "available_balance",
        credit: "adjustments",
        transactionType: "account_adjustment"
    });
});
(0, node_test_1.test)("correction follows the requested direction on the available balance", () => {
    const add = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "correction", direction: "credit", amountUnits: (0, money_1.parseDecimal)("3", SCALE) });
    const remove = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "correction", direction: "debit", amountUnits: (0, money_1.parseDecimal)("3", SCALE) });
    assert_1.default.equal(add.availableDelta, (0, money_1.parseDecimal)("3", SCALE));
    assert_1.default.equal(remove.availableDelta, (0, money_1.parseDecimal)("-3", SCALE));
    assert_1.default.equal(add.ledger?.debit, "adjustments");
    assert_1.default.equal(remove.ledger?.debit, "available_balance");
});
(0, node_test_1.test)("investment allocation moves funds from available balance into principal", () => {
    const plan = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "investment_allocation", direction: "debit", amountUnits: (0, money_1.parseDecimal)("100", SCALE) });
    assert_1.default.equal(plan.availableDelta, (0, money_1.parseDecimal)("-100", SCALE));
    assert_1.default.equal(plan.principalDelta, (0, money_1.parseDecimal)("100", SCALE));
    assert_1.default.deepEqual(plan.ledger, {
        debit: "available_balance",
        credit: "invested_principal",
        transactionType: "investment_allocation"
    });
});
(0, node_test_1.test)("investment deallocation moves funds from principal back into available balance", () => {
    const plan = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "investment_deallocation", direction: "credit", amountUnits: (0, money_1.parseDecimal)("100", SCALE) });
    assert_1.default.equal(plan.availableDelta, (0, money_1.parseDecimal)("100", SCALE));
    assert_1.default.equal(plan.principalDelta, (0, money_1.parseDecimal)("-100", SCALE));
    assert_1.default.deepEqual(plan.ledger, {
        debit: "invested_principal",
        credit: "available_balance",
        transactionType: "investment_redemption"
    });
});
(0, node_test_1.test)("inverting an adjustment swaps its financial direction", () => {
    assert_1.default.deepEqual((0, balanceAdjustmentRules_1.invertAdjustment)({ type: "credit", direction: "credit" }), { type: "debit", direction: "debit" });
    assert_1.default.deepEqual((0, balanceAdjustmentRules_1.invertAdjustment)({ type: "debit", direction: "debit" }), { type: "credit", direction: "credit" });
    assert_1.default.deepEqual((0, balanceAdjustmentRules_1.invertAdjustment)({ type: "correction", direction: "credit" }), {
        type: "correction",
        direction: "debit"
    });
    assert_1.default.deepEqual((0, balanceAdjustmentRules_1.invertAdjustment)({ type: "investment_allocation", direction: "debit" }), {
        type: "investment_deallocation",
        direction: "credit"
    });
});
(0, node_test_1.test)("reversing a credit applies an explicit adjustment_reversal entry", () => {
    const plan = (0, balanceAdjustmentRules_1.planReversal)({ type: "credit", direction: "credit", amountUnits: (0, money_1.parseDecimal)("40", SCALE) });
    assert_1.default.equal(plan.availableDelta, (0, money_1.parseDecimal)("-40", SCALE));
    assert_1.default.equal(plan.principalDelta, 0n);
    assert_1.default.equal(plan.ledger?.transactionType, "adjustment_reversal");
    assert_1.default.deepEqual(plan.ledger, {
        debit: "available_balance",
        credit: "adjustments",
        transactionType: "adjustment_reversal"
    });
});
(0, node_test_1.test)("reversing an allocation pulls principal back into available balance", () => {
    const plan = (0, balanceAdjustmentRules_1.planReversal)({ type: "investment_allocation", direction: "debit", amountUnits: (0, money_1.parseDecimal)("40", SCALE) });
    assert_1.default.equal(plan.availableDelta, (0, money_1.parseDecimal)("40", SCALE));
    assert_1.default.equal(plan.principalDelta, (0, money_1.parseDecimal)("-40", SCALE));
    assert_1.default.deepEqual(plan.ledger, {
        debit: "invested_principal",
        credit: "available_balance",
        transactionType: "investment_redemption"
    });
});
(0, node_test_1.test)("derives a direction for each adjustment type", () => {
    assert_1.default.equal((0, balanceAdjustmentRules_1.directionForAdjustment)("credit", null), "credit");
    assert_1.default.equal((0, balanceAdjustmentRules_1.directionForAdjustment)("debit", null), "debit");
    assert_1.default.equal((0, balanceAdjustmentRules_1.directionForAdjustment)("investment_allocation", null), "debit");
    assert_1.default.equal((0, balanceAdjustmentRules_1.directionForAdjustment)("investment_deallocation", null), "credit");
    assert_1.default.equal((0, balanceAdjustmentRules_1.directionForAdjustment)("correction", "debit"), "debit");
    assert_1.default.equal((0, balanceAdjustmentRules_1.directionForAdjustment)("correction", "credit"), "credit");
    assert_1.default.equal((0, balanceAdjustmentRules_1.directionForAdjustment)("correction", null), "credit");
});
(0, node_test_1.test)("accepts the valuation, pending earnings and realised earnings types", () => {
    assert_1.default.equal((0, balanceAdjustmentRules_1.isBalanceAdjustmentType)("valuation_correction"), true);
    assert_1.default.equal((0, balanceAdjustmentRules_1.isBalanceAdjustmentType)("pending_earnings"), true);
    assert_1.default.equal((0, balanceAdjustmentRules_1.isBalanceAdjustmentType)("realised_earnings"), true);
});
(0, node_test_1.test)("valuation correction moves only the position valuation and posts no cash ledger legs", () => {
    const up = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "valuation_correction", direction: "credit", amountUnits: (0, money_1.parseDecimal)("50", SCALE) });
    const down = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "valuation_correction", direction: "debit", amountUnits: (0, money_1.parseDecimal)("50", SCALE) });
    assert_1.default.equal(up.availableDelta, 0n);
    assert_1.default.equal(up.principalDelta, 0n);
    assert_1.default.equal(up.valuationDelta, (0, money_1.parseDecimal)("50", SCALE));
    assert_1.default.equal(down.valuationDelta, (0, money_1.parseDecimal)("-50", SCALE));
    assert_1.default.equal(up.ledger, null);
    assert_1.default.equal(down.ledger, null);
});
(0, node_test_1.test)("pending earnings adjustments never credit the available wallet balance", () => {
    const credit = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "pending_earnings", direction: "credit", amountUnits: (0, money_1.parseDecimal)("7", SCALE) });
    const debit = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "pending_earnings", direction: "debit", amountUnits: (0, money_1.parseDecimal)("7", SCALE) });
    assert_1.default.equal(credit.availableDelta, 0n);
    assert_1.default.equal(debit.availableDelta, 0n);
    assert_1.default.equal(credit.principalDelta, 0n);
    assert_1.default.equal(debit.principalDelta, 0n);
    assert_1.default.deepEqual(credit.ledger, {
        debit: "adjustments",
        credit: "pending_settlement",
        transactionType: "pending_earnings_adjustment"
    });
    assert_1.default.deepEqual(debit.ledger, {
        debit: "pending_settlement",
        credit: "adjustments",
        transactionType: "pending_earnings_adjustment"
    });
});
(0, node_test_1.test)("realised earnings increase settles into available balance and decrease reverses it", () => {
    const increase = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "realised_earnings", direction: "credit", amountUnits: (0, money_1.parseDecimal)("9", SCALE) });
    const decrease = (0, balanceAdjustmentRules_1.planAdjustment)({ type: "realised_earnings", direction: "debit", amountUnits: (0, money_1.parseDecimal)("9", SCALE) });
    assert_1.default.equal(increase.availableDelta, (0, money_1.parseDecimal)("9", SCALE));
    assert_1.default.equal(decrease.availableDelta, (0, money_1.parseDecimal)("-9", SCALE));
    assert_1.default.deepEqual(increase.ledger, {
        debit: "realized_earnings",
        credit: "available_balance",
        transactionType: "profit_distribution"
    });
    assert_1.default.deepEqual(decrease.ledger, {
        debit: "available_balance",
        credit: "realized_earnings",
        transactionType: "earnings_correction"
    });
});
(0, node_test_1.test)("reversing a valuation correction inverts only the valuation delta", () => {
    const plan = (0, balanceAdjustmentRules_1.planReversal)({ type: "valuation_correction", direction: "credit", amountUnits: (0, money_1.parseDecimal)("30", SCALE) });
    assert_1.default.equal(plan.availableDelta, 0n);
    assert_1.default.equal(plan.principalDelta, 0n);
    assert_1.default.equal(plan.valuationDelta, (0, money_1.parseDecimal)("-30", SCALE));
    assert_1.default.equal(plan.ledger, null);
});
(0, node_test_1.test)("inverting the new types flips only the requested direction", () => {
    assert_1.default.deepEqual((0, balanceAdjustmentRules_1.invertAdjustment)({ type: "valuation_correction", direction: "credit" }), {
        type: "valuation_correction",
        direction: "debit"
    });
    assert_1.default.deepEqual((0, balanceAdjustmentRules_1.invertAdjustment)({ type: "pending_earnings", direction: "debit" }), {
        type: "pending_earnings",
        direction: "credit"
    });
    assert_1.default.deepEqual((0, balanceAdjustmentRules_1.invertAdjustment)({ type: "realised_earnings", direction: "credit" }), {
        type: "realised_earnings",
        direction: "debit"
    });
});
