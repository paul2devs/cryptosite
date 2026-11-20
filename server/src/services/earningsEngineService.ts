import { Op } from "sequelize";
import {
  EARNINGS_ACCRUAL_SOURCE,
  buildDailyEarningsAccrual,
  dailyEarningsRatePercent,
  dayKey,
  isPerformanceDayEligible
} from "../domain/earningsRules";
import { formatDecimal, parseDecimal } from "../domain/money";
import { DailyPerformanceSnapshot } from "../models/DailyPerformanceSnapshot";
import { Deposit } from "../models/Deposit";
import { EarningsLog, EarningsTickType } from "../models/EarningsLog";
import { InvestmentPosition } from "../models/InvestmentPosition";
import { PerformanceCalculationLog } from "../models/PerformanceCalculationLog";
import { getPerformanceSettings } from "./platformSettingsService";

const AMOUNT_SCALE = 8;

// How many missed days a single run will reconcile. Bounded so a long outage
// cannot flood a position with a large retroactive accrual; every backfilled
// day is still checked for eligibility and for an existing payout first.
const DEFAULT_BACKFILL_MAX_DAYS = 30;

function backfillMaxDays(): number {
  const raw = Number(process.env.EARNINGS_BACKFILL_MAX_DAYS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_BACKFILL_MAX_DAYS;
}

function nextDayKey(dayKeyValue: string): string {
  const date = new Date(`${dayKeyValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// The administrator-configured daily rate (platform settings) is authoritative:
// editing it in the admin console changes what the earnings engine applies. The
// EARNINGS_DAILY_RATE_PERCENT environment variable is only used as a fallback
// when no operator setting has been stored yet.
function resolveEarningsRate(configured: string | null): string {
  if (typeof configured === "string" && configured.trim().length > 0) {
    return dailyEarningsRatePercent(configured);
  }
  const envValue = process.env.EARNINGS_DAILY_RATE_PERCENT;
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return dailyEarningsRatePercent(envValue);
  }
  return dailyEarningsRatePercent(null);
}

/**
 * Map of deposit id -> the moment the deposit was confirmed. Daily earnings may
 * only begin the day *after* a deposit is confirmed, so the confirmation time
 * is the eligibility anchor for the linked position.
 */
async function confirmedAtByDeposit(depositIds: string[]): Promise<Map<string, Date | null>> {
  if (depositIds.length === 0) return new Map();
  const deposits = await Deposit.findAll({
    where: { deposit_id: { [Op.in]: depositIds } },
    attributes: ["deposit_id", "confirmed_at", "approved_at", "verified_at", "timestamp"]
  });
  return new Map(
    deposits.map((deposit) => [
      deposit.deposit_id,
      deposit.confirmed_at ??
        deposit.approved_at ??
        deposit.verified_at ??
        deposit.timestamp ??
        null
    ])
  );
}

/** Total earnings already accrued on a position across its verified snapshots. */
async function accruedForPosition(positionId: string): Promise<bigint> {
  const rows = await DailyPerformanceSnapshot.findAll({
    where: { position_id: positionId, verification_status: "verified" },
    attributes: ["profit_loss"]
  });
  let total = 0n;
  for (const row of rows) {
    if (row.profit_loss === null) continue;
    total += parseDecimal(String(row.profit_loss), AMOUNT_SCALE);
  }
  return total;
}

async function latestVerifiedDate(positionId: string): Promise<string | null> {
  const latest = await DailyPerformanceSnapshot.findOne({
    where: { position_id: positionId, verification_status: "verified" },
    order: [["snapshot_date", "DESC"]],
    attributes: ["snapshot_date"]
  });
  return latest ? String(latest.snapshot_date).slice(0, 10) : null;
}

export interface EarningsTickSummary {
  tickType: EarningsTickType;
  asOfDate: string;
  ratePercent: string;
  positionsEvaluated: number;
  periodsAccrued: number;
  amountAccrued: string;
  skippedAlreadyAccrued: number;
  skippedIneligible: number;
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
async function accruePositionForDate(
  position: InvestmentPosition,
  snapshotDate: string,
  ratePercent: string,
  confirmedAt: Date | null
): Promise<{ outcome: "accrued" | "already" | "ineligible"; profitLoss: string | null }> {
  if (position.deposit_id && !isPerformanceDayEligible(confirmedAt, snapshotDate)) {
    return { outcome: "ineligible", profitLoss: null };
  }

  const existing = await DailyPerformanceSnapshot.findOne({
    where: { position_id: position.position_id, snapshot_date: snapshotDate, verification_status: "verified" }
  });
  if (existing) {
    return { outcome: "already", profitLoss: null };
  }

  const accrued = await accruedForPosition(position.position_id);
  const principal = formatDecimal(parseDecimal(String(position.principal), AMOUNT_SCALE), AMOUNT_SCALE);
  const accrual = buildDailyEarningsAccrual({
    principal,
    accrued: formatDecimal(accrued, AMOUNT_SCALE),
    dailyRatePercent: ratePercent
  });

  await DailyPerformanceSnapshot.create({
    user_id: position.user_id,
    position_id: position.position_id,
    snapshot_date: snapshotDate,
    opening_valuation: accrual.openingValue,
    closing_valuation: accrual.closingValue,
    cash_flow: "0.00000000",
    profit_loss: accrual.profitLoss,
    roi_percent: accrual.roiPercent,
    strategy: position.strategy,
    data_source: EARNINGS_ACCRUAL_SOURCE,
    verification_status: "verified",
    correction_of: null,
    reason: `Scheduled daily earnings accrual at ${ratePercent}% of eligible principal.`
  });

  position.current_valuation = accrual.closingValue;
  position.verification_status = "verified";
  position.last_calculated_at = new Date();
  await position.save();

  await PerformanceCalculationLog.create({
    position_id: position.position_id,
    snapshot_date: snapshotDate,
    outcome: "verified",
    message: `Daily earnings accrued from ${EARNINGS_ACCRUAL_SOURCE} at ${ratePercent}%.`
  });

  if (position.deposit_id) {
    await EarningsLog.create({
      user_id: position.user_id,
      deposit_id: position.deposit_id,
      earned_amount: Number(accrual.profitLoss),
      tick_type: snapshotDate === dayKey(new Date()) ? "daily" : "hourly"
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
export async function processEarningsTick(
  tickType: EarningsTickType,
  asOf: Date = new Date()
): Promise<EarningsTickSummary> {
  const settings = await getPerformanceSettings();
  const ratePercent = resolveEarningsRate(settings.illustrativeDailyRatePercent);
  const asOfDate = dayKey(asOf);

  const summary: EarningsTickSummary = {
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

  const positions = await InvestmentPosition.findAll({ where: { status: "active" } });
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
        ? nextDayKey(dayKey(confirmedAt))
        : asOfDate;

    // Walk forward from the first unpaid day to the run date (bounded).
    let cursor = firstCandidate;
    let steps = 0;
    while (cursor.localeCompare(asOfDate) <= 0 && steps < maxDays) {
      const result = await accruePositionForDate(position, cursor, ratePercent, confirmedAt);
      if (result.outcome === "accrued") {
        summary.periodsAccrued += 1;
        if (result.profitLoss) {
          amountAccrued += parseDecimal(result.profitLoss, AMOUNT_SCALE);
        }
      } else if (result.outcome === "already") {
        summary.skippedAlreadyAccrued += 1;
      } else {
        summary.skippedIneligible += 1;
      }
      cursor = nextDayKey(cursor);
      steps += 1;
    }
  }

  summary.amountAccrued = formatDecimal(amountAccrued, AMOUNT_SCALE);
  return summary;
}
