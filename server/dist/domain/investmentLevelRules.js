"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLevelRanges = validateLevelRanges;
exports.qualifyLevel = qualifyLevel;
exports.nextLevelAfter = nextLevelAfter;
exports.shouldUpgradeLevel = shouldUpgradeLevel;
exports.isLevelDowngrade = isLevelDowngrade;
exports.resolveEffectiveLevel = resolveEffectiveLevel;
exports.resolveInvestmentBenefitState = resolveInvestmentBenefitState;
exports.isApproachingNextLevel = isApproachingNextLevel;
exports.levelProgress = levelProgress;
exports.levelJourneyState = levelJourneyState;
function activeByLevelNumber(levels) {
    return levels
        .filter((level) => level.active)
        .slice()
        .sort((a, b) => a.levelNumber - b.levelNumber);
}
function validateLevelRanges(levels) {
    const active = activeByLevelNumber(levels);
    const seen = new Set();
    let previous = null;
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
function qualifyLevel(amountCents, levels) {
    let match = null;
    for (const level of activeByLevelNumber(levels)) {
        if (amountCents >= level.thresholdCents) {
            match = level;
        }
    }
    return match;
}
function nextLevelAfter(currentNumber, levels) {
    const active = activeByLevelNumber(levels);
    if (currentNumber === null) {
        return active[0] ?? null;
    }
    return active.find((level) => level.levelNumber > currentNumber) ?? null;
}
function shouldUpgradeLevel(currentNumber, candidateNumber) {
    if (candidateNumber === null) {
        return false;
    }
    if (currentNumber === null) {
        return true;
    }
    return candidateNumber > currentNumber;
}
function isLevelDowngrade(currentNumber, candidateNumber) {
    if (candidateNumber === null || currentNumber === null) {
        return false;
    }
    return candidateNumber < currentNumber;
}
function resolveEffectiveLevel(derived, manual) {
    return manual ?? derived;
}
function resolveInvestmentBenefitState(userLevelNumber, benefit) {
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
function isApproachingNextLevel(amountCents, nextThresholdCents) {
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
function levelProgress(amountCents, currentThresholdCents, nextThresholdCents) {
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
function levelJourneyState(currentNumber, nextNumber, candidateNumber) {
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
