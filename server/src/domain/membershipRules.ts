export interface TierRange {
  id: string;
  name: string;
  minCents: bigint;
  maxCents: bigint | null;
  active: boolean;
  sortOrder: number;
}

export function validateTierRanges(tiers: TierRange[]): string | null {
  const active = tiers
    .filter((tier) => tier.active)
    .slice()
    .sort((a, b) => (a.minCents === b.minCents ? a.sortOrder - b.sortOrder : a.minCents < b.minCents ? -1 : 1));
  let openEnded = 0;
  for (let index = 0; index < active.length; index += 1) {
    const tier = active[index];
    if (tier.minCents < 0n) {
      return `${tier.name} cannot have a negative minimum.`;
    }
    if (tier.maxCents !== null && tier.maxCents < tier.minCents) {
      return `${tier.name} maximum is below its minimum.`;
    }
    if (tier.maxCents === null) {
      openEnded += 1;
      if (index !== active.length - 1) {
        return "An open-ended tier must be the highest active tier.";
      }
    }
    if (index > 0) {
      const previous = active[index - 1];
      if (previous.maxCents === null || tier.minCents <= previous.maxCents) {
        return `${tier.name} overlaps ${previous.name}.`;
      }
    }
  }
  if (openEnded > 1) {
    return "Only one open-ended tier is allowed.";
  }
  return null;
}

export function qualifyTier(amountCents: bigint, tiers: TierRange[]): TierRange | null {
  const active = tiers
    .filter((tier) => tier.active)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  let match: TierRange | null = null;
  for (const tier of active) {
    const meetsMin = amountCents >= tier.minCents;
    const meetsMax = tier.maxCents === null || amountCents <= tier.maxCents;
    if (meetsMin && meetsMax && (!match || tier.sortOrder >= match.sortOrder)) {
      match = tier;
    }
  }
  return match;
}

export function shouldUpgrade(currentSort: number | null, nextSort: number | null): boolean {
  if (nextSort === null) {
    return false;
  }
  if (currentSort === null) {
    return true;
  }
  return nextSort > currentSort;
}

export function isTierDowngrade(currentSort: number | null, candidateSort: number | null): boolean {
  if (candidateSort === null) {
    return false;
  }
  if (currentSort === null) {
    return false;
  }
  return candidateSort < currentSort;
}

export interface BenefitEvaluationInput {
  tierSortOrder: number;
  available: boolean;
  requiresActivation: boolean;
  activated: boolean;
}

export type BenefitState = "locked" | "unavailable" | "requires_activation" | "active";

export function resolveBenefitState(
  userTierSortOrder: number | null,
  benefit: BenefitEvaluationInput
): BenefitState {
  if (userTierSortOrder === null || userTierSortOrder < benefit.tierSortOrder) {
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

export function resolveEffectiveTierRange(
  derived: TierRange | null,
  manual: TierRange | null
): TierRange | null {
  if (manual) {
    return manual;
  }
  return derived;
}

export function isApproachingNextTier(
  amountCents: bigint | null,
  nextMinCents: bigint | null
): boolean {
  if (amountCents === null || nextMinCents === null) {
    return false;
  }
  if (amountCents >= nextMinCents) {
    return false;
  }
  const gap = nextMinCents - amountCents;
  const threshold = nextMinCents / 10n;
  return gap > 0n && gap <= threshold;
}

export function tierEligibilityState(
  currentSortOrder: number | null,
  candidateSortOrder: number
): "achieved" | "current" | "locked" {
  if (currentSortOrder === null || candidateSortOrder > currentSortOrder) {
    return "locked";
  }
  if (candidateSortOrder === currentSortOrder) {
    return "current";
  }
  return "achieved";
}
