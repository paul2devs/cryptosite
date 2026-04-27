import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { validationResult } from "express-validator";
import { User } from "../models/User";
import {
  JwtPayload,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../utils/jwt";
import { AuthenticatedRequest } from "../middleware/auth";
import { Referral } from "../models/Referral";
import { generateReferralCode } from "../utils/referralCode";
import { Op } from "sequelize";
import { trackUserActivity } from "../services/activityService";
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
} from "../services/email/emailService";
import {
  consumePasswordResetToken,
  createPasswordResetTokenForUser,
  pruneExpiredPasswordResetTokens
} from "../services/passwordResetService";

const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/"
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { name, email, password, walletAddress, referralCode } = req.body as {
    name: string;
    email: string;
    password: string;
    walletAddress?: string;
    referralCode?: string;
  };

  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const hashed = await bcrypt.hash(password, saltRounds);
    let code: string | null = null;
    for (let i = 0; i < 5; i += 1) {
      const candidate = generateReferralCode();
      const exists = await User.findOne({
        where: {
          referral_code: candidate
        }
      });
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      res.status(500).json({ message: "Failed to allocate referral code" });
      return;
    }

    const normalizedWalletAddress =
      typeof walletAddress === "string" ? walletAddress.trim() : "";

    const user = await User.create({
      name,
      email,
      password: hashed,
      crypto_wallets: normalizedWalletAddress ? [{ address: normalizedWalletAddress }] : [],
      referral_code: code,
      referred_by: null
    });

    if (referralCode) {
      const referrer = await User.findOne({
        where: {
          referral_code: { [Op.eq]: referralCode }
        }
      });
      if (referrer && referrer.user_id !== user.user_id) {
        const existingReferral = await Referral.findOne({
          where: { referred_user_id: user.user_id }
        });
        if (!existingReferral) {
          await Referral.create({
            referrer_id: referrer.user_id,
            referred_user_id: user.user_id
          });
          user.referred_by = referrer.user_id;
          await user.save();
        }
      }
    }

    const payload: JwtPayload = { userId: user.user_id, isAdmin: user.is_admin };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const cookieOptions = getAuthCookieOptions();
    res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.status(201).json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        level: user.level,
        xp: user.xp,
        streak: user.streak,
        pending_earnings: user.pending_earnings,
        is_admin: user.is_admin,
        referral_code: user.referral_code,
        referred_by: user.referred_by
      },
      accessToken,
      refreshToken
    });

    await trackUserActivity(user.user_id, "login", { source: "register" });
    sendWelcomeEmail({ to: user.email, name: user.name });
  } catch (error) {
    res.status(500).json({ message: "Registration failed" });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { email, password } = req.body as { email: string; password: string };

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const payload: JwtPayload = { userId: user.user_id, isAdmin: user.is_admin };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const cookieOptions = getAuthCookieOptions();
    res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.status(200).json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        level: user.level,
        xp: user.xp,
        streak: user.streak,
        pending_earnings: user.pending_earnings,
        is_admin: user.is_admin,
        referral_code: user.referral_code,
        referred_by: user.referred_by
      },
      accessToken,
      refreshToken
    });

    await trackUserActivity(user.user_id, "login", { source: "login" });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken: bodyToken } = req.body as { refreshToken?: string };
  const cookieToken =
    typeof req.cookies?.refreshToken === "string" && req.cookies.refreshToken.length > 0
      ? req.cookies.refreshToken
      : undefined;
  const token = bodyToken || cookieToken;

  if (!token) {
    res.status(400).json({ message: "Refresh token required" });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const accessToken = signAccessToken(payload);
    const cookieOptions = getAuthCookieOptions();
    res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.status(200).json({ accessToken });
  } catch (error) {
    res.status(401).json({ message: "Invalid refresh token" });
  }
}

export async function me(
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

    res.status(200).json({
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        level: user.level,
        xp: user.xp,
        streak: user.streak,
        pending_earnings: user.pending_earnings,
        is_admin: user.is_admin,
        referral_code: user.referral_code,
        referred_by: user.referred_by
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { email } = req.body as { email: string };
  const normalizedEmail = String(email || "").trim().toLowerCase();

  try {
    await pruneExpiredPasswordResetTokens();
    const user = await User.findOne({ where: { email: normalizedEmail } });
    if (user) {
      const { token, expiresMinutes } = await createPasswordResetTokenForUser(user);
      sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token,
        expiresMinutes
      });
      await trackUserActivity(user.user_id, "password_reset_request", {
        source: "forgot_password"
      });
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: true });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { token, password } = req.body as { token: string; password: string };
  const newPassword = String(password || "");
  const rawToken = String(token || "");

  if (newPassword.length < 8) {
    res.status(400).json({ message: "Password must be at least 8 characters." });
    return;
  }

  try {
    const { user } = await consumePasswordResetToken({ token: rawToken });
    const hashed = await bcrypt.hash(newPassword, saltRounds);
    user.password = hashed;
    await user.save();
    sendPasswordChangedEmail({ to: user.email, name: user.name });
    await trackUserActivity(user.user_id, "password_reset_complete", {
      source: "reset_password"
    });
    res.status(200).json({ ok: true });
  } catch {
    res.status(400).json({ message: "Invalid, expired, or already used token." });
  }
}