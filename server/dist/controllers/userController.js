"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentXpLevel = getCurrentXpLevel;
const gamificationService_1 = require("../services/gamificationService");
const User_1 = require("../models/User");
const depositLevelService_1 = require("../services/depositLevelService");
async function getCurrentXpLevel(req, res) {
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
        const progression = await (0, gamificationService_1.getUserProgression)(user);
        const depositStats = await (0, depositLevelService_1.calculateDepositLevelForUser)(user.user_id);
        res.status(200).json({
            level: progression.level,
            xp: progression.xp,
            currentLevel: {
                level_id: progression.currentLevel.level_id,
                level_name: progression.currentLevel.level_name,
                required_xp: progression.currentLevel.required_xp,
                multiplier_base: progression.currentLevel.multiplier_base
            },
            nextLevel: progression.nextLevel
                ? {
                    level_id: progression.nextLevel.level_id,
                    level_name: progression.nextLevel.level_name,
                    required_xp: progression.nextLevel.required_xp,
                    multiplier_base: progression.nextLevel.multiplier_base
                }
                : null,
            xpToNext: progression.xpToNext,
            multiplierPreview: progression.multiplierPreview,
            pendingEarningsTotal: progression.pendingEarningsTotal,
            streak: user.streak,
            withdrawableBalance: progression.withdrawableBalance ?? 0,
            lockedBalance: progression.lockedBalance ?? 0,
            depositLevel: depositStats.level,
            totalDepositedUsd: depositStats.totalDepositedUsd,
            depositCurrentLevelRequiredTotal: depositStats.currentLevelRequiredTotal,
            depositNextLevel: depositStats.nextLevel,
            depositNextLevelRequiredTotal: depositStats.nextLevelRequiredTotal,
            depositRemainingToNext: depositStats.remainingToNext
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to load progression" });
    }
}
