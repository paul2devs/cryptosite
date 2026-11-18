"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BALANCE_ADJUSTMENT_LABEL = exports.BALANCE_ADJUSTMENT_TYPES = exports.REQUESTABLE_ADJUSTMENT_TYPES = void 0;
exports.isBalanceAdjustmentType = isBalanceAdjustmentType;
exports.normalizeAdjustmentAmount = normalizeAdjustmentAmount;
exports.planAdjustment = planAdjustment;
exports.invertAdjustment = invertAdjustment;
exports.planReversal = planReversal;
exports.directionForAdjustment = directionForAdjustment;
const money_1 = require("./money");
const AMOUNT_SCALE = 8;
// Adjustment types an administrator can request directly. `reversal` is produced by
// the reversal workflow, never submitted as a raw adjustment.
exports.REQUESTABLE_ADJUSTMENT_TYPES = [
    "credit",
    "debit",
    "investment_allocation",
    "investment_deallocation",
    "correction"
];
exports.BALANCE_ADJUSTMENT_TYPES = [
    ...exports.REQUESTABLE_ADJUSTMENT_TYPES,
    "reversal"
];
exports.BALANCE_ADJUSTMENT_LABEL = {
    credit: "Credit",
    debit: "Debit",
    investment_allocation: "Investment allocation",
    investment_deallocation: "Investment deallocation",
    correction: "Correction",
    reversal: "Reversal"
};
function isBalanceAdjustmentType(value) {
    return typeof value === "string" && exports.BALANCE_ADJUSTMENT_TYPES.includes(value);
}
// Validates and normalizes an administrator-entered amount into a positive 8 decimal
// magnitude. Zero, negative, malformed, and over-precise values are rejected so a
// balance can never be moved by an ambiguous number.
function normalizeAdjustmentAmount(raw) {
    const trimmed = String(raw ?? "").trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
        throw new Error("Amount must be a positive number.");
    }
    const units = (0, money_1.parseDecimal)(trimmed, AMOUNT_SCALE);
    if (units <= 0n) {
        throw new Error("Amount must be greater than zero.");
    }
    return (0, money_1.formatDecimal)(units, AMOUNT_SCALE);
}
// Resolves how an adjustment moves the user's available balance and invested principal,
// and the balanced double-entry ledger legs that record it. Only corrections consult
// `direction`; every other type has a fixed, unambiguous financial effect.
function planAdjustment(input) {
    const amount = input.amountUnits;
    switch (input.type) {
        case "credit":
            return {
                availableDelta: amount,
                principalDelta: 0n,
                ledger: { debit: "adjustments", credit: "available_balance", transactionType: "account_adjustment" }
            };
        case "debit":
            return {
                availableDelta: -amount,
                principalDelta: 0n,
                ledger: { debit: "available_balance", credit: "adjustments", transactionType: "account_adjustment" }
            };
        case "correction":
            return input.direction === "credit"
                ? {
                    availableDelta: amount,
                    principalDelta: 0n,
                    ledger: { debit: "adjustments", credit: "available_balance", transactionType: "account_adjustment" }
                }
                : {
                    availableDelta: -amount,
                    principalDelta: 0n,
                    ledger: { debit: "available_balance", credit: "adjustments", transactionType: "account_adjustment" }
                };
        case "investment_allocation":
            return {
                availableDelta: -amount,
                principalDelta: amount,
                ledger: { debit: "available_balance", credit: "invested_principal", transactionType: "investment_allocation" }
            };
        case "investment_deallocation":
            return {
                availableDelta: amount,
                principalDelta: -amount,
                ledger: { debit: "invested_principal", credit: "available_balance", transactionType: "investment_redemption" }
            };
        default:
            return {
                availableDelta: 0n,
                principalDelta: 0n,
                ledger: { debit: "adjustments", credit: "available_balance", transactionType: "adjustment_reversal" }
            };
    }
}
// The exact opposite financial effect of an adjustment, used to reverse a mistake.
function invertAdjustment(input) {
    const flip = (direction) => direction === "credit" ? "debit" : "credit";
    switch (input.type) {
        case "credit":
            return { type: "debit", direction: "debit" };
        case "debit":
            return { type: "credit", direction: "credit" };
        case "correction":
            return { type: "correction", direction: flip(input.direction) };
        case "investment_allocation":
            return { type: "investment_deallocation", direction: "credit" };
        case "investment_deallocation":
            return { type: "investment_allocation", direction: "debit" };
        default:
            return { type: "correction", direction: flip(input.direction) };
    }
}
// Plans the ledger legs for reversing a prior adjustment. Balance-only reversals are
// recorded under the dedicated `adjustment_reversal` ledger type so the audit trail is
// explicit; reversed principal moves keep their investment ledger type.
function planReversal(input) {
    const inverse = invertAdjustment({ type: input.type, direction: input.direction });
    const base = planAdjustment({ type: inverse.type, direction: inverse.direction, amountUnits: input.amountUnits });
    const isPrincipalMove = inverse.type === "investment_allocation" || inverse.type === "investment_deallocation";
    return {
        availableDelta: base.availableDelta,
        principalDelta: base.principalDelta,
        ledger: {
            debit: base.ledger.debit,
            credit: base.ledger.credit,
            transactionType: isPrincipalMove ? base.ledger.transactionType : "adjustment_reversal"
        }
    };
}
function directionForAdjustment(type, requested) {
    if (type === "correction") {
        return requested === "debit" ? "debit" : "credit";
    }
    if (type === "debit" || type === "investment_allocation")
        return "debit";
    return "credit";
}
