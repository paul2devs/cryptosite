import type { Tone } from "../dashboard/primitives";

export const MASKED_VALUE = "••••••";

export function maskValue(hidden: boolean, value: string): string {
  return hidden ? MASKED_VALUE : value;
}

/**
 * Money is only ever presented at cent precision, so a value that rounds to
 * $0.00 is not a real balance. The locked/wallet columns are stored as floats
 * and can hold a sub-cent legacy residual (e.g. 7.75e-7) that must never be
 * surfaced as a "$0.00 locked" line.
 */
export const MATERIAL_AMOUNT_THRESHOLD = 0.005;

export function isMaterialAmount(value: number | null | undefined): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MATERIAL_AMOUNT_THRESHOLD
  );
}

export function toneFromValue(value: number | null | undefined): Tone {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return "neutral";
  }
  return value > 0 ? "positive" : "negative";
}
