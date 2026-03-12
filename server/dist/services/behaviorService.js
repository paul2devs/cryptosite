"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordDepositBehavior = recordDepositBehavior;
exports.recordWithdrawalAttempt = recordWithdrawalAttempt;
exports.getUserBehaviorSnapshot = getUserBehaviorSnapshot;
exports.getHighRiskUsers = getHighRiskUsers;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const UserBehaviorScore_1 = require("../models/UserBehaviorScore");
const Bonus_1 = require("../models/Bonus");
const HIGH_RISK_THRESHOLD_DEFAULT = 80;
const MEDIUM_RISK_THRESHOLD_DEFAULT = 60;
function getHighRiskThreshold() {
    const raw = process.env.BEHAVIOR_HIGH_RISK_THRESHOLD;
    const parsed = raw ? Number(raw) : HIGH_RISK_THRESHOLD_DEFAULT;
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return HIGH_RISK_THRESHOLD_DEFAULT;
    }
    return parsed;
}
function getMediumRiskThreshold() {
    const raw = process.env.BEHAVIOR_MEDIUM_RISK_THRESHOLD;
    const parsed = raw ? Number(raw) : MEDIUM_RISK_THRESHOLD_DEFAULT;
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return MEDIUM_RISK_THRESHOLD_DEFAULT;
    }
    return parsed;
}
function classifyRisk(score) {
    const high = getHighRiskThreshold();
    const medium = getMediumRiskThreshold();
    if (score >= high) {
        return "high";
    }
    if (score >= medium) {
        return "medium";
    }
    return "low";
}
async function getOrCreateBehaviorRow(userId) {
    const existing = await UserBehaviorScore_1.UserBehaviorScore.findOne({ where: { user_id: userId } });
    if (existing) {
        return existing;
    }
    return UserBehaviorScore_1.UserBehaviorScore.create({
        user_id: userId
    });
}
async function recordDepositBehavior(user, amount) {
    const behavior = await getOrCreateBehaviorRow(user.user_id);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentDeposits = await Deposit_1.Deposit.findAll({
        where: {
            user_id: user.user_id,
            status: "Approved",
            timestamp: { [sequelize_1.Op.gte]: weekAgo }
        }
    });
    const totalRecent = recentDeposits.reduce((sum, d) => sum + d.amount, 0);
    const avg = recentDeposits.length > 0 ? totalRecent / recentDeposits.length : amount;
    let scoreDelta = 0;
    if (amount > avg * 3 && avg > 0) {
        scoreDelta += 10;
    }
    else if (amount > avg * 1.5 && avg > 0) {
        scoreDelta += 5;
    }
    else if (amount < avg * 0.5 && avg > 0) {
        scoreDelta += 2;
    }
    const depositsCount = recentDeposits.length + 1;
    if (depositsCount >= 10) {
        scoreDelta -= 5;
    }
    else if (depositsCount >= 5) {
        scoreDelta -= 2;
    }
    const activeBonuses = await Bonus_1.Bonus.findAll({
        where: {
            start_time: { [sequelize_1.Op.lte]: now },
            end_time: { [sequelize_1.Op.gt]: now }
        }
    });
    if (activeBonuses.length > 0) {
        scoreDelta += 4;
    }
    const nextScore = Math.max(0, Math.min(100, behavior.score + scoreDelta));
    const riskLevel = classifyRisk(nextScore);
    behavior.score = nextScore;
    behavior.risk_level = riskLevel;
    behavior.updated_at = new Date();
    await behavior.save();
    if (riskLevel === "high") {
        await Notification_1.Notification.create({
            type: "risk_flag",
            message: `High risk behavior detected for user ${user.email}`,
            user_id: null
        });
    }
}
async function recordWithdrawalAttempt(user, amount, approved) {
    const behavior = await getOrCreateBehaviorRow(user.user_id);
    let scoreDelta = 0;
    if (!approved) {
        scoreDelta += 6;
    }
    if (amount > user.withdrawable_balance * 2 && user.withdrawable_balance > 0) {
        scoreDelta += 5;
    }
    const nextScore = Math.max(0, Math.min(100, behavior.score + scoreDelta));
    const riskLevel = classifyRisk(nextScore);
    behavior.score = nextScore;
    behavior.risk_level = riskLevel;
    behavior.updated_at = new Date();
    await behavior.save();
    if (riskLevel === "high") {
        await Notification_1.Notification.create({
            type: "risk_flag",
            message: `High risk withdrawal behavior detected for user ${user.email}`,
            user_id: null
        });
    }
}
async function getUserBehaviorSnapshot(userId) {
    const behavior = await getOrCreateBehaviorRow(userId);
    return {
        score: behavior.score,
        risk_level: behavior.risk_level
    };
}
async function getHighRiskUsers() {
    const rows = await UserBehaviorScore_1.UserBehaviorScore.findAll({
        where: {
            risk_level: "high"
        },
        include: [{ model: User_1.User }]
    });
    return rows
        .map((row) => {
        const user = row.User;
        return user
            ? {
                user,
                score: row.score,
                risk_level: row.risk_level
            }
            : null;
    })
        .filter((item) => !!item);
}
