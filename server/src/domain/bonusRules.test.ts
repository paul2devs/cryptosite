import assert from "assert";
import { test } from "node:test";
import {
  calculatePromotionalBonus,
  fallbackCampaign,
  isAssetEligible,
  isCampaignActive,
  isCampaignEligible,
  meetsMinimumDeposit,
  resolveBonusCampaign,
  type BonusCampaignRules
} from "./bonusRules";

function campaign(overrides: Partial<BonusCampaignRules> = {}): BonusCampaignRules {
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

test("applies a 5% promotional bonus to a 20000 qualifying deposit", () => {
  const bonus = calculatePromotionalBonus({
    amount: "20000.00000000",
    percentage: "5.000000",
    maxBonus: null
  });
  assert.equal(bonus, "1000.00000000");
});

test("credits the 5% bonus on every qualifying deposit, not just the first", () => {
  const rules = fallbackCampaign({
    percentage: "5.000000",
    minDeposit: "0.00000000",
    maxBonus: null,
    eligibleAssets: null
  });
  const firstDeposit = calculatePromotionalBonus({
    amount: "100.00000000",
    percentage: rules.percentage,
    maxBonus: rules.maxBonus
  });
  const secondDeposit = calculatePromotionalBonus({
    amount: "200.00000000",
    percentage: rules.percentage,
    maxBonus: rules.maxBonus
  });
  assert.equal(firstDeposit, "5.00000000");
  assert.equal(secondDeposit, "10.00000000");
});

test("rounds the promotional bonus half-up at eight decimal places", () => {
  const bonus = calculatePromotionalBonus({
    amount: "19.99000000",
    percentage: "2.500000",
    maxBonus: null
  });
  assert.equal(bonus, "0.49975000");
});

test("caps the promotional bonus at the configured maximum", () => {
  const bonus = calculatePromotionalBonus({
    amount: "20000.00000000",
    percentage: "5.000000",
    maxBonus: "500.00000000"
  });
  assert.equal(bonus, "500.00000000");
});

test("never credits a bonus for a zero or negative percentage", () => {
  assert.equal(
    calculatePromotionalBonus({ amount: "1000.00000000", percentage: "0.000000", maxBonus: null }),
    "0.00000000"
  );
  assert.equal(
    calculatePromotionalBonus({ amount: "0.00000000", percentage: "5.000000", maxBonus: null }),
    "0.00000000"
  );
});

test("enforces minimum deposit, asset, and campaign window", () => {
  const rules = campaign({
    minDeposit: "500.00000000",
    eligibleAssets: ["USDT", "BTC"],
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-02-01T00:00:00.000Z"
  });
  assert.equal(meetsMinimumDeposit(rules, "499.00000000"), false);
  assert.equal(meetsMinimumDeposit(rules, "500.00000000"), true);
  assert.equal(isAssetEligible(rules, "usdt"), true);
  assert.equal(isAssetEligible(rules, "ETH"), false);
  assert.equal(isCampaignActive(rules, "2026-01-15T00:00:00.000Z"), true);
  assert.equal(isCampaignActive(rules, "2025-12-31T00:00:00.000Z"), false);
  assert.equal(isCampaignActive(rules, "2026-02-02T00:00:00.000Z"), false);
});

test("resolves the highest-priority eligible campaign", () => {
  const low = campaign({ campaignId: "low", percentage: "3.000000", priority: 1 });
  const high = campaign({ campaignId: "high", percentage: "6.000000", priority: 5, maxBonus: "800.00000000" });
  const decision = resolveBonusCampaign([low, high], {
    amount: "20000.00000000",
    asset: "USDT",
    at: "2026-01-15T00:00:00.000Z"
  });
  assert.ok(decision);
  assert.equal(decision?.campaign.campaignId, "high");
  assert.equal(decision?.bonusAmount, "800.00000000");
});

test("returns no decision when no campaign qualifies", () => {
  const decision = resolveBonusCampaign([campaign({ minDeposit: "1000.00000000" })], {
    amount: "100.00000000",
    asset: "USDT",
    at: "2026-01-15T00:00:00.000Z"
  });
  assert.equal(decision, null);
});

test("honours eligibility conditions such as required referrals and new users", () => {
  const rules = campaign({ eligibility: { requiredReferral: true } });
  assert.equal(
    isCampaignEligible(rules, { amount: "1000.00000000", asset: "USDT", at: "2026-01-15T00:00:00.000Z" }),
    false
  );
  assert.equal(
    isCampaignEligible(rules, {
      amount: "1000.00000000",
      asset: "USDT",
      at: "2026-01-15T00:00:00.000Z",
      hasReferral: true
    }),
    true
  );
  const newUsers = campaign({ eligibility: { newUsersOnly: true } });
  assert.equal(
    isCampaignEligible(newUsers, {
      amount: "1000.00000000",
      asset: "USDT",
      at: "2026-01-15T00:00:00.000Z",
      accountCreatedAt: "2026-01-10T00:00:00.000Z"
    }),
    true
  );
  assert.equal(
    isCampaignEligible(newUsers, {
      amount: "1000.00000000",
      asset: "USDT",
      at: "2026-03-15T00:00:00.000Z",
      accountCreatedAt: "2026-01-10T00:00:00.000Z"
    }),
    false
  );
});

test("builds a fallback campaign from platform defaults", () => {
  const rules = fallbackCampaign({
    percentage: "5.000000",
    minDeposit: "100.00000000",
    maxBonus: "1000.00000000",
    eligibleAssets: null
  });
  assert.equal(rules.active, true);
  assert.equal(rules.campaignId, "default");
  assert.equal(
    calculatePromotionalBonus({
      amount: "20000.00000000",
      percentage: rules.percentage,
      maxBonus: rules.maxBonus
    }),
    "1000.00000000"
  );
});
