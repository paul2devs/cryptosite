"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EARNINGS_DAILY_LOSS_RATE_PERCENT = exports.EARNINGS_DAILY_MAX_RATE_PERCENT = exports.EARNINGS_DAILY_MIN_RATE_PERCENT = exports.EARNINGS_ACCRUAL_SOURCE = exports.DEFAULT_EARNINGS_PERIOD_DAYS = exports.DEFAULT_DAILY_EARNINGS_RATE_PERCENT = exports.PERFORMANCE_PERCENT_SCALE = exports.PERFORMANCE_AMOUNT_SCALE = exports.PROJECTED_RETURN_DISCLAIMER = void 0;
exports.dayKey = dayKey;
exports.isPerformanceDayEligible = isPerformanceDayEligible;
exports.isFutureSnapshot = isFutureSnapshot;
exports.absAmount = absAmount;
exports.earningsDirection = earningsDirection;
exports.describeDailyEarnings = describeDailyEarnings;
exports.describeRealisedEarnings = describeRealisedEarnings;
exports.projectedDailyEarnings = projectedDailyEarnings;
exports.projectedEarningsSeries = projectedEarningsSeries;
exports.earningsPeriodDays = earningsPeriodDays;
exports.periodRoiPercent = periodRoiPercent;
exports.dailyEarningsRatePercent = dailyEarningsRatePercent;
exports.buildDailyEarningsAccrual = buildDailyEarningsAccrual;
exports.earningsAccrualKey = earningsAccrualKey;
exports.deterministicDailyRatePercent = deterministicDailyRatePercent;
exports.describeDailyRateBand = describeDailyRateBand;
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
// ---------------------------------------------------------------------------
// Daily investment earnings plan
//
// The platform pays a fixed daily rate on eligible invested principal. The plan
// is simple interest: every period earns `rate × principal`, and the accrued
// amount is carried on top of the running position value. Earnings accrue as
// pending (unsettled) performance; they are only turned into withdrawable cash
// by an explicit profit distribution.
// ---------------------------------------------------------------------------
exports.DEFAULT_DAILY_EARNINGS_RATE_PERCENT = "3.000000";
/** Default length, in days, of a projected investment period. */
exports.DEFAULT_EARNINGS_PERIOD_DAYS = 30;
/**
 * Normalise a configured period length to a whole number of days, defaulting to
 * the platform period when the value is absent or malformed.
 */
function earningsPeriodDays(configured) {
    const parsed = typeof configured === "number" ? configured : Number(configured);
    if (!Number.isFinite(parsed) || parsed < 1)
        return exports.DEFAULT_EARNINGS_PERIOD_DAYS;
    return Math.trunc(parsed);
}
/**
 * The projected return for a whole period, using the same simple-interest model
 * as the daily plan: `period ROI = daily rate × period days`. It is a modelled
 * projection only, never a credited or guaranteed figure.
 */
function periodRoiPercent(dailyRatePercent, days) {
    const rate = dailyEarningsRatePercent(dailyRatePercent);
    const rateUnits = (0, money_1.parseDecimal)(rate, exports.PERFORMANCE_PERCENT_SCALE);
    return (0, money_1.formatDecimal)(rateUnits * BigInt(earningsPeriodDays(days)), exports.PERFORMANCE_PERCENT_SCALE);
}
/** Marks daily snapshots produced by the scheduled earnings plan. */
exports.EARNINGS_ACCRUAL_SOURCE = "scheduled_earnings_plan";
/**
 * Normalise a configured daily rate to the 6-decimal percent scale used by the
 * money helpers, falling back to the platform default when the value is absent
 * or malformed. A configured value can never silently disable the plan.
 */
function dailyEarningsRatePercent(configured) {
    if (typeof configured === "string") {
        const trimmed = configured.trim();
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            const [whole, fraction = ""] = trimmed.split(".");
            const normalised = `${whole}.${(fraction + "000000").slice(0, exports.PERFORMANCE_PERCENT_SCALE)}`;
            if ((0, money_1.parseDecimal)(normalised, exports.PERFORMANCE_PERCENT_SCALE) > 0n) {
                return normalised;
            }
        }
    }
    return exports.DEFAULT_DAILY_EARNINGS_RATE_PERCENT;
}
function percentFromUnits(profitUnits, openingUnits) {
    if (openingUnits === 0n)
        return null;
    const scaled = (profitUnits * 100000000n) / openingUnits;
    const negative = scaled < 0n;
    const absolute = negative ? -scaled : scaled;
    const whole = absolute / 1000000n;
    const fraction = (absolute % 1000000n).toString().padStart(6, "0");
    return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}
/**
 * Compute one period of simple-interest daily earnings.
 *
 * `accrued` is the earnings already carried on the position (the sum of prior
 * periods' profit) so the opening value reflects the true running value while
 * the new earnings are always `rate × principal`, i.e. they never compound.
 */
function buildDailyEarningsAccrual(input) {
    const profitLoss = (0, money_1.percentOf)(input.principal, input.dailyRatePercent, exports.PERFORMANCE_AMOUNT_SCALE, exports.PERFORMANCE_PERCENT_SCALE);
    const openingUnits = (0, money_1.parseDecimal)(input.principal, exports.PERFORMANCE_AMOUNT_SCALE) +
        (0, money_1.parseDecimal)(input.accrued, exports.PERFORMANCE_AMOUNT_SCALE);
    const profitUnits = (0, money_1.parseDecimal)(profitLoss, exports.PERFORMANCE_AMOUNT_SCALE);
    const closingUnits = openingUnits + profitUnits;
    return {
        openingValue: (0, money_1.formatDecimal)(openingUnits, exports.PERFORMANCE_AMOUNT_SCALE),
        profitLoss: (0, money_1.formatDecimal)(profitUnits, exports.PERFORMANCE_AMOUNT_SCALE),
        closingValue: (0, money_1.formatDecimal)(closingUnits, exports.PERFORMANCE_AMOUNT_SCALE),
        roiPercent: percentFromUnits(profitUnits, openingUnits)
    };
}
/** A stable, deterministic per-position/per-day accrual key. */
function earningsAccrualKey(positionId, snapshotDate) {
    return `${positionId}:${snapshotDate}`;
}
// ---------------------------------------------------------------------------
// Daily performance band
//
// The scheduled plan models a modest, mostly-positive daily return: most days
// land inside the 3%–6% band, and a genuine loss day (-2%) is rare. The rate for
// a given position on a given day is derived deterministically from the position
// id and the snapshot date, so a re-run, a backfill or a concurrent tick can
// never change a day that has already been recorded. The rate is simple interest
// on principal (see `buildDailyEarningsAccrual`), never compounding.
// ---------------------------------------------------------------------------
/** Lower bound of the positive daily band. */
exports.EARNINGS_DAILY_MIN_RATE_PERCENT = "3.000000";
/** Upper bound of the positive daily band (exclusive). */
exports.EARNINGS_DAILY_MAX_RATE_PERCENT = "6.000000";
/** The rare genuine loss day. */
exports.EARNINGS_DAILY_LOSS_RATE_PERCENT = "-2.000000";
// The band is split into 10,000,000 deterministic buckets: the first
// LOSS_BUCKETS model a loss day and the remainder spread evenly across the
// positive band, so ~2.5% of position-days are losses and the rest are gains.
const RATE_BUCKETS = 10000000n;
const RATE_LOSS_BUCKETS = 250000n;
const MIN_RATE_UNITS = 3000000n; // 3.000000 at the 6-decimal percent scale
const MAX_RATE_UNITS = 6000000n; // 6.000000 at the 6-decimal percent scale
// FNV-1a (32-bit) folded into the bucket range. The result depends only on the
// seed string, so the same position and date always produce the same bucket.
function rateBucket(seed) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < seed.length; index += 1) {
        hash ^= seed.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return (BigInt(hash) * RATE_BUCKETS) / 4294967296n;
}
/**
 * The deterministic daily rate for one position on one day: usually inside the
 * 3%–6% positive band, occasionally a rare -2% loss day. Because the rate is a
 * pure function of the position id and the snapshot date, re-running or
 * backfilling a day reproduces exactly the same rate and never rewrites history.
 */
function deterministicDailyRatePercent(positionId, snapshotDate) {
    const bucket = rateBucket(earningsAccrualKey(positionId, snapshotDate));
    if (bucket < RATE_LOSS_BUCKETS) {
        return (0, money_1.formatDecimal)(-2000000n, exports.PERFORMANCE_PERCENT_SCALE);
    }
    const positiveBuckets = RATE_BUCKETS - RATE_LOSS_BUCKETS;
    const offset = ((bucket - RATE_LOSS_BUCKETS) * (MAX_RATE_UNITS - MIN_RATE_UNITS)) / positiveBuckets;
    return (0, money_1.formatDecimal)(MIN_RATE_UNITS + offset, exports.PERFORMANCE_PERCENT_SCALE);
}
/** Human-readable description of the daily performance band, for logs and copy. */
function describeDailyRateBand() {
    return `${exports.EARNINGS_DAILY_MIN_RATE_PERCENT}%-${exports.EARNINGS_DAILY_MAX_RATE_PERCENT}% (rare ${exports.EARNINGS_DAILY_LOSS_RATE_PERCENT}%)`;
}
