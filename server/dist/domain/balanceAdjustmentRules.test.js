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
    assert_1.default.equal(add.ledger.debit, "adjustments");
    assert_1.default.equal(remove.ledger.debit, "available_balance");
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
    assert_1.default.equal(plan.ledger.transactionType, "adjustment_reversal");
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
