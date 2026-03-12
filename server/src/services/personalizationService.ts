import { Op } from "sequelize";
import { Deposit } from "../models/Deposit";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { UserAIProfile } from "../models/UserAIProfile";
import { getUserBehaviorSnapshot } from "./behaviorService";
import { grantTemporaryMultiplier } from "./multiplierService";
import { ChurnPrediction } from "../models/ChurnPrediction";

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function computeDepositPatternScore(deposits: Deposit[]): number {
  if (deposits.length < 2) return 0.2;
  const times = deposits
    .map((d) => new Date(d.timestamp).getTime())
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) gaps.push((times[i] - times[i - 1]) / (1000 * 60 * 60 * 24));
  const avgGap = gaps.reduce((s, v) => s + v, 0) / gaps.length;
  const consistency = 1 - clamp01(Math.abs(avgGap - 3) / 10);
  const freqBoost = clamp01(7 / Math.max(1, avgGap));
  return clamp01(0.55 * consistency + 0.45 * freqBoost);
}

function computeEngagementScore(user: User, behaviorScore: number): number {
  const streakScore = clamp01(user.streak / 14);
  const behaviorNormalized = clamp01(behaviorScore / 100);
  const levelScore = clamp01(user.level / 6);
  return clamp01(0.45 * streakScore + 0.35 * behaviorNormalized + 0.2 * levelScore);
}

function chooseOptimalBonusType(inputs: {
  depositPatternScore: number;
  engagementScore: number;
  churnRiskScore: number;
  behaviorRiskLevel: "low" | "medium" | "high";
}): string {
  if (inputs.behaviorRiskLevel === "high") return "cooldown_trust_message";
  if (inputs.churnRiskScore >= 0.75) return "retention_bonus";
  if (inputs.depositPatternScore >= 0.7 && inputs.engagementScore >= 0.7) return "loyalty_multiplier";
  if (inputs.depositPatternScore >= 0.65 && inputs.engagementScore < 0.5) return "timed_nudge";
  return "micro_rewards";
}

export async function getOrCreateAIProfile(userId: string): Promise<UserAIProfile> {
  const existing = await UserAIProfile.findOne({ where: { user_id: userId } });
  if (existing) return existing;
  return UserAIProfile.create({ user_id: userId });
}

export async function updateUserAIProfile(user: User): Promise<UserAIProfile> {
  const profile = await getOrCreateAIProfile(user.user_id);
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const deposits = await Deposit.findAll({
    where: { user_id: user.user_id, status: "Approved", timestamp: { [Op.gte]: ninetyDaysAgo } },
    order: [["timestamp", "DESC"]],
    limit: 50
  });

  const behavior = await getUserBehaviorSnapshot(user.user_id);
  const depositPatternScore = computeDepositPatternScore(deposits);
  const engagementScore = computeEngagementScore(user, behavior.score);

  const churnRow = await ChurnPrediction.findOne({ where: { user_id: user.user_id } });
  const churnRiskScore = churnRow ? clamp01(churnRow.probability_score) : 0;

  const bonusType = chooseOptimalBonusType({
    depositPatternScore,
    engagementScore,
    churnRiskScore,
    behaviorRiskLevel: behavior.risk_level
  });

  profile.deposit_pattern_score = depositPatternScore;
  profile.engagement_score = engagementScore;
  profile.churn_risk_score = churnRiskScore;
  profile.optimal_bonus_type = bonusType;
  profile.last_ai_update = now;
  await profile.save();

  return profile;
}

export async function applyPersonalizedIncentives(user: User, profile: UserAIProfile): Promise<void> {
  if (user.bonus_blocked) {
    return;
  }

  if (profile.optimal_bonus_type === "loyalty_multiplier") {
    await grantTemporaryMultiplier({
      user,
      type: "loyalty",
      value: 0.08,
      durationMinutes: 48 * 60
    });
    await Notification.create({
      type: "ai_loyalty",
      message: "Loyalty multiplier enabled for the next 48 hours.",
      user_id: user.user_id
    });
    return;
  }

  if (profile.optimal_bonus_type === "retention_bonus") {
    await grantTemporaryMultiplier({
      user,
      type: "retention",
      value: 0.1,
      durationMinutes: 24 * 60
    });
    await Notification.create({
      type: "ai_retention",
      message: "We activated a time-limited boost to help you get back on track.",
      user_id: user.user_id
    });
    return;
  }

  if (profile.optimal_bonus_type === "micro_rewards") {
    await Notification.create({
      type: "ai_tip",
      message: "Small consistent deposits strengthen streak bonuses and unlock faster rewards.",
      user_id: user.user_id
    });
    return;
  }

  if (profile.optimal_bonus_type === "timed_nudge") {
    await Notification.create({
      type: "ai_timed_nudge",
      message: "Your progress is trending upward—depositing during active bonuses stacks well with your multiplier.",
      user_id: user.user_id
    });
    return;
  }

  if (profile.optimal_bonus_type === "cooldown_trust_message") {
    await Notification.create({
      type: "ai_trust",
      message: "We’re keeping your rewards safe. Continued steady activity improves access to higher benefits.",
      user_id: user.user_id
    });
  }
}

export async function runPersonalizationEngine(): Promise<void> {
  const users = await User.findAll();
  for (const user of users) {
    const profile = await updateUserAIProfile(user);
    const intensity =
      sigmoid((profile.engagement_score - 0.5) * 4) *
      (1 - clamp01(profile.churn_risk_score));

    if (intensity >= 0.25) {
      await applyPersonalizedIncentives(user, profile);
    }
  }
}

