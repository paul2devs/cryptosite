"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyAIProfile = getMyAIProfile;
exports.refreshMyAIProfile = refreshMyAIProfile;
const User_1 = require("../models/User");
const personalizationService_1 = require("../services/personalizationService");
const ChurnPrediction_1 = require("../models/ChurnPrediction");
const behaviorService_1 = require("../services/behaviorService");
async function getMyAIProfile(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const profile = await (0, personalizationService_1.getOrCreateAIProfile)(user.user_id);
        const churn = await ChurnPrediction_1.ChurnPrediction.findOne({ where: { user_id: user.user_id } });
        const behavior = await (0, behaviorService_1.getUserBehaviorSnapshot)(user.user_id);
        res.status(200).json({
            user_id: user.user_id,
            deposit_pattern_score: profile.deposit_pattern_score,
            engagement_score: profile.engagement_score,
            churn_risk_score: churn ? churn.probability_score : profile.churn_risk_score,
            optimal_bonus_type: profile.optimal_bonus_type,
            last_ai_update: profile.last_ai_update,
            behavior_score: behavior.score,
            behavior_risk_level: behavior.risk_level
        });
    }
    catch {
        res.status(500).json({ message: "Failed to load AI profile" });
    }
}
async function refreshMyAIProfile(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const profile = await (0, personalizationService_1.updateUserAIProfile)(user);
        res.status(200).json(profile);
    }
    catch {
        res.status(500).json({ message: "Failed to refresh AI profile" });
    }
}
