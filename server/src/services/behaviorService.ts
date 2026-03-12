import { Op } from "sequelize";
import { Deposit } from "../models/Deposit";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import {
  BehaviorRiskLevel,
  UserBehaviorScore
} from "../models/UserBehaviorScore";
import { Bonus } from "../models/Bonus";

const HIGH_RISK_THRESHOLD_DEFAULT = 80;
const MEDIUM_RISK_THRESHOLD_DEFAULT = 60;

function getHighRiskThreshold(): number {
  const raw = process.env.BEHAVIOR_HIGH_RISK_THRESHOLD;
  const parsed = raw ? Number(raw) : HIGH_RISK_THRESHOLD_DEFAULT;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return HIGH_RISK_THRESHOLD_DEFAULT;
  }
  return parsed;
}

function getMediumRiskThreshold(): number {
  const raw = process.env.BEHAVIOR_MEDIUM_RISK_THRESHOLD;
  const parsed = raw ? Number(raw) : MEDIUM_RISK_THRESHOLD_DEFAULT;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return MEDIUM_RISK_THRESHOLD_DEFAULT;
  }
  return parsed;
}

function classifyRisk(score: number): BehaviorRiskLevel {
  const high = getHighRiskThreshold();
  const medium = getMediumRiskThreshold();
  if (score >= high) {
    return "high";
  }
  if (score >= medium) {
    return "medium";
  }
  return "low";
}

async function getOrCreateBehaviorRow(userId: string): Promise<UserBehaviorScore> {
  const existing = await UserBehaviorScore.findOne({ where: { user_id: userId } });
  if (existing) {
    return existing;
  }
  return UserBehaviorScore.create({
    user_id: userId
  });
}

export async function recordDepositBehavior(user: User, amount: number): Promise<void> {
  const behavior = await getOrCreateBehaviorRow(user.user_id);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const recentDeposits = await Deposit.findAll({
    where: {
      user_id: user.user_id,
      status: "Approved",
      timestamp: { [Op.gte]: weekAgo }
    }
  });

  const totalRecent = recentDeposits.reduce((sum, d) => sum + d.amount, 0);
  const avg =
    recentDeposits.length > 0 ? totalRecent / recentDeposits.length : amount;

  let scoreDelta = 0;

  if (amount > avg * 3 && avg > 0) {
    scoreDelta += 10;
  } else if (amount > avg * 1.5 && avg > 0) {
    scoreDelta += 5;
  } else if (amount < avg * 0.5 && avg > 0) {
    scoreDelta += 2;
  }

  const depositsCount = recentDeposits.length + 1;
  if (depositsCount >= 10) {
    scoreDelta -= 5;
  } else if (depositsCount >= 5) {
    scoreDelta -= 2;
  }

  const activeBonuses = await Bonus.findAll({
    where: {
      start_time: { [Op.lte]: now },
      end_time: { [Op.gt]: now }
    }
  });

  if (activeBonuses.length > 0) {
    scoreDelta += 4;
  }

  const nextScore = Math.max(0, Math.min(100, behavior.score + scoreDelta));
  const riskLevel = classifyRisk(nextScore);

  behavior.score = nextScore;
  behavior.risk_level = riskLevel;
  behavior.updated_at = new Date();
  await behavior.save();

  if (riskLevel === "high") {
    await Notification.create({
      type: "risk_flag",
      message: `High risk behavior detected for user ${user.email}`,
      user_id: null
    });
  }
}

export async function recordWithdrawalAttempt(
  user: User,
  amount: number,
  approved: boolean
): Promise<void> {
  const behavior = await getOrCreateBehaviorRow(user.user_id);

  let scoreDelta = 0;

  if (!approved) {
    scoreDelta += 6;
  }
  if (amount > user.withdrawable_balance * 2 && user.withdrawable_balance > 0) {
    scoreDelta += 5;
  }

  const nextScore = Math.max(0, Math.min(100, behavior.score + scoreDelta));
  const riskLevel = classifyRisk(nextScore);
  behavior.score = nextScore;
  behavior.risk_level = riskLevel;
  behavior.updated_at = new Date();
  await behavior.save();

  if (riskLevel === "high") {
    await Notification.create({
      type: "risk_flag",
      message: `High risk withdrawal behavior detected for user ${user.email}`,
      user_id: null
    });
  }
}

export async function getUserBehaviorSnapshot(
  userId: string
): Promise<{ score: number; risk_level: BehaviorRiskLevel }> {
  const behavior = await getOrCreateBehaviorRow(userId);
  return {
    score: behavior.score,
    risk_level: behavior.risk_level
  };
}

export async function getHighRiskUsers(): Promise<
  Array<{
    user: User;
    score: number;
    risk_level: BehaviorRiskLevel;
  }>
> {
  const rows = await UserBehaviorScore.findAll({
    where: {
      risk_level: "high"
    },
    include: [{ model: User }]
  });

  return rows
    .map((row) => {
      const user = (row as any).User as User | undefined;
      return user
        ? {
            user,
      score: row.score,
      risk_level: row.risk_level
          }
        : null;
    })
    .filter((item): item is { user: User; score: number; risk_level: BehaviorRiskLevel } => !!item);
}

