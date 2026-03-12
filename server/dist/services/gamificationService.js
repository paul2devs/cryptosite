"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLevelForXp = getLevelForXp;
exports.ensureDefaultLevels = ensureDefaultLevels;
exports.calculateMultiplierComponents = calculateMultiplierComponents;
exports.applyDepositGamification = applyDepositGamification;
exports.getUserProgression = getUserProgression;
const sequelize_1 = require("sequelize");
const Level_1 = require("../models/Level");
const Notification_1 = require("../models/Notification");
const bonusService_1 = require("./bonusService");
const socket_1 = require("../realtime/socket");
const multiplierService_1 = require("./multiplierService");
const emailService_1 = require("./email/emailService");
const STREAK_BONUS_PER_DAY = 0.02;
const STREAK_BONUS_MAX = 0.5;
const TIME_BONUS_MULTIPLIER = 0.1;
const TIME_BONUS_WINDOW_HOURS = 3;
const REFERRAL_BONUS_MULTIPLIER = 0.05;
async function getLevelForXp(xp) {
    const level = (await Level_1.Level.findOne({
        where: { required_xp: { [sequelize_1.Op.lte]: xp } },
        order: [["required_xp", "DESC"]]
    })) ||
        (await Level_1.Level.findOne({
            where: { level_id: 1 }
        }));
    if (!level) {
        throw new Error("Level configuration is missing");
    }
    return level;
}
async function ensureDefaultLevels() {
    const count = await Level_1.Level.count();
    if (count > 0) {
        return;
    }
    const levels = [
        {
            level_id: 1,
            level_name: "Bronze",
            required_xp: 0,
            multiplier_base: 1
        },
        {
            level_id: 2,
            level_name: "Silver",
            required_xp: 200,
            multiplier_base: 1.05
        },
        {
            level_id: 3,
            level_name: "Gold",
            required_xp: 600,
            multiplier_base: 1.1
        },
        {
            level_id: 4,
            level_name: "Platinum",
            required_xp: 1400,
            multiplier_base: 1.2
        },
        {
            level_id: 5,
            level_name: "Diamond",
            required_xp: 2600,
            multiplier_base: 1.35
        }
    ];
    await Level_1.Level.bulkCreate(levels.map((l) => ({
        ...l,
        unlocks: {}
    })));
}
function calculateMultiplierComponents(user, level, createdAt, options) {
    const baseMultiplier = level.multiplier_base;
    const streakBonus = Math.min(user.streak * STREAK_BONUS_PER_DAY, STREAK_BONUS_MAX);
    const now = new Date();
    const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    const timeBonus = hoursSince <= TIME_BONUS_WINDOW_HOURS ? TIME_BONUS_MULTIPLIER : 0;
    const referralBonus = options.hasReferralBonus ? REFERRAL_BONUS_MULTIPLIER : 0;
    const totalMultiplier = baseMultiplier * (1 + streakBonus + timeBonus + referralBonus);
    return {
        baseMultiplier,
        streakBonus,
        timeBonus,
        referralBonus,
        totalMultiplier
    };
}
async function applyDepositGamification(user, deposit, options) {
    const level = await getLevelForXp(user.xp);
    const components = calculateMultiplierComponents(user, level, deposit.timestamp || new Date(), options);
    const bonusMultiplier = await (0, bonusService_1.getActiveBonusMultiplierForCrypto)(deposit.crypto_type);
    const stackedMultiplier = await (0, multiplierService_1.getUserActiveMultiplierFactor)(user.user_id);
    const combinedMultiplier = components.totalMultiplier * bonusMultiplier * stackedMultiplier;
    deposit.multiplier = combinedMultiplier;
    deposit.pending_earning = deposit.amount * combinedMultiplier;
    const previousPending = user.pending_earnings?.total || 0;
    user.pending_earnings = { total: previousPending + deposit.pending_earning };
    const xpGain = Math.round(deposit.amount * level.multiplier_base);
    const previousLevel = user.level;
    user.xp += xpGain;
    const newLevel = await getLevelForXp(user.xp);
    user.level = newLevel.level_id;
    const now = new Date();
    const lastActivity = user.last_activity_at
        ? new Date(user.last_activity_at)
        : null;
    if (!lastActivity) {
        user.streak = 1;
    }
    else {
        const daysDiff = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff === 0) {
            user.streak = user.streak || 1;
        }
        else if (daysDiff === 1) {
            user.streak += 1;
        }
        else if (daysDiff > 1) {
            user.streak = 1;
        }
    }
    user.last_activity_at = now;
    await user.save();
    await deposit.save();
    if (user.level > previousLevel) {
        await Notification_1.Notification.create({
            type: "level_up",
            message: `You reached level ${user.level}`,
            user_id: user.user_id
        });
        (0, socket_1.emitLevelUpEvent)(user, user.level);
        (0, emailService_1.sendLevelUpEmail)({
            to: user.email,
            name: user.name,
            newLevel: user.level,
            multiplierPreview: combinedMultiplier
        });
    }
    if (user.streak > 1) {
        await Notification_1.Notification.create({
            type: "streak_bonus",
            message: `Streak ${user.streak} days active`,
            user_id: user.user_id
        });
    }
}
async function getUserProgression(user) {
    const currentLevel = await getLevelForXp(user.xp);
    const nextLevel = (await Level_1.Level.findOne({
        where: { required_xp: { [sequelize_1.Op.gt]: currentLevel.required_xp } },
        order: [["required_xp", "ASC"]]
    })) || null;
    const xpToNext = nextLevel ? nextLevel.required_xp - user.xp : null;
    const components = calculateMultiplierComponents(user, currentLevel, new Date(), { hasReferralBonus: false });
    const pending = user.pending_earnings?.total !== undefined
        ? Number(user.pending_earnings.total)
        : 0;
    return {
        level: user.level,
        xp: user.xp,
        currentLevel,
        nextLevel,
        xpToNext,
        multiplierPreview: components,
        pendingEarningsTotal: pending,
        withdrawableBalance: user.withdrawable_balance,
        lockedBalance: user.locked_balance
    };
}
