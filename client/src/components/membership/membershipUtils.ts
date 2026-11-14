import type { BenefitState, TierEligibility } from "../../hooks/useMembershipData";
import type { Tone } from "../dashboard/primitives";

export const GOLD = "#C6A15B";

export function tierAccent(theme: { accent?: string } | undefined): string {
  const accent = theme?.accent;
  return typeof accent === "string" && accent.length > 0 ? accent : GOLD;
}

export function eligibilityTone(state: TierEligibility): Tone {
  if (state === "current") return "gold";
  if (state === "achieved") return "positive";
  return "neutral";
}

export function eligibilityLabel(state: TierEligibility): string {
  if (state === "current") return "Current tier";
  if (state === "achieved") return "Achieved";
  return "Locked";
}

export interface BenefitStateMeta {
  tone: Tone;
  label: string;
}

export function benefitStateMeta(state: BenefitState): BenefitStateMeta {
  switch (state) {
    case "active":
      return { tone: "positive", label: "Active" };
    case "requires_activation":
      return { tone: "gold", label: "Activation available" };
    case "unavailable":
      return { tone: "neutral", label: "Not currently provided" };
    default:
      return { tone: "neutral", label: "Locked" };
  }
}

export function rangeLabel(minAmount: string, maxAmount: string | null): string {
  return maxAmount ? `$${minAmount} – $${maxAmount}` : `$${minAmount}+`;
}
