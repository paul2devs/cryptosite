import { Op } from "sequelize";
import { Deposit } from "../models/Deposit";
import { Notification } from "../models/Notification";
import { Referral } from "../models/Referral";
import { ReferralReward } from "../models/ReferralReward";
import { User } from "../models/User";
import { grantTemporaryMultiplier } from "./multiplierService";
import { sendReferralRewardEmail } from "./email/emailService";

function isLikelySelfReferral(referrer: User, referred: User): boolean {
  if (referrer.email.toLowerCase() === referred.email.toLowerCase()) {
    return true;
  }
  const rWallet = Array.isArray(referrer.crypto_wallets) ? referrer.crypto_wallets : [];
  const uWallet = Array.isArray(referred.crypto_wallets) ? referred.crypto_wallets : [];
  const rAddrs = new Set(
    (rWallet as any[]).map((w) => String(w?.address || "").trim()).filter(Boolean)
  );
  for (const w of uWallet as any[]) {
    const addr = String(w?.address || "").trim();
    if (addr && rAddrs.has(addr)) return true;
  }
  return false;
}

export async function getReferralDashboard(userId: string): Promise<{
  referralCode: string | null;
  totalInvited: number;
  activeReferrals: number;
  totalEarningsValue: number;
  rewards: Array<{
    id: string;
    reward_type: string;
    reward_value: number;
    status: string;
    created_at: Date;
  }>;
}> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const referrals = await Referral.findAll({ where: { referrer_id: userId } });
  const referredIds = referrals.map((r) => r.referred_user_id);

  const active = referredIds.length
    ? await Deposit.count({
        where: {
          user_id: { [Op.in]: referredIds },
          status: "Approved"
        }
      })
    : 0;

  const rewards = await ReferralReward.findAll({
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

export async function grantReferralRewardsOnApprovedDeposit(
  deposit: Deposit
): Promise<void> {
  const referredUser = await User.findByPk(deposit.user_id);
  if (!referredUser || !referredUser.referred_by) {
    return;
  }

  const referrer = await User.findByPk(referredUser.referred_by);
  if (!referrer) return;

  const referral = await Referral.findOne({
    where: {
      referrer_id: referrer.user_id,
      referred_user_id: referredUser.user_id
    }
  });
  if (!referral) return;

  const alreadyRewarded = await ReferralReward.findOne({
    where: {
      user_id: referrer.user_id,
      referred_user_id: referredUser.user_id,
      reward_type: "referrer_multiplier",
      status: { [Op.in]: ["pending", "earned", "blocked"] }
    }
  });
  if (alreadyRewarded) return;

  const fraudLikely = isLikelySelfReferral(referrer, referredUser);
  if (fraudLikely || referrer.bonus_blocked || referredUser.bonus_blocked) {
    await ReferralReward.create({
      user_id: referrer.user_id,
      referred_user_id: referredUser.user_id,
      reward_type: "referrer_multiplier",
      reward_value: 0,
      status: "blocked"
    });
    await Notification.create({
      type: "referral_blocked",
      message: "Referral rewards were blocked due to risk checks.",
      user_id: referrer.user_id
    });
    return;
  }

  const value = deposit.amount >= 500 ? 0.12 : deposit.amount >= 100 ? 0.08 : 0.05;
  const durationMinutes = deposit.amount >= 500 ? 72 * 60 : 48 * 60;

  await ReferralReward.create({
    user_id: referrer.user_id,
    referred_user_id: referredUser.user_id,
    reward_type: "referrer_multiplier",
    reward_value: value,
    status: "earned"
  });

  await ReferralReward.create({
    user_id: referredUser.user_id,
    referred_user_id: referredUser.user_id,
    reward_type: "referee_boost",
    reward_value: 0.05,
    status: "earned"
  });

  await grantTemporaryMultiplier({
    user: referrer,
    type: "referral",
    value,
    durationMinutes
  });

  await grantTemporaryMultiplier({
    user: referredUser,
    type: "referral",
    value: 0.05,
    durationMinutes: 24 * 60
  });

  await Notification.create({
    type: "referral_reward",
    message: `Referral bonus activated: +${Math.round(value * 100)}% multiplier for a limited time.`,
    user_id: referrer.user_id
  });
  sendReferralRewardEmail({
    to: referrer.email,
    name: referrer.name,
    bonusPercent: value * 100,
    durationHours: Math.round(durationMinutes / 60)
  });

  await Notification.create({
    type: "referral_welcome_boost",
    message: "Welcome boost activated for your first deposits.",
    user_id: referredUser.user_id
  });
}

