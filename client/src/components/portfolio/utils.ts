import type { Tone } from "../dashboard/primitives";

export const MASKED_VALUE = "••••••";

export function maskValue(hidden: boolean, value: string): string {
  return hidden ? MASKED_VALUE : value;
}

export function toneFromValue(value: number | null | undefined): Tone {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) {
    return "neutral";
  }
  return value > 0 ? "positive" : "negative";
}
