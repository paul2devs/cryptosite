import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getUserProgression } from "../services/gamificationService";
import { User } from "../models/User";
import { calculateDepositLevelForUser } from "../services/depositLevelService";

export async function getCurrentXpLevel(
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

    const progression = await getUserProgression(user);
    const depositStats = await calculateDepositLevelForUser(user.user_id);

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
  } catch (error) {
    res.status(500).json({ message: "Failed to load progression" });
  }
}

