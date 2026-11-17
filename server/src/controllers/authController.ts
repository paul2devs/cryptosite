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
  sendEmailVerificationEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail
} from "../services/email/emailService";
import {
  consumePasswordResetToken,
  createPasswordResetTokenForUser,
  pruneExpiredPasswordResetTokens
} from "../services/passwordResetService";
import {
  consumeEmailVerificationToken,
  createEmailVerificationTokenForUser,
  getEmailVerificationResendCooldownSeconds,
  getVerificationResendAvailableAt,
  maskEmail,
  pruneEmailVerificationTokens
} from "../services/emailVerificationService";

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

    // Email verification is mandatory, so registration deliberately does NOT
    // open a session. The account stays inaccessible until the emailed link is
    // opened and the token is validated on the server.
    const { token, expiresMinutes } = await createEmailVerificationTokenForUser(user);
    sendEmailVerificationEmail({
      to: user.email,
      name: user.name,
      token,
      expiresMinutes
    });

    // The freshly issued token starts the resend cooldown, so the screen can
    // show an accurate countdown instead of an enabled button that would be
    // silently rate-limited server-side.
    const resendAvailableAt = await getVerificationResendAvailableAt(user.user_id);

    res.status(201).json({
      message: "Account created. Check your inbox to verify your email address.",
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        email_verified: false,
        is_admin: user.is_admin,
        referral_code: user.referral_code
      },
      verification: {
        required: true,
        email: maskEmail(user.email),
        expiresMinutes,
        resendAvailableAt: resendAvailableAt ? resendAvailableAt.toISOString() : null
      }
    });

    await trackUserActivity(user.user_id, "email_verification_request", {
      source: "register"
    });
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

    // Correct credentials, but the address has not been confirmed: the account
    // must not be misrepresented as a credential failure. Administrators are
    // exempt from email verification (matching `middleware/auth.ts`), so an
    // admin can always sign in to operate the platform.
    if (!user.email_verified && !user.is_admin) {
      const resendAvailableAt = await getVerificationResendAvailableAt(user.user_id);
      res.status(403).json({
        message: "Please verify your email address before signing in.",
        code: "EMAIL_NOT_VERIFIED",
        email: maskEmail(user.email),
        resendAvailableAt: resendAvailableAt ? resendAvailableAt.toISOString() : null
      });
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
    // `verifyRefreshToken` returns the decoded payload including `iat`/`exp`.
    // Those must not be forwarded to `jwt.sign` together with `expiresIn`,
    // otherwise jsonwebtoken throws and every refresh request fails with 401.
    const { userId, isAdmin } = verifyRefreshToken(token);
    // A refresh must not resurrect a session for an account whose email is no
    // longer verified (defence in depth: unverified accounts never receive a
    // refresh token in the first place).
    const user = await User.findByPk(userId);
    if (!user || (!user.email_verified && !user.is_admin)) {
      res.status(403).json({
        message: "Please verify your email address before signing in.",
        code: "EMAIL_NOT_VERIFIED"
      });
      return;
    }
    const accessToken = signAccessToken({ userId, isAdmin });
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
        email_verified: user.email_verified,
        referral_code: user.referral_code,
        referred_by: user.referred_by
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
}

/**
 * Consumes a single-use verification token.
 *
 * The response is intentionally explicit about the outcome so the verification
 * screen can render the right state, but it never echoes the token or any
 * backend detail.
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      status: "invalid",
      code: "VERIFICATION_TOKEN_INVALID",
      message: "This verification link is invalid or has already been used."
    });
    return;
  }

  const { token } = req.body as { token: string };

  try {
    const result = await consumeEmailVerificationToken({ token: String(token || "") });

    if (result.status === "verified") {
      sendWelcomeEmail({ to: result.user.email, name: result.user.name });
      await trackUserActivity(result.user.user_id, "email_verified", {
        source: "verification_link"
      });
      res.status(200).json({
        status: "verified",
        email_verified: true,
        message: "Your email address has been confirmed."
      });
      return;
    }

    if (result.status === "already_verified") {
      res.status(200).json({
        status: "already_verified",
        email_verified: true,
        message: "Your email address is already confirmed."
      });
      return;
    }

    if (result.status === "expired") {
      res.status(410).json({
        status: "expired",
        code: "VERIFICATION_TOKEN_EXPIRED",
        message: "This verification link has expired."
      });
      return;
    }

    res.status(400).json({
      status: "invalid",
      code: "VERIFICATION_TOKEN_INVALID",
      message: "This verification link is invalid or has already been used."
    });
  } catch {
    res.status(400).json({
      status: "invalid",
      code: "VERIFICATION_TOKEN_INVALID",
      message: "This verification link is invalid or has already been used."
    });
  }
}

/**
 * Requests a fresh verification email.
 *
 * The response is identical whether or not an account exists for the address,
 * so the endpoint cannot be used to enumerate accounts. The account's own
 * cooldown is enforced silently, while HTTP-level rate limiting protects the
 * email provider from abuse.
 */
export async function resendVerification(req: Request, res: Response): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { email } = req.body as { email: string };
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const cooldownSeconds = getEmailVerificationResendCooldownSeconds();
  const genericResponse = {
    ok: true,
    message: "If an account exists for that address, a new verification email has been sent.",
    cooldownSeconds
  };

  try {
    await pruneEmailVerificationTokens();
    const user = await User.findOne({ where: { email: normalizedEmail } });

    if (user && !user.email_verified) {
      const availableAt = await getVerificationResendAvailableAt(user.user_id);
      if (!availableAt) {
        const { token, expiresMinutes } = await createEmailVerificationTokenForUser(user);
        sendEmailVerificationEmail({
          to: user.email,
          name: user.name,
          token,
          expiresMinutes
        });
        await trackUserActivity(user.user_id, "email_verification_request", {
          source: "resend"
        });
      }
    }

    res.status(200).json(genericResponse);
  } catch {
    res.status(200).json(genericResponse);
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