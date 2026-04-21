"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentXpLevel = getCurrentXpLevel;
exports.getSettings = getSettings;
exports.changePassword = changePassword;
exports.addWithdrawalWallet = addWithdrawalWallet;
exports.removeWithdrawalWallet = removeWithdrawalWallet;
exports.updateNotificationSettings = updateNotificationSettings;
exports.updateLanguage = updateLanguage;
exports.deleteAccount = deleteAccount;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = require("crypto");
const express_validator_1 = require("express-validator");
const database_1 = require("../config/database");
const gamificationService_1 = require("../services/gamificationService");
const User_1 = require("../models/User");
const depositLevelService_1 = require("../services/depositLevelService");
const Notification_1 = require("../models/Notification");
const Deposit_1 = require("../models/Deposit");
const Withdrawal_1 = require("../models/Withdrawal");
const Referral_1 = require("../models/Referral");
const ReferralReward_1 = require("../models/ReferralReward");
const PasswordResetToken_1 = require("../models/PasswordResetToken");
const UserActivityEvent_1 = require("../models/UserActivityEvent");
const UserBehaviorScore_1 = require("../models/UserBehaviorScore");
const ActiveMultiplier_1 = require("../models/ActiveMultiplier");
const EarningsLog_1 = require("../models/EarningsLog");
const SocialFeedSeen_1 = require("../models/SocialFeedSeen");
const UserSeenEvent_1 = require("../models/UserSeenEvent");
const UserAIProfile_1 = require("../models/UserAIProfile");
const ChurnPrediction_1 = require("../models/ChurnPrediction");
const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const ALLOWED_LANGUAGES = new Set(["en", "es", "fr", "de", "pt"]);
function defaultAccountSettings() {
    return {
        notifications: {
            deposit_updates: true,
            withdrawal_updates: true,
            rewards_bonuses: true,
            announcements: true
        },
        preferences: {
            language: "en"
        },
        withdrawal_wallets: []
    };
}
function normalizeSettings(raw) {
    const base = defaultAccountSettings();
    if (!raw || typeof raw !== "object") {
        return base;
    }
    const parsed = raw;
    const notifications = (parsed.notifications ?? {});
    const preferences = (parsed.preferences ?? {});
    const wallets = Array.isArray(parsed.withdrawal_wallets) ? parsed.withdrawal_wallets : [];
    return {
        notifications: {
            deposit_updates: typeof notifications.deposit_updates === "boolean"
                ? notifications.deposit_updates
                : base.notifications.deposit_updates,
            withdrawal_updates: typeof notifications.withdrawal_updates === "boolean"
                ? notifications.withdrawal_updates
                : base.notifications.withdrawal_updates,
            rewards_bonuses: typeof notifications.rewards_bonuses === "boolean"
                ? notifications.rewards_bonuses
                : base.notifications.rewards_bonuses,
            announcements: typeof notifications.announcements === "boolean"
                ? notifications.announcements
                : base.notifications.announcements
        },
        preferences: {
            language: typeof preferences.language === "string" && ALLOWED_LANGUAGES.has(preferences.language)
                ? preferences.language
                : base.preferences.language
        },
        withdrawal_wallets: wallets
            .filter((wallet) => wallet && typeof wallet === "object")
            .map((wallet) => {
            const w = wallet;
            return {
                wallet_id: typeof w.wallet_id === "string" && w.wallet_id.length > 0
                    ? w.wallet_id
                    : (0, crypto_1.randomUUID)(),
                asset: typeof w.asset === "string" ? w.asset : "BTC",
                address: typeof w.address === "string" ? w.address.trim() : "",
                network: typeof w.network === "string" ? w.network : null
            };
        })
            .filter((wallet) => wallet.address.length > 0)
    };
}
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
async function getSettings(req, res) {
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
        const settings = normalizeSettings(user.account_settings);
        res.status(200).json({
            account: {
                user_id: user.user_id,
                email: user.email,
                level: user.level,
                status: "Active"
            },
            settings
        });
    }
    catch {
        res.status(500).json({ message: "Failed to load settings" });
    }
}
async function changePassword(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { currentPassword, newPassword } = req.body;
    if (!PASSWORD_STRENGTH_REGEX.test(newPassword || "")) {
        res.status(400).json({
            message: "Password must be at least 8 characters and include uppercase, lowercase, and a number."
        });
        return;
    }
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const valid = await bcrypt_1.default.compare(String(currentPassword || ""), user.password);
        if (!valid) {
            res.status(400).json({ message: "Current password is incorrect." });
            return;
        }
        user.password = await bcrypt_1.default.hash(newPassword, Number(process.env.BCRYPT_SALT_ROUNDS || 10));
        await user.save();
        res.status(200).json({ message: "Password updated successfully." });
    }
    catch {
        res.status(500).json({ message: "Failed to update password" });
    }
}
async function addWithdrawalWallet(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { asset, address, network } = req.body;
    const trimmedAddress = String(address || "").trim();
    const normalizedAsset = String(asset || "").trim().toUpperCase();
    if (!trimmedAddress || !normalizedAsset) {
        res.status(400).json({ message: "Asset and address are required." });
        return;
    }
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const settings = normalizeSettings(user.account_settings);
        const duplicate = settings.withdrawal_wallets.some((wallet) => wallet.asset === normalizedAsset &&
            wallet.address.toLowerCase() === trimmedAddress.toLowerCase() &&
            String(wallet.network || "").toUpperCase() === String(network || "").toUpperCase());
        if (duplicate) {
            res.status(409).json({ message: "Wallet already exists." });
            return;
        }
        settings.withdrawal_wallets.push({
            wallet_id: (0, crypto_1.randomUUID)(),
            asset: normalizedAsset,
            address: trimmedAddress,
            network: typeof network === "string" && network.trim().length > 0 ? network.trim() : null
        });
        user.account_settings = settings;
        await user.save();
        res.status(201).json({ wallets: settings.withdrawal_wallets });
    }
    catch {
        res.status(500).json({ message: "Failed to save wallet" });
    }
}
async function removeWithdrawalWallet(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { walletId } = req.params;
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const settings = normalizeSettings(user.account_settings);
        const nextWallets = settings.withdrawal_wallets.filter((w) => w.wallet_id !== walletId);
        if (nextWallets.length === settings.withdrawal_wallets.length) {
            res.status(404).json({ message: "Wallet not found." });
            return;
        }
        settings.withdrawal_wallets = nextWallets;
        user.account_settings = settings;
        await user.save();
        res.status(200).json({ wallets: settings.withdrawal_wallets });
    }
    catch {
        res.status(500).json({ message: "Failed to remove wallet" });
    }
}
async function updateNotificationSettings(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { deposit_updates, withdrawal_updates, rewards_bonuses, announcements } = req.body;
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const settings = normalizeSettings(user.account_settings);
        settings.notifications = {
            deposit_updates: Boolean(deposit_updates),
            withdrawal_updates: Boolean(withdrawal_updates),
            rewards_bonuses: Boolean(rewards_bonuses),
            announcements: Boolean(announcements)
        };
        user.account_settings = settings;
        await user.save();
        res.status(200).json({ notifications: settings.notifications });
    }
    catch {
        res.status(500).json({ message: "Failed to update notification settings" });
    }
}
async function updateLanguage(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { language } = req.body;
    if (!ALLOWED_LANGUAGES.has(language)) {
        res.status(400).json({ message: "Unsupported language." });
        return;
    }
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const settings = normalizeSettings(user.account_settings);
        settings.preferences.language = language;
        user.account_settings = settings;
        await user.save();
        res.status(200).json({ language: settings.preferences.language });
    }
    catch {
        res.status(500).json({ message: "Failed to update language" });
    }
}
async function deleteAccount(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { password } = req.body;
    if (!password || password.length < 8) {
        res.status(400).json({ message: "Password confirmation is required." });
        return;
    }
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const valid = await bcrypt_1.default.compare(password, user.password);
        if (!valid) {
            res.status(400).json({ message: "Password is incorrect." });
            return;
        }
        await database_1.sequelize.transaction(async (transaction) => {
            await Notification_1.Notification.destroy({ where: { user_id: user.user_id }, transaction });
            await Deposit_1.Deposit.destroy({ where: { user_id: user.user_id }, transaction });
            await Withdrawal_1.Withdrawal.destroy({ where: { user_id: user.user_id }, transaction });
            await Referral_1.Referral.destroy({ where: { referrer_id: user.user_id }, transaction });
            await Referral_1.Referral.destroy({ where: { referred_user_id: user.user_id }, transaction });
            await ReferralReward_1.ReferralReward.destroy({ where: { user_id: user.user_id }, transaction });
            await ReferralReward_1.ReferralReward.destroy({ where: { referred_user_id: user.user_id }, transaction });
            await PasswordResetToken_1.PasswordResetToken.destroy({ where: { user_id: user.user_id }, transaction });
            await UserActivityEvent_1.UserActivityEvent.destroy({ where: { user_id: user.user_id }, transaction });
            await UserBehaviorScore_1.UserBehaviorScore.destroy({ where: { user_id: user.user_id }, transaction });
            await ActiveMultiplier_1.ActiveMultiplier.destroy({ where: { user_id: user.user_id }, transaction });
            await EarningsLog_1.EarningsLog.destroy({ where: { user_id: user.user_id }, transaction });
            await SocialFeedSeen_1.SocialFeedSeen.destroy({ where: { user_id: user.user_id }, transaction });
            await UserSeenEvent_1.UserSeenEvent.destroy({ where: { user_id: user.user_id }, transaction });
            await UserAIProfile_1.UserAIProfile.destroy({ where: { user_id: user.user_id }, transaction });
            await ChurnPrediction_1.ChurnPrediction.destroy({ where: { user_id: user.user_id }, transaction });
            await User_1.User.destroy({ where: { user_id: user.user_id }, transaction });
        });
        res.clearCookie("accessToken", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });
        res.status(200).json({ message: "Account deleted successfully." });
    }
    catch {
        res.status(500).json({ message: "Failed to delete account" });
    }
}
