import { NextFunction, Request, Response } from "express";
import { getAdminOverview } from "../services/analyticsService";
import { getActivityHeatmap } from "../services/heatmapService";

function parseDays(req: Request, fallback: number): number {
  const raw = String(req.query.days || "");
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(180, Math.max(1, Math.floor(parsed)));
}

export async function getAdminAnalyticsOverview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parseDays(req, 30);
    const data = await getAdminOverview(days);
    res.status(200).json({ days, ...data });
  } catch (error) {
    next(error);
  }
}

export async function getAdminActivityHeatmap(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parseDays(req, 30);
    const heatmap = await getActivityHeatmap(days);
    res.status(200).json({ days, heatmap });
  } catch (error) {
    next(error);
  }
}
