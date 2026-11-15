import { Model, ModelStatic, Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import { ActiveMultiplier } from "../models/ActiveMultiplier";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { BonusCredit } from "../models/BonusCredit";
import { ChurnPrediction } from "../models/ChurnPrediction";
import { DailyPerformanceSnapshot } from "../models/DailyPerformanceSnapshot";
import { Deposit } from "../models/Deposit";
import { EarningsLog } from "../models/EarningsLog";
import { InvestmentLevelHistory } from "../models/InvestmentLevelHistory";
import { InvestmentPosition } from "../models/InvestmentPosition";
import { LedgerAccount } from "../models/LedgerAccount";
import { LedgerEntry } from "../models/LedgerEntry";
import { MembershipHistory } from "../models/MembershipHistory";
import { Notification } from "../models/Notification";
import { PasswordResetToken } from "../models/PasswordResetToken";
import { Referral } from "../models/Referral";
import { ReferralReward } from "../models/ReferralReward";
import { SocialFeedSeen } from "../models/SocialFeedSeen";
import { User } from "../models/User";
import { UserActivityEvent } from "../models/UserActivityEvent";
import { UserAIProfile } from "../models/UserAIProfile";
import { UserBehaviorScore } from "../models/UserBehaviorScore";
import { UserBenefitActivation } from "../models/UserBenefitActivation";
import { UserInvestmentLevel } from "../models/UserInvestmentLevel";
import { UserInvestmentLevelBenefit } from "../models/UserInvestmentLevelBenefit";
import { UserMembership } from "../models/UserMembership";
import { UserReward } from "../models/UserReward";
import { UserSeenEvent } from "../models/UserSeenEvent";
import { Withdrawal } from "../models/Withdrawal";

/**
 * Every model that stores rows scoped to a single user via `user_id`.
 * Dependent rows are removed explicitly, in dependency order, before the user
 * row itself so deletion never relies on database-level FK cascades.
 */
const USER_SCOPED_MODELS: ModelStatic<Model>[] = [
  ActiveMultiplier,
  BonusCredit,
  ChurnPrediction,
  DailyPerformanceSnapshot,
  EarningsLog,
  InvestmentLevelHistory,
  InvestmentPosition,
  LedgerEntry,
  MembershipHistory,
  Notification,
  PasswordResetToken,
  SocialFeedSeen,
  UserActivityEvent,
  UserAIProfile,
  UserBehaviorScore,
  UserBenefitActivation,
  UserInvestmentLevelBenefit,
  UserInvestmentLevel,
  UserMembership,
  UserReward,
  UserSeenEvent,
  LedgerAccount,
  Withdrawal,
  Deposit
];

async function destroyUserData(userId: string, transaction: Transaction): Promise<void> {
  for (const model of USER_SCOPED_MODELS) {
    await model.destroy({ where: { user_id: userId }, transaction });
  }
  await ReferralReward.destroy({
    where: { [Op.or]: [{ user_id: userId }, { referred_user_id: userId }] },
    transaction
  });
  await Referral.destroy({
    where: { [Op.or]: [{ referrer_id: userId }, { referred_user_id: userId }] },
    transaction
  });
  await User.update({ referred_by: null }, { where: { referred_by: userId }, transaction });
}

export interface DeletedUserSummary {
  userId: string;
  name: string;
  email: string;
}

export async function deleteUserAccount(
  adminId: string,
  userId: string,
  reason: string
): Promise<DeletedUserSummary> {
  const trimmed = (reason || "").trim();
  if (!trimmed) {
    throw new Error("A recorded reason is required to delete a user");
  }

  return sequelize.transaction(async (transaction) => {
    const target = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!target) {
      throw new Error("User not found");
    }
    if (target.is_admin) {
      throw new Error("Administrator accounts cannot be deleted");
    }

    await destroyUserData(userId, transaction);
    await User.destroy({ where: { user_id: userId }, transaction });
    await AdminAuditLog.create(
      {
        admin_id: adminId,
        action: "user_deleted",
        entity_type: "user",
        entity_id: userId,
        reason: trimmed,
        metadata: { name: target.name, email: target.email }
      },
      { transaction }
    );

    return { userId, name: target.name, email: target.email };
  });
}

export async function purgeNonAdminUsers(): Promise<number> {
  const users = await User.findAll({ where: { is_admin: false }, attributes: ["user_id"] });
  let deleted = 0;
  for (const user of users) {
    await sequelize.transaction(async (transaction) => {
      await destroyUserData(user.user_id, transaction);
      await User.destroy({ where: { user_id: user.user_id }, transaction });
    });
    deleted += 1;
  }
  return deleted;
}
