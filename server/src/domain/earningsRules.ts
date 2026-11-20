import { formatDecimal, parseDecimal, percentOf } from "./money";

export const PROJECTED_RETURN_DISCLAIMER =
  "Projected figures apply a modelled daily rate to invested principal. They are not a guarantee and are not credited. Only verified valuations recorded against real positions produce reportable performance.";

export const PERFORMANCE_AMOUNT_SCALE = 8;
export const PERFORMANCE_PERCENT_SCALE = 6;

export function dayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// Daily performance may only begin on the day after an independently verified
// deposit is confirmed. A position is not eligible for its own confirmation day.
export function isPerformanceDayEligible(
  confirmedAt: string | Date | null | undefined,
  snapshotDate: string
): boolean {
  if (!confirmedAt) return false;
  const confirmedKey = dayKey(confirmedAt);
  if (!confirmedKey) return false;
  return snapshotDate.localeCompare(confirmedKey) > 0;
}

export function isFutureSnapshot(snapshotDate: string, now: Date = new Date()): boolean {
  return snapshotDate.localeCompare(dayKey(now)) > 0;
}

export function absAmount(value: string): string {
  const units = parseDecimal(value, PERFORMANCE_AMOUNT_SCALE);
  return formatDecimal(units < 0n ? -units : units, PERFORMANCE_AMOUNT_SCALE);
}

export function earningsDirection(profitLoss: string | null): "gain" | "loss" | "flat" | "unavailable" {
  if (profitLoss === null) return "unavailable";
  const units = parseDecimal(profitLoss, PERFORMANCE_AMOUNT_SCALE);
  if (units > 0n) return "gain";
  if (units < 0n) return "loss";
  return "flat";
}

export function describeDailyEarnings(input: {
  snapshotDate: string;
  asset: string;
  profitLoss: string | null;
  roiPercent: string | null;
  source: string | null;
  reference: string;
}): string {
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

export function describeRealisedEarnings(input: {
  asset: string;
  amount: string;
  reference: string;
  reason: string;
}): string {
  return `Realised earnings of ${formatDecimal(
    parseDecimal(input.amount, PERFORMANCE_AMOUNT_SCALE),
    PERFORMANCE_AMOUNT_SCALE
  )} ${input.asset} credited to your withdrawable balance. Source: realised investment performance. Reference ${input.reference}. ${input.reason}`;
}

export function projectedDailyEarnings(principal: string, dailyRatePercent: string): string {
  return percentOf(principal, dailyRatePercent, PERFORMANCE_AMOUNT_SCALE, PERFORMANCE_PERCENT_SCALE);
}

export function projectedEarningsSeries(
  principal: string,
  dailyRatePercent: string,
  days: number
): string {
  if (days <= 0) return "0.00000000";
  const total = parseDecimal(
    percentOf(principal, dailyRatePercent, PERFORMANCE_AMOUNT_SCALE, PERFORMANCE_PERCENT_SCALE),
    PERFORMANCE_AMOUNT_SCALE
  );
  return formatDecimal(total * BigInt(days), PERFORMANCE_AMOUNT_SCALE);
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

export const DEFAULT_DAILY_EARNINGS_RATE_PERCENT = "3.000000";

/** Default length, in days, of a projected investment period. */
export const DEFAULT_EARNINGS_PERIOD_DAYS = 30;

/**
 * Normalise a configured period length to a whole number of days, defaulting to
 * the platform period when the value is absent or malformed.
 */
export function earningsPeriodDays(configured?: number | string | null): number {
  const parsed = typeof configured === "number" ? configured : Number(configured);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_EARNINGS_PERIOD_DAYS;
  return Math.trunc(parsed);
}

/**
 * The projected return for a whole period, using the same simple-interest model
 * as the daily plan: `period ROI = daily rate × period days`. It is a modelled
 * projection only, never a credited or guaranteed figure.
 */
export function periodRoiPercent(dailyRatePercent: string, days: number): string {
  const rate = dailyEarningsRatePercent(dailyRatePercent);
  const rateUnits = parseDecimal(rate, PERFORMANCE_PERCENT_SCALE);
  return formatDecimal(rateUnits * BigInt(earningsPeriodDays(days)), PERFORMANCE_PERCENT_SCALE);
}

/** Marks daily snapshots produced by the scheduled earnings plan. */
export const EARNINGS_ACCRUAL_SOURCE = "scheduled_earnings_plan";

/**
 * Normalise a configured daily rate to the 6-decimal percent scale used by the
 * money helpers, falling back to the platform default when the value is absent
 * or malformed. A configured value can never silently disable the plan.
 */
export function dailyEarningsRatePercent(configured?: string | null): string {
  if (typeof configured === "string") {
    const trimmed = configured.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const [whole, fraction = ""] = trimmed.split(".");
      const normalised = `${whole}.${(fraction + "000000").slice(0, PERFORMANCE_PERCENT_SCALE)}`;
      if (parseDecimal(normalised, PERFORMANCE_PERCENT_SCALE) > 0n) {
        return normalised;
      }
    }
  }
  return DEFAULT_DAILY_EARNINGS_RATE_PERCENT;
}

export interface DailyEarningsAccrual {
  /** Running position value carried into the period. */
  openingValue: string;
  /** Earnings accrued for this period alone. */
  profitLoss: string;
  /** Running position value after this period's earnings. */
  closingValue: string;
  /** This period's earnings as a percentage of the opening value. */
  roiPercent: string | null;
}

function percentFromUnits(profitUnits: bigint, openingUnits: bigint): string | null {
  if (openingUnits === 0n) return null;
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
export function buildDailyEarningsAccrual(input: {
  principal: string;
  accrued: string;
  dailyRatePercent: string;
}): DailyEarningsAccrual {
  const profitLoss = percentOf(
    input.principal,
    input.dailyRatePercent,
    PERFORMANCE_AMOUNT_SCALE,
    PERFORMANCE_PERCENT_SCALE
  );
  const openingUnits =
    parseDecimal(input.principal, PERFORMANCE_AMOUNT_SCALE) +
    parseDecimal(input.accrued, PERFORMANCE_AMOUNT_SCALE);
  const profitUnits = parseDecimal(profitLoss, PERFORMANCE_AMOUNT_SCALE);
  const closingUnits = openingUnits + profitUnits;
  return {
    openingValue: formatDecimal(openingUnits, PERFORMANCE_AMOUNT_SCALE),
    profitLoss: formatDecimal(profitUnits, PERFORMANCE_AMOUNT_SCALE),
    closingValue: formatDecimal(closingUnits, PERFORMANCE_AMOUNT_SCALE),
    roiPercent: percentFromUnits(profitUnits, openingUnits)
  };
}

/** A stable, deterministic per-position/per-day accrual key. */
export function earningsAccrualKey(positionId: string, snapshotDate: string): string {
  return `${positionId}:${snapshotDate}`;
}
