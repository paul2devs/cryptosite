import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { User } from "../models/User";
import { getOrCreateAIProfile, updateUserAIProfile } from "../services/personalizationService";
import { ChurnPrediction } from "../models/ChurnPrediction";
import { getUserBehaviorSnapshot } from "../services/behaviorService";

export async function getMyAIProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const profile = await getOrCreateAIProfile(user.user_id);
    const churn = await ChurnPrediction.findOne({ where: { user_id: user.user_id } });
    const behavior = await getUserBehaviorSnapshot(user.user_id);

    res.status(200).json({
      user_id: user.user_id,
      deposit_pattern_score: profile.deposit_pattern_score,
      engagement_score: profile.engagement_score,
      churn_risk_score: churn ? churn.probability_score : profile.churn_risk_score,
      optimal_bonus_type: profile.optimal_bonus_type,
      last_ai_update: profile.last_ai_update,
      behavior_score: behavior.score,
      behavior_risk_level: behavior.risk_level
    });
  } catch {
    res.status(500).json({ message: "Failed to load AI profile" });
  }
}

export async function refreshMyAIProfile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const profile = await updateUserAIProfile(user);
    res.status(200).json(profile);
  } catch {
    res.status(500).json({ message: "Failed to refresh AI profile" });
  }
}

