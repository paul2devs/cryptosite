"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PERFORMANCE_PERCENT_SCALE = exports.PERFORMANCE_AMOUNT_SCALE = exports.PROJECTED_RETURN_DISCLAIMER = void 0;
exports.dayKey = dayKey;
exports.isPerformanceDayEligible = isPerformanceDayEligible;
exports.isFutureSnapshot = isFutureSnapshot;
exports.absAmount = absAmount;
exports.earningsDirection = earningsDirection;
exports.describeDailyEarnings = describeDailyEarnings;
exports.describeRealisedEarnings = describeRealisedEarnings;
exports.projectedDailyEarnings = projectedDailyEarnings;
exports.projectedEarningsSeries = projectedEarningsSeries;
const money_1 = require("./money");
exports.PROJECTED_RETURN_DISCLAIMER = "Projected figures apply a modelled daily rate to invested principal. They are not a guarantee and are not credited. Only verified valuations recorded against real positions produce reportable performance.";
exports.PERFORMANCE_AMOUNT_SCALE = 8;
exports.PERFORMANCE_PERCENT_SCALE = 6;
function dayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return "";
    return date.toISOString().slice(0, 10);
}
// Daily performance may only begin on the day after an independently verified
// deposit is confirmed. A position is not eligible for its own confirmation day.
function isPerformanceDayEligible(confirmedAt, snapshotDate) {
    if (!confirmedAt)
        return false;
    const confirmedKey = dayKey(confirmedAt);
    if (!confirmedKey)
        return false;
    return snapshotDate.localeCompare(confirmedKey) > 0;
}
function isFutureSnapshot(snapshotDate, now = new Date()) {
    return snapshotDate.localeCompare(dayKey(now)) > 0;
}
function absAmount(value) {
    const units = (0, money_1.parseDecimal)(value, exports.PERFORMANCE_AMOUNT_SCALE);
    return (0, money_1.formatDecimal)(units < 0n ? -units : units, exports.PERFORMANCE_AMOUNT_SCALE);
}
function earningsDirection(profitLoss) {
    if (profitLoss === null)
        return "unavailable";
    const units = (0, money_1.parseDecimal)(profitLoss, exports.PERFORMANCE_AMOUNT_SCALE);
    if (units > 0n)
        return "gain";
    if (units < 0n)
        return "loss";
    return "flat";
}
function describeDailyEarnings(input) {
    const direction = earningsDirection(input.profitLoss);
    if (direction === "unavailable") {
        return `Daily performance for ${input.snapshotDate} is unavailable: no independently verified ${input.asset} valuation was recorded. Reference ${input.reference}.`;
    }
    const amount = absAmount(input.profitLoss ?? "0");
    const roi = input.roiPercent ?? "0.000000";
    const source = input.source ?? "verified valuation";
    if (direction === "flat") {
        return `Daily performance for ${input.snapshotDate} was flat (0.00000000 ${input.asset}, ROI ${roi}%). Source: ${source}. Reference ${input.reference}. Unrealised and not withdrawable until a distribution is recorded.`;
    }
    const label = direction === "gain" ? "Verified gain" : "Verified loss";
    return `${label} of ${amount} ${input.asset} on ${input.snapshotDate} (ROI ${roi}%). Source: ${source}. Reference ${input.reference}. Unrealised and not withdrawable until a distribution is recorded.`;
}
function describeRealisedEarnings(input) {
    return `Realised earnings of ${(0, money_1.formatDecimal)((0, money_1.parseDecimal)(input.amount, exports.PERFORMANCE_AMOUNT_SCALE), exports.PERFORMANCE_AMOUNT_SCALE)} ${input.asset} credited to your withdrawable balance. Source: realised investment performance. Reference ${input.reference}. ${input.reason}`;
}
function projectedDailyEarnings(principal, dailyRatePercent) {
    return (0, money_1.percentOf)(principal, dailyRatePercent, exports.PERFORMANCE_AMOUNT_SCALE, exports.PERFORMANCE_PERCENT_SCALE);
}
function projectedEarningsSeries(principal, dailyRatePercent, days) {
    if (days <= 0)
        return "0.00000000";
    const total = (0, money_1.parseDecimal)((0, money_1.percentOf)(principal, dailyRatePercent, exports.PERFORMANCE_AMOUNT_SCALE, exports.PERFORMANCE_PERCENT_SCALE), exports.PERFORMANCE_AMOUNT_SCALE);
    return (0, money_1.formatDecimal)(total * BigInt(days), exports.PERFORMANCE_AMOUNT_SCALE);
}
