"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REWARD_RULES = exports.REWARD_STATUSES = exports.REWARD_SETTLEMENT_ACCOUNT = exports.REWARD_HOLDING_ACCOUNT = exports.REWARD_RELEASE_ACCOUNT = exports.REWARD_REVERSAL_TRANSACTION_TYPE = exports.REWARD_REVERSAL_SOURCE_TYPE = exports.REWARD_REDEMPTION_SOURCE_TYPE = exports.REWARD_GRANT_SOURCE_TYPE = exports.REWARD_REDEMPTION_TRANSACTION_TYPE = exports.REWARD_GRANT_TRANSACTION_TYPE = exports.ZERO_REQUIREMENT = exports.ZERO_REWARD = exports.REWARD_AMOUNT_SCALE = exports.REWARD_REQUIREMENT_UNIT = exports.REWARD_REQUIREMENT_LABEL = exports.REWARD_CATEGORY_DESCRIPTION = exports.REWARD_CATEGORY_LABEL = exports.REWARD_CATEGORIES = void 0;
exports.isRewardCategory = isRewardCategory;
exports.isRewardRequirementType = isRewardRequirementType;
exports.isRewardStatus = isRewardStatus;
exports.normalizeRewardAmount = normalizeRewardAmount;
exports.amountRequirementProgress = amountRequirementProgress;
exports.countRequirementProgress = countRequirementProgress;
exports.tierRequirementProgress = tierRequirementProgress;
exports.manualRequirementProgress = manualRequirementProgress;
exports.isRewardExpired = isRewardExpired;
exports.resolveDisplayStatus = resolveDisplayStatus;
exports.rewardStatusLabel = rewardStatusLabel;
const money_1 = require("./money");
exports.REWARD_CATEGORIES = ["loyalty", "promotional", "referral", "special"];
exports.REWARD_CATEGORY_LABEL = {
    loyalty: "Loyalty",
    promotional: "Promotional",
    referral: "Referral",
    special: "Special"
};
exports.REWARD_CATEGORY_DESCRIPTION = {
    loyalty: "Earned progressively from your verified activity on the platform.",
    promotional: "Issued by the platform for a specific campaign.",
    referral: "Earned from the accounts that joined with your referral code.",
    special: "Granted for exceptional account milestones and reviewed individually."
};
exports.REWARD_REQUIREMENT_LABEL = {
    manual: "Issued by the platform",
    deposit_total: "Confirmed, verified deposits",
    invest_total: "Verified invested principal",
    membership_tier: "Membership tier",
    referral_count: "Referred accounts"
};
exports.REWARD_REQUIREMENT_UNIT = {
    manual: "amount",
    deposit_total: "amount",
    invest_total: "amount",
    membership_tier: "tier",
    referral_count: "count"
};
exports.REWARD_AMOUNT_SCALE = 8;
exports.ZERO_REWARD = "0.00000000";
exports.ZERO_REQUIREMENT = "0.00000000";
exports.REWARD_GRANT_TRANSACTION_TYPE = "reward_granted";
exports.REWARD_REDEMPTION_TRANSACTION_TYPE = "reward_redeemed";
exports.REWARD_GRANT_SOURCE_TYPE = "reward";
exports.REWARD_REDEMPTION_SOURCE_TYPE = "redeem";
exports.REWARD_REVERSAL_SOURCE_TYPE = "reward_reversal";
exports.REWARD_REVERSAL_TRANSACTION_TYPE = "adjustment_reversal";
// A granted reward is held in the promotional_credits account so it is never
// counted as deposited principal or trading profit. Redeeming it moves the value
// into available_balance, and a reversal returns it to the adjustments account.
exports.REWARD_RELEASE_ACCOUNT = "adjustments";
exports.REWARD_HOLDING_ACCOUNT = "promotional_credits";
exports.REWARD_SETTLEMENT_ACCOUNT = "available_balance";
exports.REWARD_STATUSES = ["available", "pending", "redeemed", "expired", "revoked"];
function isRewardCategory(value) {
    return typeof value === "string" && exports.REWARD_CATEGORIES.includes(value);
}
function isRewardRequirementType(value) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(exports.REWARD_REQUIREMENT_LABEL, value);
}
function isRewardStatus(value) {
    return typeof value === "string" && exports.REWARD_STATUSES.includes(value);
}
function normalizeRewardAmount(value) {
    return (0, money_1.formatDecimal)((0, money_1.parseDecimal)(String(value), exports.REWARD_AMOUNT_SCALE), exports.REWARD_AMOUNT_SCALE);
}
function percentOfTotal(current, required) {
    if (required <= 0n)
        return 100;
    if (current >= required)
        return 100;
    if (current <= 0n)
        return 0;
    return Number((current * 10000n) / required) / 100;
}
function amountRequirementProgress(current, required) {
    const currentUnits = (0, money_1.parseDecimal)(normalizeRewardAmount(current), exports.REWARD_AMOUNT_SCALE);
    const requiredUnits = (0, money_1.parseDecimal)(normalizeRewardAmount(required), exports.REWARD_AMOUNT_SCALE);
    const met = requiredUnits <= 0n || currentUnits >= requiredUnits;
    return {
        type: "deposit_total",
        unit: "amount",
        current: (0, money_1.formatDecimal)(currentUnits, exports.REWARD_AMOUNT_SCALE),
        required: (0, money_1.formatDecimal)(requiredUnits, exports.REWARD_AMOUNT_SCALE),
        remaining: met ? exports.ZERO_REWARD : (0, money_1.formatDecimal)(requiredUnits - currentUnits, exports.REWARD_AMOUNT_SCALE),
        met,
        progressPercent: percentOfTotal(currentUnits, requiredUnits),
        currentLabel: null,
        requiredLabel: null
    };
}
function countRequirementProgress(current, required) {
    const safeCurrent = Number.isFinite(current) ? Math.max(0, Math.trunc(current)) : 0;
    const safeRequired = Number.isFinite(required) ? Math.max(0, Math.trunc(required)) : 0;
    const met = safeRequired <= 0 || safeCurrent >= safeRequired;
    return {
        type: "referral_count",
        unit: "count",
        current: String(safeCurrent),
        required: String(safeRequired),
        remaining: met ? "0" : String(safeRequired - safeCurrent),
        met,
        progressPercent: percentOfTotal(BigInt(safeCurrent), BigInt(safeRequired)),
        currentLabel: null,
        requiredLabel: null
    };
}
function tierRequirementProgress(input) {
    const currentSort = Number.isFinite(input.currentSort) ? Math.max(0, Math.trunc(input.currentSort)) : 0;
    const requiredSort = Number.isFinite(input.requiredSort) ? Math.max(0, Math.trunc(input.requiredSort)) : 0;
    const met = requiredSort <= 0 || currentSort >= requiredSort;
    return {
        type: "membership_tier",
        unit: "tier",
        current: String(currentSort),
        required: String(requiredSort),
        remaining: null,
        met,
        progressPercent: met ? 100 : percentOfTotal(BigInt(currentSort), BigInt(requiredSort)),
        currentLabel: input.currentName,
        requiredLabel: input.requiredName
    };
}
function manualRequirementProgress() {
    return {
        type: "manual",
        unit: "amount",
        current: exports.ZERO_REQUIREMENT,
        required: exports.ZERO_REQUIREMENT,
        remaining: null,
        met: false,
        progressPercent: 0,
        currentLabel: null,
        requiredLabel: null
    };
}
function isRewardExpired(expiresAt, now = new Date()) {
    if (!expiresAt)
        return false;
    const value = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (Number.isNaN(value.getTime()))
        return false;
    return value.getTime() <= now.getTime();
}
function resolveDisplayStatus(status, expiresAt, now = new Date()) {
    const normalized = isRewardStatus(status) ? status : "pending";
    if ((normalized === "available" || normalized === "pending") && isRewardExpired(expiresAt, now)) {
        return "expired";
    }
    return normalized;
}
function rewardStatusLabel(status) {
    if (status === "available")
        return "Available";
    if (status === "pending")
        return "Pending";
    if (status === "redeemed")
        return "Redeemed";
    if (status === "expired")
        return "Expired";
    return "Unavailable";
}
exports.REWARD_RULES = {
    fundingModel: "Rewards are funded from the platform adjustments account and held as promotional credits. They are never sourced from investment principal and never counted as trading profit.",
    redemptionModel: "Redeeming an available reward moves its value from promotional_credits into your available balance. A reward can only be redeemed once, and only while it is available and unexpired.",
    eligibilityModel: "Eligibility uses confirmed, verified deposits, verified invested principal, assigned membership tier, and referred accounts. Only measures the platform can independently verify are used.",
    expiryModel: "A reward expires only when an explicit expiry date is configured for it. No reward uses artificial scarcity or fabricated countdowns."
};
