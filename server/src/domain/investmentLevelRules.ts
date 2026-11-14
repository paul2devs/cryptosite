export interface InvestmentLevelRange {
  id: string;
  levelNumber: number;
  thresholdCents: bigint;
  active: boolean;
  sortOrder: number;
}

export type InvestmentBenefitState = "locked" | "unavailable" | "requires_activation" | "active";

export type InvestmentJourneyState = "completed" | "current" | "upcoming" | "locked";

function activeByLevelNumber(levels: InvestmentLevelRange[]): InvestmentLevelRange[] {
  return levels
    .filter((level) => level.active)
    .slice()
    .sort((a, b) => a.levelNumber - b.levelNumber);
}

export function validateLevelRanges(levels: InvestmentLevelRange[]): string | null {
  const active = activeByLevelNumber(levels);
  const seen = new Set<number>();
  let previous: InvestmentLevelRange | null = null;
  for (const level of active) {
    if (seen.has(level.levelNumber)) {
      return `Level ${level.levelNumber} is configured more than once.`;
    }
    seen.add(level.levelNumber);
    if (level.thresholdCents < 0n) {
      return `Level ${level.levelNumber} cannot have a negative qualification threshold.`;
    }
    if (previous && level.thresholdCents <= previous.thresholdCents) {
      return `Level ${level.levelNumber} must require a higher qualifying amount than level ${previous.levelNumber}.`;
    }
    previous = level;
  }
  return null;
}

export function qualifyLevel(
  amountCents: bigint,
  levels: InvestmentLevelRange[]
): InvestmentLevelRange | null {
  let match: InvestmentLevelRange | null = null;
  for (const level of activeByLevelNumber(levels)) {
    if (amountCents >= level.thresholdCents) {
      match = level;
    }
  }
  return match;
}

export function nextLevelAfter(
  currentNumber: number | null,
  levels: InvestmentLevelRange[]
): InvestmentLevelRange | null {
  const active = activeByLevelNumber(levels);
  if (currentNumber === null) {
    return active[0] ?? null;
  }
  return active.find((level) => level.levelNumber > currentNumber) ?? null;
}

export function shouldUpgradeLevel(
  currentNumber: number | null,
  candidateNumber: number | null
): boolean {
  if (candidateNumber === null) {
    return false;
  }
  if (currentNumber === null) {
    return true;
  }
  return candidateNumber > currentNumber;
}

export function isLevelDowngrade(
  currentNumber: number | null,
  candidateNumber: number | null
): boolean {
  if (candidateNumber === null || currentNumber === null) {
    return false;
  }
  return candidateNumber < currentNumber;
}

export function resolveEffectiveLevel(
  derived: InvestmentLevelRange | null,
  manual: InvestmentLevelRange | null
): InvestmentLevelRange | null {
  return manual ?? derived;
}

export interface InvestmentBenefitEvaluationInput {
  levelNumber: number;
  available: boolean;
  requiresActivation: boolean;
  activated: boolean;
}

export function resolveInvestmentBenefitState(
  userLevelNumber: number | null,
  benefit: InvestmentBenefitEvaluationInput
): InvestmentBenefitState {
  if (userLevelNumber === null || userLevelNumber < benefit.levelNumber) {
    return "locked";
  }
  if (!benefit.available) {
    return "unavailable";
  }
  if (benefit.activated) {
    return "active";
  }
  if (benefit.requiresActivation) {
    return "requires_activation";
  }
  return "active";
}

export function isApproachingNextLevel(
  amountCents: bigint | null,
  nextThresholdCents: bigint | null
): boolean {
  if (amountCents === null || nextThresholdCents === null) {
    return false;
  }
  if (amountCents >= nextThresholdCents) {
    return false;
  }
  const gap = nextThresholdCents - amountCents;
  const window = nextThresholdCents / 10n;
  return gap > 0n && gap <= window;
}

export function levelProgress(
  amountCents: bigint | null,
  currentThresholdCents: bigint,
  nextThresholdCents: bigint | null
): number {
  if (amountCents === null) {
    return 0;
  }
  if (nextThresholdCents === null) {
    return amountCents >= currentThresholdCents ? 100 : 0;
  }
  const span = nextThresholdCents - currentThresholdCents;
  if (span <= 0n) {
    return 100;
  }
  const done = amountCents - currentThresholdCents;
  if (done <= 0n) {
    return 0;
  }
  if (done >= span) {
    return 100;
  }
  return Number((done * 10000n) / span) / 100;
}

export function levelJourneyState(
  currentNumber: number | null,
  nextNumber: number | null,
  candidateNumber: number
): InvestmentJourneyState {
  if (currentNumber === null) {
    return nextNumber !== null && candidateNumber === nextNumber ? "upcoming" : "locked";
  }
  if (candidateNumber < currentNumber) {
    return "completed";
  }
  if (candidateNumber === currentNumber) {
    return "current";
  }
  if (nextNumber !== null && candidateNumber === nextNumber) {
    return "upcoming";
  }
  return "locked";
}
