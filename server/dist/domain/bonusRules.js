"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZERO_BONUS = exports.BONUS_PERCENT_SCALE = exports.BONUS_AMOUNT_SCALE = exports.BONUS_SOURCE_ACCOUNT = exports.BONUS_CREDIT_ACCOUNT = exports.BONUS_SOURCE_TYPE = exports.BONUS_TRANSACTION_TYPE = void 0;
exports.isCampaignActive = isCampaignActive;
exports.isAssetEligible = isAssetEligible;
exports.meetsMinimumDeposit = meetsMinimumDeposit;
exports.meetsEligibility = meetsEligibility;
exports.calculatePromotionalBonus = calculatePromotionalBonus;
exports.isCampaignEligible = isCampaignEligible;
exports.resolveBonusCampaign = resolveBonusCampaign;
exports.fallbackCampaign = fallbackCampaign;
const money_1 = require("./money");
exports.BONUS_TRANSACTION_TYPE = "promotional_bonus_credited";
exports.BONUS_SOURCE_TYPE = "bonus_credit";
exports.BONUS_CREDIT_ACCOUNT = "promotional_credits";
exports.BONUS_SOURCE_ACCOUNT = "adjustments";
exports.BONUS_AMOUNT_SCALE = 8;
exports.BONUS_PERCENT_SCALE = 6;
exports.ZERO_BONUS = "0.00000000";
const NEW_USER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
function parseDate(value) {
    if (!value)
        return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
function isCampaignActive(campaign, at) {
    if (!campaign.active)
        return false;
    const moment = parseDate(at);
    if (!moment)
        return false;
    const startsAt = parseDate(campaign.startsAt);
    if (startsAt && moment.getTime() < startsAt.getTime())
        return false;
    const endsAt = parseDate(campaign.endsAt);
    if (endsAt && moment.getTime() > endsAt.getTime())
        return false;
    return true;
}
function isAssetEligible(campaign, asset) {
    if (!campaign.eligibleAssets || campaign.eligibleAssets.length === 0)
        return true;
    const target = asset.trim().toUpperCase();
    return campaign.eligibleAssets.some((candidate) => candidate.trim().toUpperCase() === target);
}
function meetsMinimumDeposit(campaign, amount) {
    const deposit = (0, money_1.parseDecimal)(amount, exports.BONUS_AMOUNT_SCALE);
    const minimum = (0, money_1.parseDecimal)(campaign.minDeposit, exports.BONUS_AMOUNT_SCALE);
    return deposit >= minimum;
}
function meetsEligibility(campaign, input) {
    const eligibility = campaign.eligibility ?? {};
    if (eligibility.minMembershipTierId) {
        if ((input.membershipTierId ?? "").trim() !== eligibility.minMembershipTierId) {
            return false;
        }
    }
    if (eligibility.minInvestedAmount) {
        const invested = (0, money_1.parseDecimal)(input.investedAmount ?? "0.00000000", exports.BONUS_AMOUNT_SCALE);
        const required = (0, money_1.parseDecimal)(eligibility.minInvestedAmount, exports.BONUS_AMOUNT_SCALE);
        if (invested < required)
            return false;
    }
    if (eligibility.requiredReferral && !input.hasReferral)
        return false;
    if (eligibility.newUsersOnly) {
        const created = parseDate(input.accountCreatedAt);
        const at = parseDate(input.at);
        if (!created || !at)
            return false;
        if (at.getTime() - created.getTime() > NEW_USER_WINDOW_MS)
            return false;
    }
    return true;
}
function calculatePromotionalBonus(input) {
    const deposit = (0, money_1.parseDecimal)(input.amount, exports.BONUS_AMOUNT_SCALE);
    if (deposit <= 0n)
        return exports.ZERO_BONUS;
    const percent = (0, money_1.parseDecimal)(input.percentage, exports.BONUS_PERCENT_SCALE);
    if (percent <= 0n)
        return exports.ZERO_BONUS;
    const raw = (0, money_1.parseDecimal)((0, money_1.percentOf)(input.amount, input.percentage, exports.BONUS_AMOUNT_SCALE, exports.BONUS_PERCENT_SCALE), exports.BONUS_AMOUNT_SCALE);
    if (raw <= 0n)
        return exports.ZERO_BONUS;
    if (input.maxBonus) {
        const cap = (0, money_1.parseDecimal)(input.maxBonus, exports.BONUS_AMOUNT_SCALE);
        if (cap > 0n && raw > cap)
            return (0, money_1.formatDecimal)(cap, exports.BONUS_AMOUNT_SCALE);
    }
    return (0, money_1.formatDecimal)(raw, exports.BONUS_AMOUNT_SCALE);
}
function isCampaignEligible(campaign, input) {
    return (isCampaignActive(campaign, input.at) &&
        isAssetEligible(campaign, input.asset) &&
        meetsMinimumDeposit(campaign, input.amount) &&
        meetsEligibility(campaign, input));
}
function resolveBonusCampaign(campaigns, input) {
    const decisions = [];
    for (const campaign of campaigns) {
        if (!isCampaignEligible(campaign, input))
            continue;
        const bonusAmount = calculatePromotionalBonus({
            amount: input.amount,
            percentage: campaign.percentage,
            maxBonus: campaign.maxBonus
        });
        if ((0, money_1.parseDecimal)(bonusAmount, exports.BONUS_AMOUNT_SCALE) <= 0n)
            continue;
        decisions.push({ campaign, bonusAmount });
    }
    if (decisions.length === 0)
        return null;
    decisions.sort((left, right) => {
        if (right.campaign.priority !== left.campaign.priority) {
            return right.campaign.priority - left.campaign.priority;
        }
        const leftBonus = (0, money_1.parseDecimal)(left.bonusAmount, exports.BONUS_AMOUNT_SCALE);
        const rightBonus = (0, money_1.parseDecimal)(right.bonusAmount, exports.BONUS_AMOUNT_SCALE);
        if (leftBonus !== rightBonus)
            return leftBonus > rightBonus ? -1 : 1;
        return right.campaign.percentage.localeCompare(left.campaign.percentage);
    });
    return decisions[0];
}
function fallbackCampaign(settings) {
    return {
        campaignId: "default",
        name: "Standard promotional bonus",
        percentage: settings.percentage,
        minDeposit: settings.minDeposit,
        maxBonus: settings.maxBonus,
        eligibleAssets: settings.eligibleAssets,
        startsAt: null,
        endsAt: null,
        active: true,
        priority: 0,
        eligibility: {}
    };
}
