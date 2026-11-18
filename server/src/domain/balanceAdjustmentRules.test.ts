import assert from "assert";
import { test } from "node:test";
import {
  directionForAdjustment,
  invertAdjustment,
  isBalanceAdjustmentType,
  normalizeAdjustmentAmount,
  planAdjustment,
  planReversal
} from "./balanceAdjustmentRules";
import { parseDecimal } from "./money";

const SCALE = 8;

test("accepts adjustment types and rejects unknown values", () => {
  assert.equal(isBalanceAdjustmentType("credit"), true);
  assert.equal(isBalanceAdjustmentType("investment_allocation"), true);
  assert.equal(isBalanceAdjustmentType("reversal"), true);
  assert.equal(isBalanceAdjustmentType("transfer"), false);
  assert.equal(isBalanceAdjustmentType(undefined), false);
});

test("normalizes precise decimal amounts without losing precision", () => {
  assert.equal(normalizeAdjustmentAmount("10"), "10.00000000");
  assert.equal(normalizeAdjustmentAmount("0.00000001"), "0.00000001");
  assert.equal(normalizeAdjustmentAmount("1234567.89"), "1234567.89000000");
  assert.equal(normalizeAdjustmentAmount(42.5), "42.50000000");
});

test("rejects zero, negative, malformed and over-precise amounts", () => {
  assert.throws(() => normalizeAdjustmentAmount("0"), /greater than zero/);
  assert.throws(() => normalizeAdjustmentAmount("-5"), /positive number/);
  assert.throws(() => normalizeAdjustmentAmount("abc"), /positive number/);
  assert.throws(() => normalizeAdjustmentAmount("1.123456789"), /precision/);
  assert.throws(() => normalizeAdjustmentAmount(""), /positive number/);
});

test("credit increases available balance and never touches principal", () => {
  const plan = planAdjustment({ type: "credit", direction: "credit", amountUnits: parseDecimal("25.5", SCALE) });
  assert.equal(plan.availableDelta, parseDecimal("25.5", SCALE));
  assert.equal(plan.principalDelta, 0n);
  assert.deepEqual(plan.ledger, {
    debit: "adjustments",
    credit: "available_balance",
    transactionType: "account_adjustment"
  });
});

test("debit decreases available balance and never touches principal", () => {
  const plan = planAdjustment({ type: "debit", direction: "debit", amountUnits: parseDecimal("12", SCALE) });
  assert.equal(plan.availableDelta, parseDecimal("-12", SCALE));
  assert.equal(plan.principalDelta, 0n);
  assert.deepEqual(plan.ledger, {
    debit: "available_balance",
    credit: "adjustments",
    transactionType: "account_adjustment"
  });
});

test("correction follows the requested direction on the available balance", () => {
  const add = planAdjustment({ type: "correction", direction: "credit", amountUnits: parseDecimal("3", SCALE) });
  const remove = planAdjustment({ type: "correction", direction: "debit", amountUnits: parseDecimal("3", SCALE) });
  assert.equal(add.availableDelta, parseDecimal("3", SCALE));
  assert.equal(remove.availableDelta, parseDecimal("-3", SCALE));
  assert.equal(add.ledger.debit, "adjustments");
  assert.equal(remove.ledger.debit, "available_balance");
});

test("investment allocation moves funds from available balance into principal", () => {
  const plan = planAdjustment({ type: "investment_allocation", direction: "debit", amountUnits: parseDecimal("100", SCALE) });
  assert.equal(plan.availableDelta, parseDecimal("-100", SCALE));
  assert.equal(plan.principalDelta, parseDecimal("100", SCALE));
  assert.deepEqual(plan.ledger, {
    debit: "available_balance",
    credit: "invested_principal",
    transactionType: "investment_allocation"
  });
});

test("investment deallocation moves funds from principal back into available balance", () => {
  const plan = planAdjustment({ type: "investment_deallocation", direction: "credit", amountUnits: parseDecimal("100", SCALE) });
  assert.equal(plan.availableDelta, parseDecimal("100", SCALE));
  assert.equal(plan.principalDelta, parseDecimal("-100", SCALE));
  assert.deepEqual(plan.ledger, {
    debit: "invested_principal",
    credit: "available_balance",
    transactionType: "investment_redemption"
  });
});

test("inverting an adjustment swaps its financial direction", () => {
  assert.deepEqual(invertAdjustment({ type: "credit", direction: "credit" }), { type: "debit", direction: "debit" });
  assert.deepEqual(invertAdjustment({ type: "debit", direction: "debit" }), { type: "credit", direction: "credit" });
  assert.deepEqual(invertAdjustment({ type: "correction", direction: "credit" }), {
    type: "correction",
    direction: "debit"
  });
  assert.deepEqual(invertAdjustment({ type: "investment_allocation", direction: "debit" }), {
    type: "investment_deallocation",
    direction: "credit"
  });
});

test("reversing a credit applies an explicit adjustment_reversal entry", () => {
  const plan = planReversal({ type: "credit", direction: "credit", amountUnits: parseDecimal("40", SCALE) });
  assert.equal(plan.availableDelta, parseDecimal("-40", SCALE));
  assert.equal(plan.principalDelta, 0n);
  assert.equal(plan.ledger.transactionType, "adjustment_reversal");
  assert.deepEqual(plan.ledger, {
    debit: "available_balance",
    credit: "adjustments",
    transactionType: "adjustment_reversal"
  });
});

test("reversing an allocation pulls principal back into available balance", () => {
  const plan = planReversal({ type: "investment_allocation", direction: "debit", amountUnits: parseDecimal("40", SCALE) });
  assert.equal(plan.availableDelta, parseDecimal("40", SCALE));
  assert.equal(plan.principalDelta, parseDecimal("-40", SCALE));
  assert.deepEqual(plan.ledger, {
    debit: "invested_principal",
    credit: "available_balance",
    transactionType: "investment_redemption"
  });
});

test("derives a direction for each adjustment type", () => {
  assert.equal(directionForAdjustment("credit", null), "credit");
  assert.equal(directionForAdjustment("debit", null), "debit");
  assert.equal(directionForAdjustment("investment_allocation", null), "debit");
  assert.equal(directionForAdjustment("investment_deallocation", null), "credit");
  assert.equal(directionForAdjustment("correction", "debit"), "debit");
  assert.equal(directionForAdjustment("correction", "credit"), "credit");
  assert.equal(directionForAdjustment("correction", null), "credit");
});
