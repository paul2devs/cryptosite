import { Response } from "express";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { validationResult } from "express-validator";
import { sequelize } from "../config/database";
import { AuthenticatedRequest } from "../middleware/auth";
import { getUserProgression } from "../services/gamificationService";
import { User } from "../models/User";
import { calculateDepositLevelForUser } from "../services/depositLevelService";
import { Notification } from "../models/Notification";
import { Deposit } from "../models/Deposit";
import { Withdrawal } from "../models/Withdrawal";
import { Referral } from "../models/Referral";
import { ReferralReward } from "../models/ReferralReward";
import { PasswordResetToken } from "../models/PasswordResetToken";
import { UserActivityEvent } from "../models/UserActivityEvent";
import { UserBehaviorScore } from "../models/UserBehaviorScore";
import { ActiveMultiplier } from "../models/ActiveMultiplier";
import { EarningsLog } from "../models/EarningsLog";
import { SocialFeedSeen } from "../models/SocialFeedSeen";
import { UserSeenEvent } from "../models/UserSeenEvent";
import { UserAIProfile } from "../models/UserAIProfile";
import { ChurnPrediction } from "../models/ChurnPrediction";

const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const ALLOWED_LANGUAGES = new Set(["en", "es", "fr", "de", "pt"]);

type NotificationSettings = {
  deposit_updates: boolean;
  withdrawal_updates: boolean;
  rewards_bonuses: boolean;
  announcements: boolean;
};

type AccountSettings = {
  notifications: NotificationSettings;
  preferences: {
    language: string;
  };
  withdrawal_wallets: Array<{
    wallet_id: string;
    asset: string;
    address: string;
    network: string | null;
  }>;
};

function defaultAccountSettings(): AccountSettings {
  return {
    notifications: {
      deposit_updates: true,
      withdrawal_updates: true,
      rewards_bonuses: true,
      announcements: true
    },
    preferences: {
      language: "en"
    },
    withdrawal_wallets: []
  };
}

function normalizeSettings(raw: unknown): AccountSettings {
  const base = defaultAccountSettings();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const parsed = raw as Partial<AccountSettings>;
  const notifications = (parsed.notifications ?? {}) as Partial<NotificationSettings>;
  const preferences = (parsed.preferences ?? {}) as Partial<AccountSettings["preferences"]>;
  const wallets = Array.isArray(parsed.withdrawal_wallets) ? parsed.withdrawal_wallets : [];
  return {
    notifications: {
      deposit_updates:
        typeof notifications.deposit_updates === "boolean"
          ? notifications.deposit_updates
          : base.notifications.deposit_updates,
      withdrawal_updates:
        typeof notifications.withdrawal_updates === "boolean"
          ? notifications.withdrawal_updates
          : base.notifications.withdrawal_updates,
      rewards_bonuses:
        typeof notifications.rewards_bonuses === "boolean"
          ? notifications.rewards_bonuses
          : base.notifications.rewards_bonuses,
      announcements:
        typeof notifications.announcements === "boolean"
          ? notifications.announcements
          : base.notifications.announcements
    },
    preferences: {
      language:
        typeof preferences.language === "string" && ALLOWED_LANGUAGES.has(preferences.language)
          ? preferences.language
          : base.preferences.language
    },
    withdrawal_wallets: wallets
      .filter((wallet) => wallet && typeof wallet === "object")
      .map((wallet) => {
        const w = wallet as {
          wallet_id?: unknown;
          asset?: unknown;
          address?: unknown;
          network?: unknown;
        };
        return {
          wallet_id:
            typeof w.wallet_id === "string" && w.wallet_id.length > 0
              ? w.wallet_id
              : randomUUID(),
          asset: typeof w.asset === "string" ? w.asset : "BTC",
          address: typeof w.address === "string" ? w.address.trim() : "",
          network: typeof w.network === "string" ? w.network : null
        };
      })
      .filter((wallet) => wallet.address.length > 0)
  };
}

export async function getCurrentXpLevel(
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

    const progression = await getUserProgression(user);
    const depositStats = await calculateDepositLevelForUser(user.user_id);

    res.status(200).json({
      level: progression.level,
      xp: progression.xp,
      currentLevel: {
        level_id: progression.currentLevel.level_id,
        level_name: progression.currentLevel.level_name,
        required_xp: progression.currentLevel.required_xp,
        multiplier_base: progression.currentLevel.multiplier_base
      },
      nextLevel: progression.nextLevel
        ? {
            level_id: progression.nextLevel.level_id,
            level_name: progression.nextLevel.level_name,
            required_xp: progression.nextLevel.required_xp,
            multiplier_base: progression.nextLevel.multiplier_base
          }
        : null,
      xpToNext: progression.xpToNext,
      multiplierPreview: progression.multiplierPreview,
      pendingEarningsTotal: progression.pendingEarningsTotal,
      streak: user.streak,
      withdrawableBalance: progression.withdrawableBalance ?? 0,
      lockedBalance: progression.lockedBalance ?? 0,
      depositLevel: depositStats.level,
      totalDepositedUsd: depositStats.totalDepositedUsd,
      depositCurrentLevelRequiredTotal: depositStats.currentLevelRequiredTotal,
      depositNextLevel: depositStats.nextLevel,
      depositNextLevelRequiredTotal: depositStats.nextLevelRequiredTotal,
      depositRemainingToNext: depositStats.remainingToNext
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load progression" });
  }
}

export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
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
    const settings = normalizeSettings(user.account_settings);
    res.status(200).json({
      account: {
        user_id: user.user_id,
        email: user.email,
        level: user.level,
        status: "Active"
      },
      settings
    });
  } catch {
    res.status(500).json({ message: "Failed to load settings" });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  if (!PASSWORD_STRENGTH_REGEX.test(newPassword || "")) {
    res.status(400).json({
      message:
        "Password must be at least 8 characters and include uppercase, lowercase, and a number."
    });
    return;
  }
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const valid = await bcrypt.compare(String(currentPassword || ""), user.password);
    if (!valid) {
      res.status(400).json({ message: "Current password is incorrect." });
      return;
    }
    user.password = await bcrypt.hash(
      newPassword,
      Number(process.env.BCRYPT_SALT_ROUNDS || 10)
    );
    await user.save();
    res.status(200).json({ message: "Password updated successfully." });
  } catch {
    res.status(500).json({ message: "Failed to update password" });
  }
}

export async function addWithdrawalWallet(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { asset, address, network } = req.body as {
    asset: string;
    address: string;
    network?: string | null;
  };
  const trimmedAddress = String(address || "").trim();
  const normalizedAsset = String(asset || "").trim().toUpperCase();
  if (!trimmedAddress || !normalizedAsset) {
    res.status(400).json({ message: "Asset and address are required." });
    return;
  }
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const settings = normalizeSettings(user.account_settings);
    const duplicate = settings.withdrawal_wallets.some(
      (wallet) =>
        wallet.asset === normalizedAsset &&
        wallet.address.toLowerCase() === trimmedAddress.toLowerCase() &&
        String(wallet.network || "").toUpperCase() === String(network || "").toUpperCase()
    );
    if (duplicate) {
      res.status(409).json({ message: "Wallet already exists." });
      return;
    }
    settings.withdrawal_wallets.push({
      wallet_id: randomUUID(),
      asset: normalizedAsset,
      address: trimmedAddress,
      network: typeof network === "string" && network.trim().length > 0 ? network.trim() : null
    });
    user.account_settings = settings;
    await user.save();
    res.status(201).json({ wallets: settings.withdrawal_wallets });
  } catch {
    res.status(500).json({ message: "Failed to save wallet" });
  }
}

export async function removeWithdrawalWallet(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { walletId } = req.params;
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const settings = normalizeSettings(user.account_settings);
    const nextWallets = settings.withdrawal_wallets.filter((w) => w.wallet_id !== walletId);
    if (nextWallets.length === settings.withdrawal_wallets.length) {
      res.status(404).json({ message: "Wallet not found." });
      return;
    }
    settings.withdrawal_wallets = nextWallets;
    user.account_settings = settings;
    await user.save();
    res.status(200).json({ wallets: settings.withdrawal_wallets });
  } catch {
    res.status(500).json({ message: "Failed to remove wallet" });
  }
}

export async function updateNotificationSettings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { deposit_updates, withdrawal_updates, rewards_bonuses, announcements } =
    req.body as NotificationSettings;
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const settings = normalizeSettings(user.account_settings);
    settings.notifications = {
      deposit_updates: Boolean(deposit_updates),
      withdrawal_updates: Boolean(withdrawal_updates),
      rewards_bonuses: Boolean(rewards_bonuses),
      announcements: Boolean(announcements)
    };
    user.account_settings = settings;
    await user.save();
    res.status(200).json({ notifications: settings.notifications });
  } catch {
    res.status(500).json({ message: "Failed to update notification settings" });
  }
}

export async function updateLanguage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { language } = req.body as { language: string };
  if (!ALLOWED_LANGUAGES.has(language)) {
    res.status(400).json({ message: "Unsupported language." });
    return;
  }
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const settings = normalizeSettings(user.account_settings);
    settings.preferences.language = language;
    user.account_settings = settings;
    await user.save();
    res.status(200).json({ language: settings.preferences.language });
  } catch {
    res.status(500).json({ message: "Failed to update language" });
  }
}

export async function deleteAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const { password } = req.body as { password: string };
  if (!password || password.length < 8) {
    res.status(400).json({ message: "Password confirmation is required." });
    return;
  }
  try {
    const user = await User.findByPk(req.user.userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(400).json({ message: "Password is incorrect." });
      return;
    }
    await sequelize.transaction(async (transaction) => {
      await Notification.destroy({ where: { user_id: user.user_id }, transaction });
      await Deposit.destroy({ where: { user_id: user.user_id }, transaction });
      await Withdrawal.destroy({ where: { user_id: user.user_id }, transaction });
      await Referral.destroy({ where: { referrer_id: user.user_id }, transaction });
      await Referral.destroy({ where: { referred_user_id: user.user_id }, transaction });
      await ReferralReward.destroy({ where: { user_id: user.user_id }, transaction });
      await ReferralReward.destroy({ where: { referred_user_id: user.user_id }, transaction });
      await PasswordResetToken.destroy({ where: { user_id: user.user_id }, transaction });
      await UserActivityEvent.destroy({ where: { user_id: user.user_id }, transaction });
      await UserBehaviorScore.destroy({ where: { user_id: user.user_id }, transaction });
      await ActiveMultiplier.destroy({ where: { user_id: user.user_id }, transaction });
      await EarningsLog.destroy({ where: { user_id: user.user_id }, transaction });
      await SocialFeedSeen.destroy({ where: { user_id: user.user_id }, transaction });
      await UserSeenEvent.destroy({ where: { user_id: user.user_id }, transaction });
      await UserAIProfile.destroy({ where: { user_id: user.user_id }, transaction });
      await ChurnPrediction.destroy({ where: { user_id: user.user_id }, transaction });
      await User.destroy({ where: { user_id: user.user_id }, transaction });
    });
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });
    res.status(200).json({ message: "Account deleted successfully." });
  } catch {
    res.status(500).json({ message: "Failed to delete account" });
  }
}

