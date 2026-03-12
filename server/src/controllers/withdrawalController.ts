import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { AuthenticatedRequest } from "../middleware/auth";
import { Withdrawal } from "../models/Withdrawal";
import { User } from "../models/User";
import { Notification } from "../models/Notification";
import { recordWithdrawalAttempt } from "../services/behaviorService";
import { trackUserActivity } from "../services/activityService";
import { calculateDepositLevelForUser } from "../services/depositLevelService";
import { sendWithdrawalStatusEmail } from "../services/email/emailService";

function getWithdrawalMinLevel(): number {
  const raw = process.env.WITHDRAWAL_MIN_LEVEL;
  const parsed = raw ? Number(raw) : 2;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 2;
  }
  return parsed;
}

function getWithdrawalCooldownHours(): number {
  const raw = process.env.WITHDRAWAL_COOLDOWN_HOURS;
  const parsed = raw ? Number(raw) : 24;
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 24;
  }
  return parsed;
}

function getMaxDailyWithdrawal(): number {
  const raw = process.env.WITHDRAWAL_MAX_DAILY_AMOUNT;
  const parsed = raw ? Number(raw) : 0;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

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

  const { amount } = req.body as { amount: number };

  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const depositStats = await calculateDepositLevelForUser(user.user_id);

    const minLevel = Math.max(getWithdrawalMinLevel(), 5);
    if (depositStats.level < minLevel) {
      res.status(403).json({
        message:
          "Withdrawals are locked until you reach Level 5 based on your total approved deposits."
      });
      return;
    }

    const cooldownHours = getWithdrawalCooldownHours();
    if (cooldownHours > 0 && user.last_withdrawal_at) {
      const now = new Date();
      const last = new Date(user.last_withdrawal_at);
      const hoursSince =
        (now.getTime() - last.getTime()) / (1000 * 60 * 60);
      if (hoursSince < cooldownHours) {
        res.status(429).json({
          message: "Withdrawal cooldown active. Please try again later."
        });
        return;
      }
    }

    if (amount > user.withdrawable_balance) {
      await recordWithdrawalAttempt(user, amount, false);
      res.status(400).json({
        message: "Requested amount exceeds your withdrawable balance"
      });
      return;
    }

    const maxDaily = getMaxDailyWithdrawal();
    if (maxDaily > 0 && amount > maxDaily) {
      await recordWithdrawalAttempt(user, amount, false);
      res.status(400).json({
        message: "Requested amount exceeds the daily withdrawal limit"
      });
      return;
    }

    const withdrawal = await Withdrawal.create({
      user_id: req.user.userId,
      amount
    });

    user.withdrawable_balance -= amount;
    user.last_withdrawal_at = new Date();
    await user.save();

    await Notification.create({
      type: "withdrawal_created",
      message: "Withdrawal request submitted",
      user_id: req.user.userId
    });
    sendWithdrawalStatusEmail({
      to: user.email,
      name: user.name,
      status: "Pending",
      amount
    });

    await recordWithdrawalAttempt(user, amount, true);
    await trackUserActivity(user.user_id, "withdrawal", {
      amount,
      withdrawal_id: withdrawal.withdrawal_id
    });

    res.status(201).json(withdrawal);
  } catch (error) {
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
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const depositStats = await calculateDepositLevelForUser(user.user_id);

    const minLevel = Math.max(getWithdrawalMinLevel(), 5);
    const cooldownHours = getWithdrawalCooldownHours();

    let cooldownRemainingSeconds = 0;
    if (cooldownHours > 0 && user.last_withdrawal_at) {
      const now = new Date();
      const last = new Date(user.last_withdrawal_at);
      const msSince = now.getTime() - last.getTime();
      const cooldownMs = cooldownHours * 60 * 60 * 1000;
      cooldownRemainingSeconds = Math.max(0, Math.floor((cooldownMs - msSince) / 1000));
    }

    res.status(200).json({
      withdrawable_balance: user.withdrawable_balance,
      locked_balance: user.locked_balance,
      pending_earnings_total:
        (user.pending_earnings as any)?.total !== undefined
          ? Number((user.pending_earnings as any).total)
          : 0,
      user_level: depositStats.level,
      min_level: minLevel,
      cooldown_seconds_remaining: cooldownRemainingSeconds
    });
  } catch {
    res.status(500).json({ message: "Failed to load withdrawal summary" });
  }
}

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

  try {
    const withdrawal = await Withdrawal.findByPk(id);
    if (!withdrawal) {
      res.status(404).json({ message: "Withdrawal not found" });
      return;
    }

    const user = await User.findByPk(withdrawal.user_id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (withdrawal.status === "Rejected" && status === "Approved") {
      res.status(400).json({ message: "Cannot approve a rejected withdrawal" });
      return;
    }

    if (withdrawal.status === "Approved" && status !== "Approved") {
      res.status(400).json({ message: "Approved withdrawals cannot be changed" });
      return;
    }

    if (status === "Rejected" && withdrawal.status === "Pending") {
      user.withdrawable_balance += withdrawal.amount;
      await user.save();
    }

    withdrawal.status = status;
    await withdrawal.save();

    await Notification.create({
      type: "withdrawal_status",
      message: `Your withdrawal was ${status}`,
      user_id: withdrawal.user_id
    });

    sendWithdrawalStatusEmail({
      to: user.email,
      name: user.name,
      status,
      amount: withdrawal.amount
    });

    res.status(200).json(withdrawal);
  } catch (error) {
    res.status(500).json({ message: "Failed to update withdrawal" });
  }
}

