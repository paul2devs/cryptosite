"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const investmentLevelRules_1 = require("./investmentLevelRules");
const levels = [
    { id: "l1", levelNumber: 1, thresholdCents: 100000n, active: true, sortOrder: 1 },
    { id: "l2", levelNumber: 2, thresholdCents: 300000n, active: true, sortOrder: 2 },
    { id: "l3", levelNumber: 3, thresholdCents: 500000n, active: true, sortOrder: 3 },
    { id: "l4", levelNumber: 4, thresholdCents: 700000n, active: false, sortOrder: 4 },
    { id: "l5", levelNumber: 5, thresholdCents: 1000000n, active: true, sortOrder: 5 }
];
(0, node_test_1.test)("a new user with no qualifying investment has no investment level", () => {
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(0n, levels), null);
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(99999n, levels), null);
});
(0, node_test_1.test)("qualifies level 1 only once the threshold is reached", () => {
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(100000n, levels)?.levelNumber, 1);
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(150000n, levels)?.levelNumber, 1);
});
(0, node_test_1.test)("qualifies the exact threshold and the level just above", () => {
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(300000n, levels)?.levelNumber, 2);
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(300001n, levels)?.levelNumber, 2);
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(499999n, levels)?.levelNumber, 2);
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(500000n, levels)?.levelNumber, 3);
});
(0, node_test_1.test)("skips inactive levels without breaking qualification", () => {
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(800000n, levels)?.levelNumber, 3);
    assert_1.default.equal((0, investmentLevelRules_1.qualifyLevel)(1000000n, levels)?.levelNumber, 5);
});
(0, node_test_1.test)("rejects overlapping, duplicated, and out-of-order level thresholds", () => {
    assert_1.default.equal((0, investmentLevelRules_1.validateLevelRanges)([levels[0], { ...levels[1], thresholdCents: 100000n }]), "Level 2 must require a higher qualifying amount than level 1.");
    assert_1.default.equal((0, investmentLevelRules_1.validateLevelRanges)(levels), null);
    assert_1.default.ok((0, investmentLevelRules_1.validateLevelRanges)([levels[0], { ...levels[1], levelNumber: 1 }]));
});
(0, node_test_1.test)("upgrades only to a higher level number and never downward", () => {
    assert_1.default.equal((0, investmentLevelRules_1.shouldUpgradeLevel)(1, 2), true);
    assert_1.default.equal((0, investmentLevelRules_1.shouldUpgradeLevel)(2, 2), false);
    assert_1.default.equal((0, investmentLevelRules_1.shouldUpgradeLevel)(2, 1), false);
    assert_1.default.equal((0, investmentLevelRules_1.shouldUpgradeLevel)(null, 1), true);
    assert_1.default.equal((0, investmentLevelRules_1.shouldUpgradeLevel)(2, null), false);
    assert_1.default.equal((0, investmentLevelRules_1.isLevelDowngrade)(2, 1), true);
    assert_1.default.equal((0, investmentLevelRules_1.isLevelDowngrade)(1, 2), false);
});
(0, node_test_1.test)("next level after the current one ignores inactive levels", () => {
    assert_1.default.equal((0, investmentLevelRules_1.nextLevelAfter)(3, levels)?.levelNumber, 5);
    assert_1.default.equal((0, investmentLevelRules_1.nextLevelAfter)(5, levels), null);
    assert_1.default.equal((0, investmentLevelRules_1.nextLevelAfter)(null, levels)?.levelNumber, 1);
});
(0, node_test_1.test)("manual administration takes precedence over the derived level", () => {
    assert_1.default.equal((0, investmentLevelRules_1.resolveEffectiveLevel)(levels[0], levels[2])?.id, "l3");
    assert_1.default.equal((0, investmentLevelRules_1.resolveEffectiveLevel)(levels[0], null)?.id, "l1");
    assert_1.default.equal((0, investmentLevelRules_1.resolveEffectiveLevel)(null, null), null);
});
(0, node_test_1.test)("resolves benefit state from level eligibility, availability, and activation", () => {
    const base = { levelNumber: 2, available: true, requiresActivation: false, activated: false };
    assert_1.default.equal((0, investmentLevelRules_1.resolveInvestmentBenefitState)(1, base), "locked");
    assert_1.default.equal((0, investmentLevelRules_1.resolveInvestmentBenefitState)(null, base), "locked");
    assert_1.default.equal((0, investmentLevelRules_1.resolveInvestmentBenefitState)(2, base), "active");
    assert_1.default.equal((0, investmentLevelRules_1.resolveInvestmentBenefitState)(3, { ...base, available: false }), "unavailable");
    assert_1.default.equal((0, investmentLevelRules_1.resolveInvestmentBenefitState)(2, { ...base, requiresActivation: true }), "requires_activation");
    assert_1.default.equal((0, investmentLevelRules_1.resolveInvestmentBenefitState)(2, { ...base, requiresActivation: true, activated: true }), "active");
});
(0, node_test_1.test)("flags users within ten percent of the next level threshold as approaching", () => {
    assert_1.default.equal((0, investmentLevelRules_1.isApproachingNextLevel)(450000n, 500000n), true);
    assert_1.default.equal((0, investmentLevelRules_1.isApproachingNextLevel)(440000n, 500000n), false);
    assert_1.default.equal((0, investmentLevelRules_1.isApproachingNextLevel)(500000n, 500000n), false);
    assert_1.default.equal((0, investmentLevelRules_1.isApproachingNextLevel)(null, 500000n), false);
    assert_1.default.equal((0, investmentLevelRules_1.isApproachingNextLevel)(450000n, null), false);
});
(0, node_test_1.test)("computes progress between the current and next thresholds", () => {
    assert_1.default.equal((0, investmentLevelRules_1.levelProgress)(150000n, 100000n, 300000n), 25);
    assert_1.default.equal((0, investmentLevelRules_1.levelProgress)(50000n, 100000n, 300000n), 0);
    assert_1.default.equal((0, investmentLevelRules_1.levelProgress)(300000n, 100000n, 300000n), 100);
    assert_1.default.equal((0, investmentLevelRules_1.levelProgress)(500000n, 100000n, null), 100);
    assert_1.default.equal((0, investmentLevelRules_1.levelProgress)(100n, 100000n, null), 0);
});
(0, node_test_1.test)("labels the level journey as completed, current, upcoming, or locked", () => {
    assert_1.default.equal((0, investmentLevelRules_1.levelJourneyState)(3, 5, 1), "completed");
    assert_1.default.equal((0, investmentLevelRules_1.levelJourneyState)(3, 5, 3), "current");
    assert_1.default.equal((0, investmentLevelRules_1.levelJourneyState)(3, 5, 5), "upcoming");
    assert_1.default.equal((0, investmentLevelRules_1.levelJourneyState)(3, 5, 4), "locked");
    assert_1.default.equal((0, investmentLevelRules_1.levelJourneyState)(null, 1, 1), "upcoming");
    assert_1.default.equal((0, investmentLevelRules_1.levelJourneyState)(null, 1, 2), "locked");
});
