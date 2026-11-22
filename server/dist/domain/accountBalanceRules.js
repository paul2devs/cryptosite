"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACCOUNT_BALANCE_SCALE = void 0;
exports.computeAccountBalance = computeAccountBalance;
const money_1 = require("./money");
/**
 * The single authoritative account-balance breakdown.
 *
 * Every surface (dashboard, portfolio, performance, wallet and the withdrawal
 * page) must read these figures from one calculation so the same money can never
 * be counted as pending, settled and withdrawable at the same time. The rule is
 * pure: it takes the already-authoritative inputs and separates them into the
 * categories the withdrawal page is required to distinguish.
 *
 * Inputs and their meaning:
 *  - `walletBalance`        cash that has been credited and settled. It is the
 *                           account's `withdrawable_balance`, which is already
 *                           net of every in-flight withdrawal request.
 *  - `lockedBalance`        funds held under an actual lockup/restriction.
 *  - `investedPrincipal`    principal currently allocated to active positions.
 *  - `accruedEarnings`      total gain accrued onto positions, whether or not it
 *                           has been distributed yet.
 *  - `settledEarnings`      earnings already distributed (credited to the wallet).
 *  - `underMaturity`        portion of the wallet still inside a maturity window.
 *  - `pendingWithdrawals`   requests submitted but not yet completed. These are
 *                           informational: the amount was already deducted from
 *                           `walletBalance` when the request was reserved.
 */
exports.ACCOUNT_BALANCE_SCALE = 8;
const SCALE = exports.ACCOUNT_BALANCE_SCALE;
function units(value) {
    return (0, money_1.parseDecimal)(String(value ?? "0"), SCALE);
}
function fmt(value) {
    return (0, money_1.formatDecimal)(value, SCALE);
}
function nonNegative(value) {
    return value > 0n ? value : 0n;
}
function computeAccountBalance(input) {
    const wallet = units(input.walletBalance);
    const locked = units(input.lockedBalance);
    const invested = units(input.investedPrincipal);
    const accrued = units(input.accruedEarnings);
    const settled = units(input.settledEarnings);
    // Recording a distribution credits `available_balance` (raising the wallet)
    // while the position valuation -- and therefore `accruedEarnings` -- stays
    // unchanged. The earnings that are genuinely still pending are the part of the
    // accrual that has not been distributed; adding the full accrual on top of the
    // wallet would count the settled part twice.
    const pendingEarnings = nonNegative(accrued - settled);
    // A pending withdrawal is deducted from the wallet the moment it is reserved,
    // so `walletBalance` is already net of in-flight requests and must not be
    // reduced a second time here.
    const underMaturity = nonNegative(units(input.underMaturity));
    const maturedCap = underMaturity > wallet ? wallet : underMaturity;
    const availableToWithdraw = nonNegative(wallet - maturedCap);
    return {
        availableToWithdraw: fmt(availableToWithdraw),
        invested: fmt(invested),
        pendingWithdrawals: fmt(nonNegative(units(input.pendingWithdrawals))),
        underMaturity: fmt(maturedCap),
        locked: fmt(locked),
        pendingEarnings: fmt(pendingEarnings),
        settledEarnings: fmt(settled),
        // `underMaturity` is a subset of the wallet, so it is never added again.
        totalAccountBalance: fmt(wallet + locked + invested + pendingEarnings)
    };
}
