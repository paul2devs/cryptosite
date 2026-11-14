import type {
  InvestmentBenefitState,
  InvestmentJourneyState
} from "../../hooks/useInvestmentLevelData";
import type { Tone } from "../dashboard/primitives";

export const GOLD = "#C6A15B";

export function levelAccent(theme: { accent?: string } | undefined): string {
  const accent = theme?.accent;
  return typeof accent === "string" && accent.length > 0 ? accent : GOLD;
}

export function journeyTone(state: InvestmentJourneyState): Tone {
  if (state === "current") return "gold";
  if (state === "completed") return "positive";
  return "neutral";
}

export function journeyLabel(state: InvestmentJourneyState): string {
  if (state === "current") return "Current level";
  if (state === "completed") return "Completed";
  if (state === "upcoming") return "Next level";
  return "Locked";
}

export interface BenefitStateMeta {
  tone: Tone;
  label: string;
}

export function benefitStateMeta(state: InvestmentBenefitState): BenefitStateMeta {
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

export function thresholdLabel(threshold: string): string {
  return `$${threshold}`;
}
