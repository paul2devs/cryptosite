import crypto from "crypto";
import { Op } from "sequelize";
import { PasswordResetToken } from "../models/PasswordResetToken";
import { User } from "../models/User";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function getResetExpiryMinutes(): number {
  const raw = process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES;
  const parsed = raw ? Number(raw) : 30;
  if (!Number.isFinite(parsed) || parsed < 10 || parsed > 180) {
    return 30;
  }
  return Math.floor(parsed);
}

export async function createPasswordResetTokenForUser(user: User): Promise<{
  token: string;
  expiresMinutes: number;
}> {
  const token = randomToken();
  const tokenHash = sha256(token);
  const expiresMinutes = getResetExpiryMinutes();
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

  await PasswordResetToken.create({
    user_id: user.user_id,
    token_hash: tokenHash,
    expires_at: expiresAt
  });

  return { token, expiresMinutes };
}

export async function consumePasswordResetToken(args: {
  token: string;
}): Promise<{ user: User }> {
  const tokenHash = sha256(args.token);
  const now = new Date();

  const record = await PasswordResetToken.findOne({
    where: {
      token_hash: tokenHash,
      used_at: { [Op.is]: null },
      expires_at: { [Op.gt]: now }
    }
  });

  if (!record) {
    throw new Error("invalid_token");
  }

  const user = await User.findByPk(record.user_id);
  if (!user) {
    throw new Error("invalid_token");
  }

  record.used_at = now;
  await record.save();

  return { user };
}

export async function pruneExpiredPasswordResetTokens(): Promise<void> {
  const now = new Date();
  await PasswordResetToken.destroy({
    where: {
      [Op.or]: [
        { expires_at: { [Op.lte]: now } },
        { used_at: { [Op.not]: null } }
      ]
    }
  });
}

