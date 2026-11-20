"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEarningsTick = processEarningsTick;
const sequelize_1 = require("sequelize");
const earningsRules_1 = require("../domain/earningsRules");
const money_1 = require("../domain/money");
const DailyPerformanceSnapshot_1 = require("../models/DailyPerformanceSnapshot");
const Deposit_1 = require("../models/Deposit");
const EarningsLog_1 = require("../models/EarningsLog");
const InvestmentPosition_1 = require("../models/InvestmentPosition");
const PerformanceCalculationLog_1 = require("../models/PerformanceCalculationLog");
const platformSettingsService_1 = require("./platformSettingsService");
const AMOUNT_SCALE = 8;
// How many missed days a single run will reconcile. Bounded so a long outage
// cannot flood a position with a large retroactive accrual; every backfilled
// day is still checked for eligibility and for an existing payout first.
const DEFAULT_BACKFILL_MAX_DAYS = 30;
function backfillMaxDays() {
    const raw = Number(process.env.EARNINGS_BACKFILL_MAX_DAYS);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_BACKFILL_MAX_DAYS;
}
function nextDayKey(dayKeyValue) {
    const date = new Date(`${dayKeyValue}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}
// The administrator-configured daily rate (platform settings) is authoritative:
// editing it in the admin console changes what the earnings engine applies. The
// EARNINGS_DAILY_RATE_PERCENT environment variable is only used as a fallback
// when no operator setting has been stored yet.
function resolveEarningsRate(configured) {
    if (typeof configured === "string" && configured.trim().length > 0) {
        return (0, earningsRules_1.dailyEarningsRatePercent)(configured);
    }
    const envValue = process.env.EARNINGS_DAILY_RATE_PERCENT;
    if (typeof envValue === "string" && envValue.trim().length > 0) {
        return (0, earningsRules_1.dailyEarningsRatePercent)(envValue);
    }
    return (0, earningsRules_1.dailyEarningsRatePercent)(null);
}
/**
 * Map of deposit id -> the moment the deposit was confirmed. Daily earnings may
 * only begin the day *after* a deposit is confirmed, so the confirmation time
 * is the eligibility anchor for the linked position.
 */
async function confirmedAtByDeposit(depositIds) {
    if (depositIds.length === 0)
        return new Map();
    const deposits = await Deposit_1.Deposit.findAll({
        where: { deposit_id: { [sequelize_1.Op.in]: depositIds } },
        attributes: ["deposit_id", "confirmed_at", "approved_at", "verified_at", "timestamp"]
    });
    return new Map(deposits.map((deposit) => [
        deposit.deposit_id,
        deposit.confirmed_at ??
            deposit.approved_at ??
            deposit.verified_at ??
            deposit.timestamp ??
            null
    ]));
}
/** Total earnings already accrued on a position across its verified snapshots. */
async function accruedForPosition(positionId) {
    const rows = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findAll({
        where: { position_id: positionId, verification_status: "verified" },
        attributes: ["profit_loss"]
    });
    let total = 0n;
    for (const row of rows) {
        if (row.profit_loss === null)
            continue;
        total += (0, money_1.parseDecimal)(String(row.profit_loss), AMOUNT_SCALE);
    }
    return total;
}
async function latestVerifiedDate(positionId) {
    const latest = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findOne({
        where: { position_id: positionId, verification_status: "verified" },
        order: [["snapshot_date", "DESC"]],
        attributes: ["snapshot_date"]
    });
    return latest ? String(latest.snapshot_date).slice(0, 10) : null;
}
/**
 * Credit one day of daily investment earnings onto a single position.
 *
 * The write is idempotent: if a verified snapshot already exists for the
 * position/date pair (including a snapshot written by a previous run of this
 * job), nothing is written and no earnings are credited twice. The partial
 * unique index on `daily_performance_snapshots(position_id, snapshot_date)` is
 * the database-level backstop for concurrent runs.
 */
async function accruePositionForDate(position, snapshotDate, ratePercent, confirmedAt) {
    if (position.deposit_id && !(0, earningsRules_1.isPerformanceDayEligible)(confirmedAt, snapshotDate)) {
        return { outcome: "ineligible", profitLoss: null };
    }
    const existing = await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.findOne({
        where: { position_id: position.position_id, snapshot_date: snapshotDate, verification_status: "verified" }
    });
    if (existing) {
        return { outcome: "already", profitLoss: null };
    }
    const accrued = await accruedForPosition(position.position_id);
    const principal = (0, money_1.formatDecimal)((0, money_1.parseDecimal)(String(position.principal), AMOUNT_SCALE), AMOUNT_SCALE);
    const accrual = (0, earningsRules_1.buildDailyEarningsAccrual)({
        principal,
        accrued: (0, money_1.formatDecimal)(accrued, AMOUNT_SCALE),
        dailyRatePercent: ratePercent
    });
    await DailyPerformanceSnapshot_1.DailyPerformanceSnapshot.create({
        user_id: position.user_id,
        position_id: position.position_id,
        snapshot_date: snapshotDate,
        opening_valuation: accrual.openingValue,
        closing_valuation: accrual.closingValue,
        cash_flow: "0.00000000",
        profit_loss: accrual.profitLoss,
        roi_percent: accrual.roiPercent,
        strategy: position.strategy,
        data_source: earningsRules_1.EARNINGS_ACCRUAL_SOURCE,
        verification_status: "verified",
        correction_of: null,
        reason: `Scheduled daily earnings accrual at ${ratePercent}% of eligible principal.`
    });
    position.current_valuation = accrual.closingValue;
    position.verification_status = "verified";
    position.last_calculated_at = new Date();
    await position.save();
    await PerformanceCalculationLog_1.PerformanceCalculationLog.create({
        position_id: position.position_id,
        snapshot_date: snapshotDate,
        outcome: "verified",
        message: `Daily earnings accrued from ${earningsRules_1.EARNINGS_ACCRUAL_SOURCE} at ${ratePercent}%.`
    });
    if (position.deposit_id) {
        await EarningsLog_1.EarningsLog.create({
            user_id: position.user_id,
            deposit_id: position.deposit_id,
            earned_amount: Number(accrual.profitLoss),
            tick_type: snapshotDate === (0, earningsRules_1.dayKey)(new Date()) ? "daily" : "hourly"
        });
    }
    return { outcome: "accrued", profitLoss: accrual.profitLoss };
}
/**
 * Scheduled daily investment earnings job.
 *
 * For every active position whose deposit has been confirmed, it accrues the
 * configured daily rate on the position's principal for each eligible day that
 * has not been paid yet, up to the run date. Because each period is guarded by
 * a per-position/per-day snapshot, an hourly retry, a manual re-run or a
 * concurrent invocation can never credit the same day twice.
 */
async function processEarningsTick(tickType, asOf = new Date()) {
    const settings = await (0, platformSettingsService_1.getPerformanceSettings)();
    const ratePercent = resolveEarningsRate(settings.illustrativeDailyRatePercent);
    const asOfDate = (0, earningsRules_1.dayKey)(asOf);
    const summary = {
        tickType,
        asOfDate,
        ratePercent,
        positionsEvaluated: 0,
        periodsAccrued: 0,
        amountAccrued: "0.00000000",
        skippedAlreadyAccrued: 0,
        skippedIneligible: 0
    };
    if (!settings.automaticDailyCalculation) {
        return summary;
    }
    const positions = await InvestmentPosition_1.InvestmentPosition.findAll({ where: { status: "active" } });
    summary.positionsEvaluated = positions.length;
    const maxDays = backfillMaxDays();
    let amountAccrued = 0n;
    for (const position of positions) {
        const confirmedAt = position.deposit_id
            ? (await confirmedAtByDeposit([position.deposit_id])).get(position.deposit_id) ?? null
            : null;
        const lastDate = await latestVerifiedDate(position.position_id);
        const firstCandidate = lastDate
            ? nextDayKey(lastDate)
            : confirmedAt
                ? nextDayKey((0, earningsRules_1.dayKey)(confirmedAt))
                : asOfDate;
        // Walk forward from the first unpaid day to the run date (bounded).
        let cursor = firstCandidate;
        let steps = 0;
        while (cursor.localeCompare(asOfDate) <= 0 && steps < maxDays) {
            const result = await accruePositionForDate(position, cursor, ratePercent, confirmedAt);
            if (result.outcome === "accrued") {
                summary.periodsAccrued += 1;
                if (result.profitLoss) {
                    amountAccrued += (0, money_1.parseDecimal)(result.profitLoss, AMOUNT_SCALE);
                }
            }
            else if (result.outcome === "already") {
                summary.skippedAlreadyAccrued += 1;
            }
            else {
                summary.skippedIneligible += 1;
            }
            cursor = nextDayKey(cursor);
            steps += 1;
        }
    }
    summary.amountAccrued = (0, money_1.formatDecimal)(amountAccrued, AMOUNT_SCALE);
    return summary;
}
