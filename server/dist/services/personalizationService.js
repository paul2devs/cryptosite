"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateAIProfile = getOrCreateAIProfile;
exports.updateUserAIProfile = updateUserAIProfile;
exports.applyPersonalizedIncentives = applyPersonalizedIncentives;
exports.runPersonalizationEngine = runPersonalizationEngine;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const UserAIProfile_1 = require("../models/UserAIProfile");
const behaviorService_1 = require("./behaviorService");
const multiplierService_1 = require("./multiplierService");
const ChurnPrediction_1 = require("../models/ChurnPrediction");
function clamp01(x) {
    if (x < 0)
        return 0;
    if (x > 1)
        return 1;
    return x;
}
function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
}
function computeDepositPatternScore(deposits) {
    if (deposits.length < 2)
        return 0.2;
    const times = deposits
        .map((d) => new Date(d.timestamp).getTime())
        .sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < times.length; i += 1)
        gaps.push((times[i] - times[i - 1]) / (1000 * 60 * 60 * 24));
    const avgGap = gaps.reduce((s, v) => s + v, 0) / gaps.length;
    const consistency = 1 - clamp01(Math.abs(avgGap - 3) / 10);
    const freqBoost = clamp01(7 / Math.max(1, avgGap));
    return clamp01(0.55 * consistency + 0.45 * freqBoost);
}
function computeEngagementScore(user, behaviorScore) {
    const streakScore = clamp01(user.streak / 14);
    const behaviorNormalized = clamp01(behaviorScore / 100);
    const levelScore = clamp01(user.level / 6);
    return clamp01(0.45 * streakScore + 0.35 * behaviorNormalized + 0.2 * levelScore);
}
function chooseOptimalBonusType(inputs) {
    if (inputs.behaviorRiskLevel === "high")
        return "cooldown_trust_message";
    if (inputs.churnRiskScore >= 0.75)
        return "retention_bonus";
    if (inputs.depositPatternScore >= 0.7 && inputs.engagementScore >= 0.7)
        return "loyalty_multiplier";
    if (inputs.depositPatternScore >= 0.65 && inputs.engagementScore < 0.5)
        return "timed_nudge";
    return "micro_rewards";
}
async function getOrCreateAIProfile(userId) {
    const existing = await UserAIProfile_1.UserAIProfile.findOne({ where: { user_id: userId } });
    if (existing)
        return existing;
    return UserAIProfile_1.UserAIProfile.create({ user_id: userId });
}
async function updateUserAIProfile(user) {
    const profile = await getOrCreateAIProfile(user.user_id);
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const deposits = await Deposit_1.Deposit.findAll({
        where: { user_id: user.user_id, status: "Approved", timestamp: { [sequelize_1.Op.gte]: ninetyDaysAgo } },
        order: [["timestamp", "DESC"]],
        limit: 50
    });
    const behavior = await (0, behaviorService_1.getUserBehaviorSnapshot)(user.user_id);
    const depositPatternScore = computeDepositPatternScore(deposits);
    const engagementScore = computeEngagementScore(user, behavior.score);
    const churnRow = await ChurnPrediction_1.ChurnPrediction.findOne({ where: { user_id: user.user_id } });
    const churnRiskScore = churnRow ? clamp01(churnRow.probability_score) : 0;
    const bonusType = chooseOptimalBonusType({
        depositPatternScore,
        engagementScore,
        churnRiskScore,
        behaviorRiskLevel: behavior.risk_level
    });
    profile.deposit_pattern_score = depositPatternScore;
    profile.engagement_score = engagementScore;
    profile.churn_risk_score = churnRiskScore;
    profile.optimal_bonus_type = bonusType;
    profile.last_ai_update = now;
    await profile.save();
    return profile;
}
async function applyPersonalizedIncentives(user, profile) {
    if (user.bonus_blocked) {
        return;
    }
    if (profile.optimal_bonus_type === "loyalty_multiplier") {
        await (0, multiplierService_1.grantTemporaryMultiplier)({
            user,
            type: "loyalty",
            value: 0.08,
            durationMinutes: 48 * 60
        });
        await Notification_1.Notification.create({
            type: "ai_loyalty",
            message: "Loyalty multiplier enabled for the next 48 hours.",
            user_id: user.user_id
        });
        return;
    }
    if (profile.optimal_bonus_type === "retention_bonus") {
        await (0, multiplierService_1.grantTemporaryMultiplier)({
            user,
            type: "retention",
            value: 0.1,
            durationMinutes: 24 * 60
        });
        await Notification_1.Notification.create({
            type: "ai_retention",
            message: "We activated a time-limited boost to help you get back on track.",
            user_id: user.user_id
        });
        return;
    }
    if (profile.optimal_bonus_type === "micro_rewards") {
        await Notification_1.Notification.create({
            type: "ai_tip",
            message: "Small consistent deposits strengthen streak bonuses and unlock faster rewards.",
            user_id: user.user_id
        });
        return;
    }
    if (profile.optimal_bonus_type === "timed_nudge") {
        await Notification_1.Notification.create({
            type: "ai_timed_nudge",
            message: "Your progress is trending upward—depositing during active bonuses stacks well with your multiplier.",
            user_id: user.user_id
        });
        return;
    }
    if (profile.optimal_bonus_type === "cooldown_trust_message") {
        await Notification_1.Notification.create({
            type: "ai_trust",
            message: "We’re keeping your rewards safe. Continued steady activity improves access to higher benefits.",
            user_id: user.user_id
        });
    }
}
async function runPersonalizationEngine() {
    const users = await User_1.User.findAll();
    for (const user of users) {
        const profile = await updateUserAIProfile(user);
        const intensity = sigmoid((profile.engagement_score - 0.5) * 4) *
            (1 - clamp01(profile.churn_risk_score));
        if (intensity >= 0.25) {
            await applyPersonalizedIncentives(user, profile);
        }
    }
}
