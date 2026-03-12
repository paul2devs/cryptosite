import bcrypt from "bcrypt";
import crypto from "crypto";
import { Op } from "sequelize";
import { requireEnv, requireIntEnv } from "../config/env";
import { User } from "../models/User";

function normalizeEmail(email: string): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export async function ensureAdminAccount(): Promise<void> {
  const existingAdmin = await User.findOne({ where: { is_admin: true } });
  if (existingAdmin) {
    return;
  }

  const envEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const bootstrapEmail = normalizeEmail(envEmail || "admin@local.dev");
  if (!looksLikeEmail(bootstrapEmail)) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL is invalid. Provide a valid email address.");
  }

  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const envPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const bootstrapPassword =
    envPassword && String(envPassword).trim().length > 0
      ? String(envPassword)
      : isProd
        ? (() => {
            throw new Error(
              "ADMIN_BOOTSTRAP_PASSWORD is required in production when no admin exists."
            );
          })()
        : generatePassword();

  const saltRounds = requireIntEnv("BCRYPT_SALT_ROUNDS", 10);
  const hashed = await bcrypt.hash(bootstrapPassword, saltRounds);

  const existingUser = await User.findOne({
    where: {
      email: {
        [Op.iLike]: bootstrapEmail
      }
    }
  });

  if (existingUser) {
    existingUser.is_admin = true;
    existingUser.password = hashed;
    await existingUser.save();
  } else {
    await User.create({
      name: "Platform Admin",
      email: bootstrapEmail,
      password: hashed,
      crypto_wallets: [],
      is_admin: true
    });
  }

  // eslint-disable-next-line no-console
  console.log("Admin bootstrap account ensured");
  // eslint-disable-next-line no-console
  console.log(`ADMIN_EMAIL=${bootstrapEmail}`);
  // eslint-disable-next-line no-console
  console.log(`ADMIN_PASSWORD=${bootstrapPassword}`);

  // Ensure these env vars exist for clarity (they're not required when generated in dev)
  requireEnv("JWT_ACCESS_SECRET");
  requireEnv("JWT_REFRESH_SECRET");
}

