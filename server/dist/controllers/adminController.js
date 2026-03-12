"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserStats = getUserStats;
exports.getRiskFlags = getRiskFlags;
const User_1 = require("../models/User");
const gamificationService_1 = require("../services/gamificationService");
const behaviorService_1 = require("../services/behaviorService");
async function getUserStats(_req, res) {
    try {
        const users = await User_1.User.findAll();
        const results = await Promise.all(users.map(async (user) => {
            const progression = await (0, gamificationService_1.getUserProgression)(user);
            return {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                level: progression.level,
                xp: progression.xp,
                streak: user.streak,
                pendingEarningsTotal: progression.pendingEarningsTotal,
                multiplier: progression.multiplierPreview.totalMultiplier
            };
        }));
        res.status(200).json(results);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to load user stats" });
    }
}
async function getRiskFlags(_req, res) {
    try {
        const rows = await (0, behaviorService_1.getHighRiskUsers)();
        const mapped = rows.map((row) => ({
            user_id: row.user.user_id,
            name: row.user.name,
            email: row.user.email,
            score: row.score,
            risk_level: row.risk_level
        }));
        res.status(200).json(mapped);
    }
    catch {
        res.status(500).json({ message: "Failed to load risk flags" });
    }
}
