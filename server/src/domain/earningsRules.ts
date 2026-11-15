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
