import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { AuthenticatedRequest } from "../middleware/auth";
import { Deposit } from "../models/Deposit";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import {
  applyDepositGamification,
  getUserProgression
} from "../services/gamificationService";
import { recordDepositBehavior } from "../services/behaviorService";
import { emitSocialProofDeposit } from "../realtime/socket";
import { trackUserActivity } from "../services/activityService";
import { grantReferralRewardsOnApprovedDeposit } from "../services/referralService";
import { getPlatformWallets } from "../services/walletService";
import { verifyDepositOnChain } from "../services/blockchainVerificationService";
import QRCode from "qrcode";
import { sendDepositStatusEmail } from "../services/email/emailService";

export async function createDeposit(
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

  const { crypto_type, amount, tx_hash } = req.body as {
    crypto_type: string;
    amount: number;
    tx_hash?: string | null;
  };

  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!tx_hash || typeof tx_hash !== "string" || tx_hash.trim().length < 8) {
      res.status(400).json({
        message:
          "A valid blockchain transaction hash is required to submit a deposit."
      });
      return;
    }

    const normalizedHash = tx_hash.trim();

    const existing = await Deposit.findOne({
      where: { tx_hash: normalizedHash }
    });
    if (existing) {
      res.status(400).json({
        message:
          "This transaction hash has already been submitted. Each on-chain transaction can only be used once."
      });
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({
        message: "Deposit amount must be a positive number."
      });
      return;
    }

    console.info(
      "[deposit] Incoming deposit request",
      JSON.stringify({
        userId: user.user_id,
        crypto_type,
        amount: numericAmount,
        tx_hash: normalizedHash
      })
    );

    const verification = await verifyDepositOnChain({
      cryptoType: crypto_type as any,
      txHash: normalizedHash,
      expectedAmount: numericAmount
    });

    if (!verification.success) {
      console.warn(
        "[deposit] Blockchain verification failed",
        JSON.stringify({
          userId: user.user_id,
          crypto_type,
          amount: numericAmount,
          tx_hash: normalizedHash,
          reason: verification.failureReason,
          confirmations: verification.confirmations
        })
      );
      res.status(400).json({
        message:
          verification.failureReason ||
          "Blockchain verification failed for this transaction hash."
      });
      return;
    }

    console.info(
      "[deposit] Blockchain verification passed",
      JSON.stringify({
        userId: user.user_id,
        crypto_type,
        amount: numericAmount,
        tx_hash: normalizedHash,
        confirmations: verification.confirmations
      })
    );

    const deposit = await Deposit.create({
      user_id: req.user.userId,
      crypto_type,
      amount: numericAmount,
      tx_hash: normalizedHash
    });

    await applyDepositGamification(user, deposit, {
      hasReferralBonus: false
    });

    await Notification.create({
      type: "deposit_created",
      message: "Deposit verified on-chain and submitted for review",
      user_id: req.user.userId
    });
    sendDepositStatusEmail({
      to: user.email,
      name: user.name,
      status: "Pending",
      amount: numericAmount,
      asset: crypto_type
    });

    await recordDepositBehavior(user, amount);
    await trackUserActivity(user.user_id, "deposit", {
      amount,
      crypto_type,
      deposit_id: deposit.deposit_id
    });

    const alias = `${user.name.slice(0, 3)}***`;
    emitSocialProofDeposit(deposit, alias);

    res.status(201).json(deposit);
  } catch (error) {
    res.status(500).json({ message: "Failed to create deposit" });
  }
}

export async function getDepositAddresses(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const wallets = getPlatformWallets();

    const items = await Promise.all(
      wallets.map(async (w) => {
        const qrCodeData = await QRCode.toDataURL(w.address, {
          errorCorrectionLevel: "M"
        });

        let name: string;
        let networkType: string;

        switch (w.asset) {
          case "BTC":
            name = "Bitcoin";
            networkType = "BTC";
            break;
          case "ETH":
            name = "Ethereum";
            networkType = "ERC20";
            break;
          case "SOL":
            name = "Solana";
            networkType = "SOL";
            break;
          case "USDT_TRC20":
            name = "Tether (USDT)";
            networkType = "TRC20";
            break;
          case "USDT_ERC20":
          default:
            name = "Tether (USDT)";
            networkType = "ERC20";
            break;
        }

        return {
          asset: w.asset,
          name,
          address: w.address,
          network: w.network,
          networkType,
          qrCodeData
        };
      })
    );

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load deposit addresses. Please contact support."
    });
  }
}

export async function getUserDeposits(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const deposits = await Deposit.findAll({
      where: { user_id: req.user.userId },
      order: [["timestamp", "DESC"]]
    });
    res.status(200).json(deposits);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deposits" });
  }
}

export async function getAllDeposits(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const deposits = await Deposit.findAll({
      include: [{ model: User }],
      order: [["timestamp", "DESC"]]
    });
    res.status(200).json(deposits);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deposits" });
  }
}

export async function updateDepositStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { id } = req.params;
  const { status } = req.body as { status: "Pending" | "Approved" | "Rejected" };

  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const deposit = await Deposit.findByPk(id);
    if (!deposit) {
      res.status(404).json({ message: "Deposit not found" });
      return;
    }

    const previousStatus = deposit.status;
    deposit.status = status;

    if (status === "Approved") {
      if (!deposit.approved_at) {
        deposit.approved_at = new Date();
      }
    }

    if (previousStatus === "Approved" && status !== "Approved") {
      deposit.approved_at = null;
    }

    await deposit.save();

    await Notification.create({
      type: "deposit_status",
      message: `Your deposit was ${status}`,
      user_id: deposit.user_id
    });

    const owner = await User.findByPk(deposit.user_id);
    if (owner) {
      sendDepositStatusEmail({
        to: owner.email,
        name: owner.name,
        status,
        amount: deposit.amount,
        asset: deposit.crypto_type
      });
    }

    if (status === "Approved" && previousStatus !== "Approved") {
      await grantReferralRewardsOnApprovedDeposit(deposit);
    }

    res.status(200).json(deposit);
  } catch (error) {
    res.status(500).json({ message: "Failed to update deposit" });
  }
}

