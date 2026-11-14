import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getPortfolioOverview, getPortfolioSummary } from "../services/portfolioService";

export async function getPortfolio(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const summary = await getPortfolioSummary(req.user.userId);
    res.status(200).json(summary);
  } catch (error) {
    res.status(500).json({ message: "Failed to load portfolio" });
  }
}

export async function getPortfolioOverviewHandler(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const range = String(req.query.range || "30d");
    res.status(200).json(await getPortfolioOverview(req.user.userId, range));
  } catch (error) {
    res.status(500).json({ message: "Failed to load portfolio" });
  }
}
