import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { AuthenticatedRequest } from "../middleware/auth";
import { Withdrawal } from "../models/Withdrawal";
import { User } from "../models/User";
import { Notification } from "../models/Notification";
import { recordWithdrawalAttempt } from "../services/behaviorService";
import { trackUserActivity } from "../services/activityService";
import { reviewWithdrawal } from "../services/financialOperationsService";
import { dispatchNotificationEmail } from "../services/notificationDispatchService";
import { generateReference } from "../domain/transactionRules";
import {
  getUserWithdrawalSummary,
  reserveWithdrawal,
  WithdrawalError
} from "../services/withdrawalService";

export async function createWithdrawal(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { amount, asset, address, network, idempotencyKey } = req.body as {
    amount: number;
    asset?: string;
    address?: string;
    network?: string | null;
    idempotencyKey?: string;
  };

  try {
    const result = await reserveWithdrawal(req.user.userId, {
      asset,
      address,
      network,
      amount,
      idempotencyKey
    });
    const withdrawal = result.withdrawal;

    if (!result.duplicate) {
      const user = await User.findByPk(req.user.userId);
      if (user) {
        const asset = withdrawal.asset || "USD";
        const reference = generateReference("withdrawal", withdrawal.withdrawal_id);
        const message = "Withdrawal request submitted. Your request is currently under review.";
        await Notification.create({
          type: "withdrawal_created",
          message,
          user_id: req.user.userId
        });
        await dispatchNotificationEmail({
          user,
          type: "withdrawal_created",
          message,
          email: {
            sourceId: withdrawal.withdrawal_id,
            subject: `Withdrawal submitted: ${Number(withdrawal.amount)} ${asset}`,
            heading: "Withdrawal request received",
            preheader: "Your withdrawal request has been submitted and is now under review.",
            details: [
              { label: "Reference", value: reference },
              { label: "Amount", value: `${Number(withdrawal.amount)} ${asset}` },
              { label: "Asset", value: asset },
              { label: "Date", value: new Date().toISOString() }
            ],
            statusLabel: "Under review",
            statusTone: "gold",
            ctaLabel: "View withdrawals",
            ctaPath: "/transactions"
          }
        });
        await recordWithdrawalAttempt(user, Number(withdrawal.amount), true);
      }
      await trackUserActivity(req.user.userId, "withdrawal", {
        amount: Number(withdrawal.amount),
        withdrawal_id: withdrawal.withdrawal_id
      });
    }

    res.status(result.duplicate ? 200 : 201).json(withdrawal);
  } catch (error) {
    if (error instanceof WithdrawalError) {
      if (error.status === 400 || error.status === 403 || error.status === 429) {
        const user = await User.findByPk(req.user.userId);
        if (user) {
          await recordWithdrawalAttempt(user, Number(amount), false).catch(() => undefined);
        }
      }
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Failed to create withdrawal" });
  }
}

export async function getUserWithdrawals(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const withdrawals = await Withdrawal.findAll({
      where: { user_id: req.user.userId },
      order: [["timestamp", "DESC"]]
    });
    res.status(200).json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
}

export async function getAllWithdrawals(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const withdrawals = await Withdrawal.findAll({
      include: [{ model: User }],
      order: [["timestamp", "DESC"]]
    });
    res.status(200).json(withdrawals);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch withdrawals" });
  }
}

export async function getWithdrawalSummary(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const summary = await getUserWithdrawalSummary(req.user.userId);
    res.status(200).json(summary);
  } catch (error) {
    if (error instanceof WithdrawalError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Failed to load withdrawal summary" });
  }
}

const LEGACY_STATUS_MAP: Record<string, string> = {
  Pending: "requested",
  Approved: "approved",
  Rejected: "rejected"
};

export async function updateWithdrawalStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const { status } = req.body as {
    status: "Pending" | "Approved" | "Rejected";
  };

  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const detailed = LEGACY_STATUS_MAP[status];
  if (!detailed) {
    res.status(400).json({ message: "Unsupported withdrawal status" });
    return;
  }

  try {
    const withdrawal = await reviewWithdrawal(
      req.user.userId,
      id,
      detailed,
      "Status updated during platform review."
    );
    res.status(200).json(withdrawal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update withdrawal";
    const notFound = message === "Withdrawal not found";
    res.status(notFound ? 404 : 400).json({ message });
  }
}

