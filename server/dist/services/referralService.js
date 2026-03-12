"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralDashboard = getReferralDashboard;
exports.grantReferralRewardsOnApprovedDeposit = grantReferralRewardsOnApprovedDeposit;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const Notification_1 = require("../models/Notification");
const Referral_1 = require("../models/Referral");
const ReferralReward_1 = require("../models/ReferralReward");
const User_1 = require("../models/User");
const multiplierService_1 = require("./multiplierService");
const emailService_1 = require("./email/emailService");
function isLikelySelfReferral(referrer, referred) {
    if (referrer.email.toLowerCase() === referred.email.toLowerCase()) {
        return true;
    }
    const rWallet = Array.isArray(referrer.crypto_wallets) ? referrer.crypto_wallets : [];
    const uWallet = Array.isArray(referred.crypto_wallets) ? referred.crypto_wallets : [];
    const rAddrs = new Set(rWallet.map((w) => String(w?.address || "").trim()).filter(Boolean));
    for (const w of uWallet) {
        const addr = String(w?.address || "").trim();
        if (addr && rAddrs.has(addr))
            return true;
    }
    return false;
}
async function getReferralDashboard(userId) {
    const user = await User_1.User.findByPk(userId);
    if (!user) {
        throw new Error("User not found");
    }
    const referrals = await Referral_1.Referral.findAll({ where: { referrer_id: userId } });
    const referredIds = referrals.map((r) => r.referred_user_id);
    const active = referredIds.length
        ? await Deposit_1.Deposit.count({
            where: {
                user_id: { [sequelize_1.Op.in]: referredIds },
                status: "Approved"
            }
        })
        : 0;
    const rewards = await ReferralReward_1.ReferralReward.findAll({
        where: { user_id: userId },
        order: [["created_at", "DESC"]]
    });
    const totalEarned = rewards
        .filter((r) => r.status === "earned")
        .reduce((sum, r) => sum + r.reward_value, 0);
    return {
        referralCode: user.referral_code,
        totalInvited: referrals.length,
        activeReferrals: active,
        totalEarningsValue: totalEarned,
        rewards: rewards.map((r) => ({
            id: r.id,
            reward_type: r.reward_type,
            reward_value: r.reward_value,
            status: r.status,
            created_at: r.created_at
        }))
    };
}
async function grantReferralRewardsOnApprovedDeposit(deposit) {
    const referredUser = await User_1.User.findByPk(deposit.user_id);
    if (!referredUser || !referredUser.referred_by) {
        return;
    }
    const referrer = await User_1.User.findByPk(referredUser.referred_by);
    if (!referrer)
        return;
    const referral = await Referral_1.Referral.findOne({
        where: {
            referrer_id: referrer.user_id,
            referred_user_id: referredUser.user_id
        }
    });
    if (!referral)
        return;
    const alreadyRewarded = await ReferralReward_1.ReferralReward.findOne({
        where: {
            user_id: referrer.user_id,
            referred_user_id: referredUser.user_id,
            reward_type: "referrer_multiplier",
            status: { [sequelize_1.Op.in]: ["pending", "earned", "blocked"] }
        }
    });
    if (alreadyRewarded)
        return;
    const fraudLikely = isLikelySelfReferral(referrer, referredUser);
    if (fraudLikely || referrer.bonus_blocked || referredUser.bonus_blocked) {
        await ReferralReward_1.ReferralReward.create({
            user_id: referrer.user_id,
            referred_user_id: referredUser.user_id,
            reward_type: "referrer_multiplier",
            reward_value: 0,
            status: "blocked"
        });
        await Notification_1.Notification.create({
            type: "referral_blocked",
            message: "Referral rewards were blocked due to risk checks.",
            user_id: referrer.user_id
        });
        return;
    }
    const value = deposit.amount >= 500 ? 0.12 : deposit.amount >= 100 ? 0.08 : 0.05;
    const durationMinutes = deposit.amount >= 500 ? 72 * 60 : 48 * 60;
    await ReferralReward_1.ReferralReward.create({
        user_id: referrer.user_id,
        referred_user_id: referredUser.user_id,
        reward_type: "referrer_multiplier",
        reward_value: value,
        status: "earned"
    });
    await ReferralReward_1.ReferralReward.create({
        user_id: referredUser.user_id,
        referred_user_id: referredUser.user_id,
        reward_type: "referee_boost",
        reward_value: 0.05,
        status: "earned"
    });
    await (0, multiplierService_1.grantTemporaryMultiplier)({
        user: referrer,
        type: "referral",
        value,
        durationMinutes
    });
    await (0, multiplierService_1.grantTemporaryMultiplier)({
        user: referredUser,
        type: "referral",
        value: 0.05,
        durationMinutes: 24 * 60
    });
    await Notification_1.Notification.create({
        type: "referral_reward",
        message: `Referral bonus activated: +${Math.round(value * 100)}% multiplier for a limited time.`,
        user_id: referrer.user_id
    });
    (0, emailService_1.sendReferralRewardEmail)({
        to: referrer.email,
        name: referrer.name,
        bonusPercent: value * 100,
        durationHours: Math.round(durationMinutes / 60)
    });
    await Notification_1.Notification.create({
        type: "referral_welcome_boost",
        message: "Welcome boost activated for your first deposits.",
        user_id: referredUser.user_id
    });
}
