import crypto from "crypto";
import { Op, Transaction } from "sequelize";
import { sequelize } from "../config/database";
import { EmailVerificationToken } from "../models/EmailVerificationToken";
import { User } from "../models/User";

const DEFAULT_TTL_MINUTES = 30;
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 1440;
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const USED_TOKEN_RETENTION_MS = 24 * 60 * 60 * 1000;

export type EmailVerificationConsumeResult =
  | { status: "verified"; user: User }
  | { status: "already_verified"; user: User }
  | { status: "expired" }
  | { status: "invalid" };

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function getEmailVerificationExpiryMinutes(): number {
  const raw = process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES;
  const parsed = raw ? Number(raw) : DEFAULT_TTL_MINUTES;
  if (!Number.isFinite(parsed)) {
    return DEFAULT_TTL_MINUTES;
  }
  const rounded = Math.floor(parsed);
  if (rounded < MIN_TTL_MINUTES || rounded > MAX_TTL_MINUTES) {
    return DEFAULT_TTL_MINUTES;
  }
  return rounded;
}

export function getEmailVerificationResendCooldownSeconds(): number {
  const raw = process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS;
  const parsed = raw ? Number(raw) : DEFAULT_RESEND_COOLDOWN_SECONDS;
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RESEND_COOLDOWN_SECONDS;
  }
  const rounded = Math.floor(parsed);
  if (rounded < 0 || rounded > 3600) {
    return DEFAULT_RESEND_COOLDOWN_SECONDS;
  }
  return rounded;
}

/**
 * Masks an email address so it can be shown on public screens (waiting for
 * verification, resend confirmation) without disclosing the full address to
 * anyone who might be looking over the user's shoulder.
 */
export function maskEmail(email: string): string {
  const raw = String(email || "").trim();
  const atIndex = raw.lastIndexOf("@");
  if (atIndex <= 0) {
    return raw.length > 0 ? "•".repeat(Math.min(raw.length, 12)) : "";
  }
  const local = raw.slice(0, atIndex);
  const domain = raw.slice(atIndex + 1);
  const visible = local.slice(0, 1);
  const maskedLocal = visible + "•".repeat(Math.max(local.length - 1, 2));
  return `${maskedLocal}@${domain}`;
}

/**
 * Issues a fresh single-use verification token for a user and invalidates any
 * token that is still outstanding, so a mailbox can never hold two usable links.
 * Only the SHA-256 hash is persisted; the raw token is returned to be emailed.
 */
export async function createEmailVerificationTokenForUser(user: User): Promise<{
  token: string;
  expiresMinutes: number;
}> {
  const token = randomToken();
  const tokenHash = sha256(token);
  const expiresMinutes = getEmailVerificationExpiryMinutes();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresMinutes * 60 * 1000);

  await sequelize.transaction(async (transaction) => {
    await EmailVerificationToken.update(
      { used_at: now },
      { where: { user_id: user.user_id, used_at: { [Op.is]: null } }, transaction }
    );
    await EmailVerificationToken.create(
      {
        user_id: user.user_id,
        token_hash: tokenHash,
        expires_at: expiresAt
      },
      { transaction }
    );
  });

  return { token, expiresMinutes };
}

/**
 * Validates and consumes a verification token.
 *
 * The whole operation runs inside a transaction that row-locks both the token
 * and the user, so two concurrent clicks on the same link can never produce
 * inconsistent account states (one wins, the other observes a verified user).
 */
export async function consumeEmailVerificationToken(args: {
  token: string;
}): Promise<EmailVerificationConsumeResult> {
  const tokenHash = sha256(String(args.token || ""));
  const now = new Date();

  return sequelize.transaction(async (transaction: Transaction) => {
    const record = await EmailVerificationToken.findOne({
      where: { token_hash: tokenHash },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!record) {
      return { status: "invalid" };
    }

    const user = await User.findByPk(record.user_id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!user) {
      return { status: "invalid" };
    }

    // The address is already confirmed (for example the link was opened twice).
    if (user.email_verified) {
      if (!record.used_at) {
        record.used_at = now;
        await record.save({ transaction });
      }
      return { status: "already_verified", user };
    }

    // Superseded by a newer link, or already consumed without verifying.
    if (record.used_at) {
      return { status: "expired" };
    }

    if (record.expires_at.getTime() <= now.getTime()) {
      return { status: "expired" };
    }

    record.used_at = now;
    await record.save({ transaction });

    user.email_verified = true;
    user.email_verified_at = now;
    await user.save({ transaction });

    await EmailVerificationToken.update(
      { used_at: now },
      { where: { user_id: user.user_id, used_at: { [Op.is]: null } }, transaction }
    );

    return { status: "verified", user };
  });
}

export async function pruneEmailVerificationTokens(): Promise<void> {
  const now = new Date();
  const usedCutoff = new Date(now.getTime() - USED_TOKEN_RETENTION_MS);
  await EmailVerificationToken.destroy({
    where: {
      [Op.or]: [
        { expires_at: { [Op.lte]: now } },
        { used_at: { [Op.lte]: usedCutoff } }
      ]
    }
  });
}

/**
 * Returns the moment a new verification email may be requested again, or null
 * when the user has no outstanding request.
 */
export async function getVerificationResendAvailableAt(
  userId: string
): Promise<Date | null> {
  const cooldownSeconds = getEmailVerificationResendCooldownSeconds();
  if (cooldownSeconds <= 0) {
    return null;
  }
  const latest = await EmailVerificationToken.findOne({
    where: { user_id: userId },
    order: [["created_at", "DESC"]]
  });
  if (!latest) {
    return null;
  }
  const availableAt = new Date(latest.created_at.getTime() + cooldownSeconds * 1000);
  return availableAt.getTime() > Date.now() ? availableAt : null;
}
