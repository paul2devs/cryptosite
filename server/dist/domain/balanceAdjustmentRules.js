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
    "correction",
    "valuation_correction",
    "pending_earnings",
    "realised_earnings"
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
    valuation_correction: "Valuation correction",
    pending_earnings: "Pending earnings adjustment",
    realised_earnings: "Realised earnings adjustment",
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
// Resolves how an adjustment moves the user's available balance, invested principal and
// investment valuation, and the balanced double-entry ledger legs that record it. Every
// type except `correction` and the three earnings/valuation corrections has a fixed,
// unambiguous financial effect; those consult the requested `direction`.
function planAdjustment(input) {
    const amount = input.amountUnits;
    switch (input.type) {
        case "credit":
            return {
                availableDelta: amount,
                principalDelta: 0n,
                valuationDelta: 0n,
                ledger: { debit: "adjustments", credit: "available_balance", transactionType: "account_adjustment" }
            };
        case "debit":
            return {
                availableDelta: -amount,
                principalDelta: 0n,
                valuationDelta: 0n,
                ledger: { debit: "available_balance", credit: "adjustments", transactionType: "account_adjustment" }
            };
        case "correction":
            return input.direction === "credit"
                ? {
                    availableDelta: amount,
                    principalDelta: 0n,
                    valuationDelta: 0n,
                    ledger: { debit: "adjustments", credit: "available_balance", transactionType: "account_adjustment" }
                }
                : {
                    availableDelta: -amount,
                    principalDelta: 0n,
                    valuationDelta: 0n,
                    ledger: { debit: "available_balance", credit: "adjustments", transactionType: "account_adjustment" }
                };
        case "investment_allocation":
            return {
                availableDelta: -amount,
                principalDelta: amount,
                valuationDelta: 0n,
                ledger: { debit: "available_balance", credit: "invested_principal", transactionType: "investment_allocation" }
            };
        case "investment_deallocation":
            return {
                availableDelta: amount,
                principalDelta: -amount,
                valuationDelta: 0n,
                ledger: { debit: "invested_principal", credit: "available_balance", transactionType: "investment_redemption" }
            };
        // Corrects a single investment position's own valuation. It never touches the wallet
        // or the principal, and it posts no cash ledger legs. The underlying position is the
        // source of truth, so the derived portfolio total is corrected through its component
        // rather than being overwritten.
        case "valuation_correction":
            return {
                availableDelta: 0n,
                principalDelta: 0n,
                valuationDelta: input.direction === "debit" ? -amount : amount,
                ledger: null
            };
        // Moves the pending earnings figure between the pending settlement account and the
        // adjustment account. It deliberately never credits the available wallet balance:
        // pending earnings stay unsettled until the settlement workflow authorises a payout.
        case "pending_earnings":
            return input.direction === "debit"
                ? {
                    availableDelta: 0n,
                    principalDelta: 0n,
                    valuationDelta: 0n,
                    ledger: { debit: "pending_settlement", credit: "adjustments", transactionType: "pending_earnings_adjustment" }
                }
                : {
                    availableDelta: 0n,
                    principalDelta: 0n,
                    valuationDelta: 0n,
                    ledger: { debit: "adjustments", credit: "pending_settlement", transactionType: "pending_earnings_adjustment" }
                };
        // Settlement-style adjustment of realised earnings. An increase credits the available
        // wallet balance the way a verified profit distribution does; a decrease reverses that
        // movement. This is an administrative correction, never presented as investment profit.
        case "realised_earnings":
            return input.direction === "debit"
                ? {
                    availableDelta: -amount,
                    principalDelta: 0n,
                    valuationDelta: 0n,
                    ledger: { debit: "available_balance", credit: "realized_earnings", transactionType: "earnings_correction" }
                }
                : {
                    availableDelta: amount,
                    principalDelta: 0n,
                    valuationDelta: 0n,
                    ledger: { debit: "realized_earnings", credit: "available_balance", transactionType: "profit_distribution" }
                };
        default:
            return {
                availableDelta: 0n,
                principalDelta: 0n,
                valuationDelta: 0n,
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
        case "valuation_correction":
            return { type: "valuation_correction", direction: flip(input.direction) };
        case "pending_earnings":
            return { type: "pending_earnings", direction: flip(input.direction) };
        case "realised_earnings":
            return { type: "realised_earnings", direction: flip(input.direction) };
        default:
            return { type: "correction", direction: flip(input.direction) };
    }
}
// Plans the ledger legs for reversing a prior adjustment. Balance-only reversals are
// recorded under the dedicated `adjustment_reversal` ledger type so the audit trail is
// explicit; reversed principal moves keep their investment ledger type, and valuation
// corrections (which never touch the cash ledger) stay ledger-less.
function planReversal(input) {
    const inverse = invertAdjustment({ type: input.type, direction: input.direction });
    const base = planAdjustment({ type: inverse.type, direction: inverse.direction, amountUnits: input.amountUnits });
    const isPrincipalMove = inverse.type === "investment_allocation" || inverse.type === "investment_deallocation";
    return {
        availableDelta: base.availableDelta,
        principalDelta: base.principalDelta,
        valuationDelta: base.valuationDelta,
        ledger: base.ledger === null
            ? null
            : {
                debit: base.ledger.debit,
                credit: base.ledger.credit,
                transactionType: isPrincipalMove ? base.ledger.transactionType : "adjustment_reversal"
            }
    };
}
function directionForAdjustment(type, requested) {
    if (type === "correction" || type === "valuation_correction" || type === "pending_earnings" || type === "realised_earnings") {
        return requested === "debit" ? "debit" : "credit";
    }
    if (type === "debit" || type === "investment_allocation")
        return "debit";
    return "credit";
}
