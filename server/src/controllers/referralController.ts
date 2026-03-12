import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { getReferralDashboard } from "../services/referralService";

export async function getMyReferralDashboard(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const dashboard = await getReferralDashboard(req.user.userId);
    res.status(200).json(dashboard);
  } catch (error: any) {
    res.status(500).json({ message: error?.message || "Failed to load referral dashboard" });
  }
}

