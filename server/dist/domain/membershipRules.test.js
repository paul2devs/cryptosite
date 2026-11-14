"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const membershipRules_1 = require("./membershipRules");
const tiers = [
    { id: "bronze", name: "Bronze", minCents: 10000n, maxCents: 99999n, active: true, sortOrder: 1 },
    { id: "silver", name: "Silver", minCents: 100000n, maxCents: 499999n, active: true, sortOrder: 2 },
    { id: "private", name: "Private Client", minCents: 10000000n, maxCents: null, active: true, sortOrder: 6 }
];
(0, node_test_1.test)("qualifies bronze from confirmed amount and ignores amounts below the minimum", () => {
    assert_1.default.equal((0, membershipRules_1.qualifyTier)(25000n, tiers)?.id, "bronze");
    assert_1.default.equal((0, membershipRules_1.qualifyTier)(9999n, tiers), null);
});
(0, node_test_1.test)("qualifies an exact upper boundary into the owning tier and the next minimum into the next tier", () => {
    assert_1.default.equal((0, membershipRules_1.qualifyTier)(99999n, tiers)?.id, "bronze");
    assert_1.default.equal((0, membershipRules_1.qualifyTier)(100000n, tiers)?.id, "silver");
    assert_1.default.equal((0, membershipRules_1.qualifyTier)(10000000n, tiers)?.id, "private");
});
(0, node_test_1.test)("does not upgrade downward and upgrades only to a higher sort order", () => {
    assert_1.default.equal((0, membershipRules_1.shouldUpgrade)(2, 1), false);
    assert_1.default.equal((0, membershipRules_1.shouldUpgrade)(1, 2), true);
    assert_1.default.equal((0, membershipRules_1.shouldUpgrade)(null, 1), true);
    assert_1.default.equal((0, membershipRules_1.shouldUpgrade)(2, null), false);
});
(0, node_test_1.test)("never treats a lower tier as an upgrade so downgrades are not applied automatically", () => {
    assert_1.default.equal((0, membershipRules_1.isTierDowngrade)(3, 2), true);
    assert_1.default.equal((0, membershipRules_1.isTierDowngrade)(2, 3), false);
    assert_1.default.equal((0, membershipRules_1.isTierDowngrade)(null, 2), false);
    assert_1.default.equal((0, membershipRules_1.shouldUpgrade)(3, 2), false);
});
(0, node_test_1.test)("rejects overlapping tier ranges", () => {
    const invalid = (0, membershipRules_1.validateTierRanges)([
        tiers[0],
        { ...tiers[1], minCents: 90000n }
    ]);
    assert_1.default.ok(invalid);
    assert_1.default.equal((0, membershipRules_1.validateTierRanges)(tiers), null);
});
(0, node_test_1.test)("rejects an open-ended tier that is not the highest active tier", () => {
    const invalid = (0, membershipRules_1.validateTierRanges)([
        { ...tiers[0], maxCents: null },
        tiers[1]
    ]);
    assert_1.default.ok(invalid);
});
(0, node_test_1.test)("manual membership override takes precedence over the derived tier", () => {
    assert_1.default.equal((0, membershipRules_1.resolveEffectiveTierRange)(tiers[0], tiers[1])?.id, "silver");
    assert_1.default.equal((0, membershipRules_1.resolveEffectiveTierRange)(tiers[0], null)?.id, "bronze");
    assert_1.default.equal((0, membershipRules_1.resolveEffectiveTierRange)(null, null), null);
});
(0, node_test_1.test)("resolves benefit state from tier eligibility, availability, and activation", () => {
    const base = { tierSortOrder: 2, available: true, requiresActivation: false, activated: false };
    assert_1.default.equal((0, membershipRules_1.resolveBenefitState)(1, base), "locked");
    assert_1.default.equal((0, membershipRules_1.resolveBenefitState)(null, base), "locked");
    assert_1.default.equal((0, membershipRules_1.resolveBenefitState)(2, base), "active");
    assert_1.default.equal((0, membershipRules_1.resolveBenefitState)(3, { ...base, available: false }), "unavailable");
    assert_1.default.equal((0, membershipRules_1.resolveBenefitState)(2, { ...base, requiresActivation: true }), "requires_activation");
    assert_1.default.equal((0, membershipRules_1.resolveBenefitState)(2, { ...base, requiresActivation: true, activated: true }), "active");
});
(0, node_test_1.test)("flags users within ten percent of the next tier threshold as approaching", () => {
    assert_1.default.equal((0, membershipRules_1.isApproachingNextTier)(4500n, 5000n), true);
    assert_1.default.equal((0, membershipRules_1.isApproachingNextTier)(4400n, 5000n), false);
    assert_1.default.equal((0, membershipRules_1.isApproachingNextTier)(5000n, 5000n), false);
    assert_1.default.equal((0, membershipRules_1.isApproachingNextTier)(null, 5000n), false);
    assert_1.default.equal((0, membershipRules_1.isApproachingNextTier)(4500n, null), false);
});
(0, node_test_1.test)("labels tier progression as achieved, current, or locked", () => {
    assert_1.default.equal((0, membershipRules_1.tierEligibilityState)(2, 1), "achieved");
    assert_1.default.equal((0, membershipRules_1.tierEligibilityState)(2, 2), "current");
    assert_1.default.equal((0, membershipRules_1.tierEligibilityState)(2, 3), "locked");
    assert_1.default.equal((0, membershipRules_1.tierEligibilityState)(null, 1), "locked");
});
