import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getPortfolioSummary } from "../services/portfolioService";

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

