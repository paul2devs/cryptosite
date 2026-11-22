"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const bonusRules_1 = require("./bonusRules");
function campaign(overrides = {}) {
    return {
        campaignId: "campaign-1",
        name: "Launch bonus",
        percentage: "5.000000",
        minDeposit: "0.00000000",
        maxBonus: null,
        eligibleAssets: null,
        startsAt: null,
        endsAt: null,
        active: true,
        priority: 0,
        eligibility: {},
        ...overrides
    };
}
(0, node_test_1.test)("applies a 5% promotional bonus to a 20000 qualifying deposit", () => {
    const bonus = (0, bonusRules_1.calculatePromotionalBonus)({
        amount: "20000.00000000",
        percentage: "5.000000",
        maxBonus: null
    });
    assert_1.default.equal(bonus, "1000.00000000");
});
(0, node_test_1.test)("credits the 5% bonus on every qualifying deposit, not just the first", () => {
    const rules = (0, bonusRules_1.fallbackCampaign)({
        percentage: "5.000000",
        minDeposit: "0.00000000",
        maxBonus: null,
        eligibleAssets: null
    });
    const firstDeposit = (0, bonusRules_1.calculatePromotionalBonus)({
        amount: "100.00000000",
        percentage: rules.percentage,
        maxBonus: rules.maxBonus
    });
    const secondDeposit = (0, bonusRules_1.calculatePromotionalBonus)({
        amount: "200.00000000",
        percentage: rules.percentage,
        maxBonus: rules.maxBonus
    });
    assert_1.default.equal(firstDeposit, "5.00000000");
    assert_1.default.equal(secondDeposit, "10.00000000");
});
(0, node_test_1.test)("rounds the promotional bonus half-up at eight decimal places", () => {
    const bonus = (0, bonusRules_1.calculatePromotionalBonus)({
        amount: "19.99000000",
        percentage: "2.500000",
        maxBonus: null
    });
    assert_1.default.equal(bonus, "0.49975000");
});
(0, node_test_1.test)("caps the promotional bonus at the configured maximum", () => {
    const bonus = (0, bonusRules_1.calculatePromotionalBonus)({
        amount: "20000.00000000",
        percentage: "5.000000",
        maxBonus: "500.00000000"
    });
    assert_1.default.equal(bonus, "500.00000000");
});
(0, node_test_1.test)("never credits a bonus for a zero or negative percentage", () => {
    assert_1.default.equal((0, bonusRules_1.calculatePromotionalBonus)({ amount: "1000.00000000", percentage: "0.000000", maxBonus: null }), "0.00000000");
    assert_1.default.equal((0, bonusRules_1.calculatePromotionalBonus)({ amount: "0.00000000", percentage: "5.000000", maxBonus: null }), "0.00000000");
});
(0, node_test_1.test)("enforces minimum deposit, asset, and campaign window", () => {
    const rules = campaign({
        minDeposit: "500.00000000",
        eligibleAssets: ["USDT", "BTC"],
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-02-01T00:00:00.000Z"
    });
    assert_1.default.equal((0, bonusRules_1.meetsMinimumDeposit)(rules, "499.00000000"), false);
    assert_1.default.equal((0, bonusRules_1.meetsMinimumDeposit)(rules, "500.00000000"), true);
    assert_1.default.equal((0, bonusRules_1.isAssetEligible)(rules, "usdt"), true);
    assert_1.default.equal((0, bonusRules_1.isAssetEligible)(rules, "ETH"), false);
    assert_1.default.equal((0, bonusRules_1.isCampaignActive)(rules, "2026-01-15T00:00:00.000Z"), true);
    assert_1.default.equal((0, bonusRules_1.isCampaignActive)(rules, "2025-12-31T00:00:00.000Z"), false);
    assert_1.default.equal((0, bonusRules_1.isCampaignActive)(rules, "2026-02-02T00:00:00.000Z"), false);
});
(0, node_test_1.test)("resolves the highest-priority eligible campaign", () => {
    const low = campaign({ campaignId: "low", percentage: "3.000000", priority: 1 });
    const high = campaign({ campaignId: "high", percentage: "6.000000", priority: 5, maxBonus: "800.00000000" });
    const decision = (0, bonusRules_1.resolveBonusCampaign)([low, high], {
        amount: "20000.00000000",
        asset: "USDT",
        at: "2026-01-15T00:00:00.000Z"
    });
    assert_1.default.ok(decision);
    assert_1.default.equal(decision?.campaign.campaignId, "high");
    assert_1.default.equal(decision?.bonusAmount, "800.00000000");
});
(0, node_test_1.test)("returns no decision when no campaign qualifies", () => {
    const decision = (0, bonusRules_1.resolveBonusCampaign)([campaign({ minDeposit: "1000.00000000" })], {
        amount: "100.00000000",
        asset: "USDT",
        at: "2026-01-15T00:00:00.000Z"
    });
    assert_1.default.equal(decision, null);
});
(0, node_test_1.test)("honours eligibility conditions such as required referrals and new users", () => {
    const rules = campaign({ eligibility: { requiredReferral: true } });
    assert_1.default.equal((0, bonusRules_1.isCampaignEligible)(rules, { amount: "1000.00000000", asset: "USDT", at: "2026-01-15T00:00:00.000Z" }), false);
    assert_1.default.equal((0, bonusRules_1.isCampaignEligible)(rules, {
        amount: "1000.00000000",
        asset: "USDT",
        at: "2026-01-15T00:00:00.000Z",
        hasReferral: true
    }), true);
    const newUsers = campaign({ eligibility: { newUsersOnly: true } });
    assert_1.default.equal((0, bonusRules_1.isCampaignEligible)(newUsers, {
        amount: "1000.00000000",
        asset: "USDT",
        at: "2026-01-15T00:00:00.000Z",
        accountCreatedAt: "2026-01-10T00:00:00.000Z"
    }), true);
    assert_1.default.equal((0, bonusRules_1.isCampaignEligible)(newUsers, {
        amount: "1000.00000000",
        asset: "USDT",
        at: "2026-03-15T00:00:00.000Z",
        accountCreatedAt: "2026-01-10T00:00:00.000Z"
    }), false);
});
(0, node_test_1.test)("builds a fallback campaign from platform defaults", () => {
    const rules = (0, bonusRules_1.fallbackCampaign)({
        percentage: "5.000000",
        minDeposit: "100.00000000",
        maxBonus: "1000.00000000",
        eligibleAssets: null
    });
    assert_1.default.equal(rules.active, true);
    assert_1.default.equal(rules.campaignId, "default");
    assert_1.default.equal((0, bonusRules_1.calculatePromotionalBonus)({
        amount: "20000.00000000",
        percentage: rules.percentage,
        maxBonus: rules.maxBonus
    }), "1000.00000000");
});
