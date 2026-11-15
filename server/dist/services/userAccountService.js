"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = deleteUserAccount;
exports.purgeNonAdminUsers = purgeNonAdminUsers;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const ActiveMultiplier_1 = require("../models/ActiveMultiplier");
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const BonusCredit_1 = require("../models/BonusCredit");
const ChurnPrediction_1 = require("../models/ChurnPrediction");
const DailyPerformanceSnapshot_1 = require("../models/DailyPerformanceSnapshot");
const Deposit_1 = require("../models/Deposit");
const EarningsLog_1 = require("../models/EarningsLog");
const InvestmentLevelHistory_1 = require("../models/InvestmentLevelHistory");
const InvestmentPosition_1 = require("../models/InvestmentPosition");
const LedgerAccount_1 = require("../models/LedgerAccount");
const LedgerEntry_1 = require("../models/LedgerEntry");
const MembershipHistory_1 = require("../models/MembershipHistory");
const Notification_1 = require("../models/Notification");
const PasswordResetToken_1 = require("../models/PasswordResetToken");
const Referral_1 = require("../models/Referral");
const ReferralReward_1 = require("../models/ReferralReward");
const SocialFeedSeen_1 = require("../models/SocialFeedSeen");
const User_1 = require("../models/User");
const UserActivityEvent_1 = require("../models/UserActivityEvent");
const UserAIProfile_1 = require("../models/UserAIProfile");
const UserBehaviorScore_1 = require("../models/UserBehaviorScore");
const UserBenefitActivation_1 = require("../models/UserBenefitActivation");
const UserInvestmentLevel_1 = require("../models/UserInvestmentLevel");
const UserInvestmentLevelBenefit_1 = require("../models/UserInvestmentLevelBenefit");
const UserMembership_1 = require("../models/UserMembership");
const UserReward_1 = require("../models/UserReward");
const UserSeenEvent_1 = require("../models/UserSeenEvent");
const Withdrawal_1 = require("../models/Withdrawal");
/**
 * Every model that stores rows scoped to a single user via `user_id`.
 * Dependent rows are removed explicitly, in dependency order, before the user
 * row itself so deletion never relies on database-level FK cascades.
 */
const USER_SCOPED_MODELS = [
    ActiveMultiplier_1.ActiveMultiplier,
    BonusCredit_1.BonusCredit,
    ChurnPrediction_1.ChurnPrediction,
    DailyPerformanceSnapshot_1.DailyPerformanceSnapshot,
    EarningsLog_1.EarningsLog,
    InvestmentLevelHistory_1.InvestmentLevelHistory,
    InvestmentPosition_1.InvestmentPosition,
    LedgerEntry_1.LedgerEntry,
    MembershipHistory_1.MembershipHistory,
    Notification_1.Notification,
    PasswordResetToken_1.PasswordResetToken,
    SocialFeedSeen_1.SocialFeedSeen,
    UserActivityEvent_1.UserActivityEvent,
    UserAIProfile_1.UserAIProfile,
    UserBehaviorScore_1.UserBehaviorScore,
    UserBenefitActivation_1.UserBenefitActivation,
    UserInvestmentLevelBenefit_1.UserInvestmentLevelBenefit,
    UserInvestmentLevel_1.UserInvestmentLevel,
    UserMembership_1.UserMembership,
    UserReward_1.UserReward,
    UserSeenEvent_1.UserSeenEvent,
    LedgerAccount_1.LedgerAccount,
    Withdrawal_1.Withdrawal,
    Deposit_1.Deposit
];
async function destroyUserData(userId, transaction) {
    for (const model of USER_SCOPED_MODELS) {
        await model.destroy({ where: { user_id: userId }, transaction });
    }
    await ReferralReward_1.ReferralReward.destroy({
        where: { [sequelize_1.Op.or]: [{ user_id: userId }, { referred_user_id: userId }] },
        transaction
    });
    await Referral_1.Referral.destroy({
        where: { [sequelize_1.Op.or]: [{ referrer_id: userId }, { referred_user_id: userId }] },
        transaction
    });
    await User_1.User.update({ referred_by: null }, { where: { referred_by: userId }, transaction });
}
async function deleteUserAccount(adminId, userId, reason) {
    const trimmed = (reason || "").trim();
    if (!trimmed) {
        throw new Error("A recorded reason is required to delete a user");
    }
    return database_1.sequelize.transaction(async (transaction) => {
        const target = await User_1.User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!target) {
            throw new Error("User not found");
        }
        if (target.is_admin) {
            throw new Error("Administrator accounts cannot be deleted");
        }
        await destroyUserData(userId, transaction);
        await User_1.User.destroy({ where: { user_id: userId }, transaction });
        await AdminAuditLog_1.AdminAuditLog.create({
            admin_id: adminId,
            action: "user_deleted",
            entity_type: "user",
            entity_id: userId,
            reason: trimmed,
            metadata: { name: target.name, email: target.email }
        }, { transaction });
        return { userId, name: target.name, email: target.email };
    });
}
async function purgeNonAdminUsers() {
    const users = await User_1.User.findAll({ where: { is_admin: false }, attributes: ["user_id"] });
    let deleted = 0;
    for (const user of users) {
        await database_1.sequelize.transaction(async (transaction) => {
            await destroyUserData(user.user_id, transaction);
            await User_1.User.destroy({ where: { user_id: user.user_id }, transaction });
        });
        deleted += 1;
    }
    return deleted;
}
