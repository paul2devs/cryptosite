import { Request, Response } from "express";
import { User } from "../models/User";
import { getUserProgression } from "../services/gamificationService";
import { getHighRiskUsers } from "../services/behaviorService";

export async function getUserStats(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const users = await User.findAll();
    const results = await Promise.all(
      users.map(async (user) => {
        const progression = await getUserProgression(user);
        return {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          level: progression.level,
          xp: progression.xp,
          streak: user.streak,
          pendingEarningsTotal: progression.pendingEarningsTotal,
          multiplier: progression.multiplierPreview.totalMultiplier
        };
      })
    );

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ message: "Failed to load user stats" });
  }
}

export async function getRiskFlags(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const rows = await getHighRiskUsers();
    const mapped = rows.map((row) => ({
      user_id: row.user.user_id,
      name: row.user.name,
      email: row.user.email,
      score: row.score,
      risk_level: row.risk_level
    }));
    res.status(200).json(mapped);
  } catch {
    res.status(500).json({ message: "Failed to load risk flags" });
  }
}

