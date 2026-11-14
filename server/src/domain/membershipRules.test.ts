import assert from "assert";
import { test } from "node:test";
import {
  isApproachingNextTier,
  isTierDowngrade,
  qualifyTier,
  resolveBenefitState,
  resolveEffectiveTierRange,
  shouldUpgrade,
  tierEligibilityState,
  validateTierRanges,
  TierRange
} from "./membershipRules";

const tiers: TierRange[] = [
  { id: "bronze", name: "Bronze", minCents: 10000n, maxCents: 99999n, active: true, sortOrder: 1 },
  { id: "silver", name: "Silver", minCents: 100000n, maxCents: 499999n, active: true, sortOrder: 2 },
  { id: "private", name: "Private Client", minCents: 10000000n, maxCents: null, active: true, sortOrder: 6 }
];

test("qualifies bronze from confirmed amount and ignores amounts below the minimum", () => {
  assert.equal(qualifyTier(25000n, tiers)?.id, "bronze");
  assert.equal(qualifyTier(9999n, tiers), null);
});

test("qualifies an exact upper boundary into the owning tier and the next minimum into the next tier", () => {
  assert.equal(qualifyTier(99999n, tiers)?.id, "bronze");
  assert.equal(qualifyTier(100000n, tiers)?.id, "silver");
  assert.equal(qualifyTier(10000000n, tiers)?.id, "private");
});

test("does not upgrade downward and upgrades only to a higher sort order", () => {
  assert.equal(shouldUpgrade(2, 1), false);
  assert.equal(shouldUpgrade(1, 2), true);
  assert.equal(shouldUpgrade(null, 1), true);
  assert.equal(shouldUpgrade(2, null), false);
});

test("never treats a lower tier as an upgrade so downgrades are not applied automatically", () => {
  assert.equal(isTierDowngrade(3, 2), true);
  assert.equal(isTierDowngrade(2, 3), false);
  assert.equal(isTierDowngrade(null, 2), false);
  assert.equal(shouldUpgrade(3, 2), false);
});

test("rejects overlapping tier ranges", () => {
  const invalid = validateTierRanges([
    tiers[0],
    { ...tiers[1], minCents: 90000n }
  ]);
  assert.ok(invalid);
  assert.equal(validateTierRanges(tiers), null);
});

test("rejects an open-ended tier that is not the highest active tier", () => {
  const invalid = validateTierRanges([
    { ...tiers[0], maxCents: null },
    tiers[1]
  ]);
  assert.ok(invalid);
});

test("manual membership override takes precedence over the derived tier", () => {
  assert.equal(resolveEffectiveTierRange(tiers[0], tiers[1])?.id, "silver");
  assert.equal(resolveEffectiveTierRange(tiers[0], null)?.id, "bronze");
  assert.equal(resolveEffectiveTierRange(null, null), null);
});

test("resolves benefit state from tier eligibility, availability, and activation", () => {
  const base = { tierSortOrder: 2, available: true, requiresActivation: false, activated: false };
  assert.equal(resolveBenefitState(1, base), "locked");
  assert.equal(resolveBenefitState(null, base), "locked");
  assert.equal(resolveBenefitState(2, base), "active");
  assert.equal(resolveBenefitState(3, { ...base, available: false }), "unavailable");
  assert.equal(resolveBenefitState(2, { ...base, requiresActivation: true }), "requires_activation");
  assert.equal(
    resolveBenefitState(2, { ...base, requiresActivation: true, activated: true }),
    "active"
  );
});

test("flags users within ten percent of the next tier threshold as approaching", () => {
  assert.equal(isApproachingNextTier(4500n, 5000n), true);
  assert.equal(isApproachingNextTier(4400n, 5000n), false);
  assert.equal(isApproachingNextTier(5000n, 5000n), false);
  assert.equal(isApproachingNextTier(null, 5000n), false);
  assert.equal(isApproachingNextTier(4500n, null), false);
});

test("labels tier progression as achieved, current, or locked", () => {
  assert.equal(tierEligibilityState(2, 1), "achieved");
  assert.equal(tierEligibilityState(2, 2), "current");
  assert.equal(tierEligibilityState(2, 3), "locked");
  assert.equal(tierEligibilityState(null, 1), "locked");
});
