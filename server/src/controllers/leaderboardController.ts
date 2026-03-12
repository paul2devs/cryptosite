import { Request, Response } from "express";
import {
  getFastestGrowing,
  getHighestStreaks,
  getTopDepositors,
  getWeeklyTopEarnings
} from "../services/leaderboardService";

export async function getDepositorsLeaderboard(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const data = await getTopDepositors();
    res.status(200).json(data);
  } catch {
    res.status(200).json([]);
  }
}

export async function getEarningsLeaderboard(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const data = await getWeeklyTopEarnings();
    res.status(200).json(data);
  } catch {
    res.status(200).json([]);
  }
}

export async function getStreaksLeaderboard(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const data = await getHighestStreaks();
    res.status(200).json(data);
  } catch {
    res.status(200).json([]);
  }
}

export async function getGrowthLeaderboard(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const data = await getFastestGrowing();
    res.status(200).json(data);
  } catch {
    res.status(200).json([]);
  }
}

