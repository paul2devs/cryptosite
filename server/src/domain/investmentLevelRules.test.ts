import assert from "assert";
import { test } from "node:test";
import {
  isApproachingNextLevel,
  isLevelDowngrade,
  levelJourneyState,
  levelProgress,
  nextLevelAfter,
  qualifyLevel,
  resolveEffectiveLevel,
  resolveInvestmentBenefitState,
  shouldUpgradeLevel,
  validateLevelRanges,
  InvestmentLevelRange
} from "./investmentLevelRules";

const levels: InvestmentLevelRange[] = [
  { id: "l1", levelNumber: 1, thresholdCents: 100000n, active: true, sortOrder: 1 },
  { id: "l2", levelNumber: 2, thresholdCents: 300000n, active: true, sortOrder: 2 },
  { id: "l3", levelNumber: 3, thresholdCents: 500000n, active: true, sortOrder: 3 },
  { id: "l4", levelNumber: 4, thresholdCents: 700000n, active: false, sortOrder: 4 },
  { id: "l5", levelNumber: 5, thresholdCents: 1000000n, active: true, sortOrder: 5 }
];

test("a new user with no qualifying investment has no investment level", () => {
  assert.equal(qualifyLevel(0n, levels), null);
  assert.equal(qualifyLevel(99999n, levels), null);
});

test("qualifies level 1 only once the threshold is reached", () => {
  assert.equal(qualifyLevel(100000n, levels)?.levelNumber, 1);
  assert.equal(qualifyLevel(150000n, levels)?.levelNumber, 1);
});

test("qualifies the exact threshold and the level just above", () => {
  assert.equal(qualifyLevel(300000n, levels)?.levelNumber, 2);
  assert.equal(qualifyLevel(300001n, levels)?.levelNumber, 2);
  assert.equal(qualifyLevel(499999n, levels)?.levelNumber, 2);
  assert.equal(qualifyLevel(500000n, levels)?.levelNumber, 3);
});

test("skips inactive levels without breaking qualification", () => {
  assert.equal(qualifyLevel(800000n, levels)?.levelNumber, 3);
  assert.equal(qualifyLevel(1000000n, levels)?.levelNumber, 5);
});

test("rejects overlapping, duplicated, and out-of-order level thresholds", () => {
  assert.equal(
    validateLevelRanges([levels[0], { ...levels[1], thresholdCents: 100000n }]),
    "Level 2 must require a higher qualifying amount than level 1."
  );
  assert.equal(validateLevelRanges(levels), null);
  assert.ok(validateLevelRanges([levels[0], { ...levels[1], levelNumber: 1 }]));
});

test("upgrades only to a higher level number and never downward", () => {
  assert.equal(shouldUpgradeLevel(1, 2), true);
  assert.equal(shouldUpgradeLevel(2, 2), false);
  assert.equal(shouldUpgradeLevel(2, 1), false);
  assert.equal(shouldUpgradeLevel(null, 1), true);
  assert.equal(shouldUpgradeLevel(2, null), false);
  assert.equal(isLevelDowngrade(2, 1), true);
  assert.equal(isLevelDowngrade(1, 2), false);
});

test("next level after the current one ignores inactive levels", () => {
  assert.equal(nextLevelAfter(3, levels)?.levelNumber, 5);
  assert.equal(nextLevelAfter(5, levels), null);
  assert.equal(nextLevelAfter(null, levels)?.levelNumber, 1);
});

test("manual administration takes precedence over the derived level", () => {
  assert.equal(resolveEffectiveLevel(levels[0], levels[2])?.id, "l3");
  assert.equal(resolveEffectiveLevel(levels[0], null)?.id, "l1");
  assert.equal(resolveEffectiveLevel(null, null), null);
});

test("resolves benefit state from level eligibility, availability, and activation", () => {
  const base = { levelNumber: 2, available: true, requiresActivation: false, activated: false };
  assert.equal(resolveInvestmentBenefitState(1, base), "locked");
  assert.equal(resolveInvestmentBenefitState(null, base), "locked");
  assert.equal(resolveInvestmentBenefitState(2, base), "active");
  assert.equal(resolveInvestmentBenefitState(3, { ...base, available: false }), "unavailable");
  assert.equal(
    resolveInvestmentBenefitState(2, { ...base, requiresActivation: true }),
    "requires_activation"
  );
  assert.equal(
    resolveInvestmentBenefitState(2, { ...base, requiresActivation: true, activated: true }),
    "active"
  );
});

test("flags users within ten percent of the next level threshold as approaching", () => {
  assert.equal(isApproachingNextLevel(450000n, 500000n), true);
  assert.equal(isApproachingNextLevel(440000n, 500000n), false);
  assert.equal(isApproachingNextLevel(500000n, 500000n), false);
  assert.equal(isApproachingNextLevel(null, 500000n), false);
  assert.equal(isApproachingNextLevel(450000n, null), false);
});

test("computes progress between the current and next thresholds", () => {
  assert.equal(levelProgress(150000n, 100000n, 300000n), 25);
  assert.equal(levelProgress(50000n, 100000n, 300000n), 0);
  assert.equal(levelProgress(300000n, 100000n, 300000n), 100);
  assert.equal(levelProgress(500000n, 100000n, null), 100);
  assert.equal(levelProgress(100n, 100000n, null), 0);
});

test("labels the level journey as completed, current, upcoming, or locked", () => {
  assert.equal(levelJourneyState(3, 5, 1), "completed");
  assert.equal(levelJourneyState(3, 5, 3), "current");
  assert.equal(levelJourneyState(3, 5, 5), "upcoming");
  assert.equal(levelJourneyState(3, 5, 4), "locked");
  assert.equal(levelJourneyState(null, 1, 1), "upcoming");
  assert.equal(levelJourneyState(null, 1, 2), "locked");
});
