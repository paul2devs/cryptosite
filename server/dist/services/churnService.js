"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeChurnProbability = computeChurnProbability;
exports.upsertChurnPrediction = upsertChurnPrediction;
exports.runChurnDetection = runChurnDetection;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const User_1 = require("../models/User");
const ChurnPrediction_1 = require("../models/ChurnPrediction");
const Notification_1 = require("../models/Notification");
const multiplierService_1 = require("./multiplierService");
const behaviorService_1 = require("./behaviorService");
function clamp01(x) {
    if (x < 0)
        return 0;
    if (x > 1)
        return 1;
    return x;
}
function riskFromProbability(p) {
    if (p >= 0.75)
        return "high";
    if (p >= 0.45)
        return "medium";
    return "low";
}
async function computeChurnProbability(user) {
    const now = new Date();
    const lastApprovedDeposit = await Deposit_1.Deposit.findOne({
        where: { user_id: user.user_id, status: "Approved" },
        order: [["timestamp", "DESC"]]
    });
    const daysSinceDeposit = lastApprovedDeposit
        ? (now.getTime() - new Date(lastApprovedDeposit.timestamp).getTime()) /
            (1000 * 60 * 60 * 24)
        : 999;
    const lastActivity = user.last_activity_at ? new Date(user.last_activity_at) : null;
    const daysSinceActivity = lastActivity
        ? (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
        : 999;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const deposits30 = await Deposit_1.Deposit.findAll({
        where: {
            user_id: user.user_id,
            status: "Approved",
            timestamp: { [sequelize_1.Op.gte]: thirtyDaysAgo }
        },
        order: [["timestamp", "ASC"]]
    });
    const amounts = deposits30.map((d) => d.amount);
    const half = Math.floor(amounts.length / 2);
    const firstHalf = amounts.slice(0, half);
    const secondHalf = amounts.slice(Math.max(0, half));
    const avg = (xs) => xs.length === 0 ? 0 : xs.reduce((s, v) => s + v, 0) / xs.length;
    const avgFirst = avg(firstHalf);
    const avgSecond = avg(secondHalf);
    const decline = avgFirst > 0 && avgSecond > 0 ? clamp01((avgFirst - avgSecond) / avgFirst) : 0;
    const behavior = await (0, behaviorService_1.getUserBehaviorSnapshot)(user.user_id);
    const behaviorRiskBoost = behavior.risk_level === "high" ? 0.1 : behavior.risk_level === "medium" ? 0.05 : 0;
    const inactivityScore = clamp01(daysSinceDeposit / 7) * 0.55;
    const sessionDropScore = clamp01(daysSinceActivity / 4) * 0.25;
    const sizeDeclineScore = decline * 0.2;
    return clamp01(inactivityScore + sessionDropScore + sizeDeclineScore + behaviorRiskBoost);
}
async function upsertChurnPrediction(user) {
    const probability = await computeChurnProbability(user);
    const riskLevel = riskFromProbability(probability);
    const existing = await ChurnPrediction_1.ChurnPrediction.findOne({ where: { user_id: user.user_id } });
    if (existing) {
        existing.probability_score = probability;
        existing.risk_level = riskLevel;
        existing.last_detected = new Date();
        await existing.save();
        return existing;
    }
    return ChurnPrediction_1.ChurnPrediction.create({
        user_id: user.user_id,
        probability_score: probability,
        risk_level: riskLevel,
        last_detected: new Date()
    });
}
async function runChurnDetection() {
    const users = await User_1.User.findAll();
    const now = new Date();
    for (const user of users) {
        const prediction = await upsertChurnPrediction(user);
        if (prediction.risk_level === "high") {
            await (0, multiplierService_1.grantTemporaryMultiplier)({
                user,
                type: "retention",
                value: 0.12,
                durationMinutes: 24 * 60
            });
            await Notification_1.Notification.create({
                type: "churn_risk_high",
                message: "We reserved a limited-time boost to help you finish your next level faster.",
                user_id: user.user_id
            });
            continue;
        }
        if (prediction.risk_level === "medium") {
            await Notification_1.Notification.create({
                type: "churn_risk_medium",
                message: "You’re close to unlocking more rewards—small consistent deposits accelerate your progress.",
                user_id: user.user_id,
                timestamp: now
            });
        }
    }
}
