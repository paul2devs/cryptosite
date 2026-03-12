import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { Deposit } from "../models/Deposit";
import { SocialFeedSeen } from "../models/SocialFeedSeen";
import { User } from "../models/User";

export async function getSocialFeed(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const deposits = await Deposit.findAll({
      where: { status: "Approved" },
      order: [["timestamp", "DESC"]],
      limit: 20,
      include: [{ model: User }]
    });

    const seen = await SocialFeedSeen.findAll({
      where: { user_id: req.user.userId }
    });
    const seenIds = new Set(seen.map((s) => s.deposit_id));

    const unseenDeposits = deposits.filter(
      (d) => d.user_id !== req.user?.userId && !seenIds.has(d.deposit_id)
    );

    const feed = unseenDeposits.slice(0, 10).map((d) => {
      const name =
        (d as any).User?.name || (d as any).User?.email || "Trader";
      const alias = `${name.slice(0, 3)}***`;

      return {
        deposit_id: d.deposit_id,
        alias,
        amount: d.amount,
        crypto_type: d.crypto_type,
        timestamp: d.timestamp
      };
    });

    await Promise.all(
      feed.map((item) =>
        SocialFeedSeen.create({
          user_id: req.user!.userId,
          deposit_id: item.deposit_id
        })
      )
    );

    res.status(200).json(feed);
  } catch (error) {
    res.status(500).json({ message: "Failed to load social feed" });
  }
}

