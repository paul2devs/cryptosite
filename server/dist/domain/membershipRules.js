"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTierRanges = validateTierRanges;
exports.qualifyTier = qualifyTier;
exports.shouldUpgrade = shouldUpgrade;
exports.isTierDowngrade = isTierDowngrade;
exports.resolveBenefitState = resolveBenefitState;
exports.resolveEffectiveTierRange = resolveEffectiveTierRange;
exports.isApproachingNextTier = isApproachingNextTier;
exports.tierEligibilityState = tierEligibilityState;
function validateTierRanges(tiers) {
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
function qualifyTier(amountCents, tiers) {
    const active = tiers
        .filter((tier) => tier.active)
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder);
    let match = null;
    for (const tier of active) {
        const meetsMin = amountCents >= tier.minCents;
        const meetsMax = tier.maxCents === null || amountCents <= tier.maxCents;
        if (meetsMin && meetsMax && (!match || tier.sortOrder >= match.sortOrder)) {
            match = tier;
        }
    }
    return match;
}
function shouldUpgrade(currentSort, nextSort) {
    if (nextSort === null) {
        return false;
    }
    if (currentSort === null) {
        return true;
    }
    return nextSort > currentSort;
}
function isTierDowngrade(currentSort, candidateSort) {
    if (candidateSort === null) {
        return false;
    }
    if (currentSort === null) {
        return false;
    }
    return candidateSort < currentSort;
}
function resolveBenefitState(userTierSortOrder, benefit) {
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
function resolveEffectiveTierRange(derived, manual) {
    if (manual) {
        return manual;
    }
    return derived;
}
function isApproachingNextTier(amountCents, nextMinCents) {
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
function tierEligibilityState(currentSortOrder, candidateSortOrder) {
    if (currentSortOrder === null || candidateSortOrder > currentSortOrder) {
        return "locked";
    }
    if (candidateSortOrder === currentSortOrder) {
        return "current";
    }
    return "achieved";
}
