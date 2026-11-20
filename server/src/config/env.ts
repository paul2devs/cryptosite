import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envDotLocalPath = path.resolve(__dirname, "../../.env.local");
const envDotPath = path.resolve(__dirname, "../../.env");
const envLocalPath = path.resolve(__dirname, "../../env.local");
const envPath = path.resolve(__dirname, "../../env");

const preferredPaths = [envDotLocalPath, envDotPath, envLocalPath, envPath];

let chosen: string | null = null;
let loaded = false;

for (const p of preferredPaths) {
  if (!fs.existsSync(p)) {
    continue;
  }
  const result = dotenv.config({ path: p });
  if (!result.error) {
    chosen = p;
    loaded = true;
    break;
  }
}

if (!loaded) {
  dotenv.config();
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || String(value).trim().length === 0) {
    const where =
      chosen ||
      (fs.existsSync(envDotLocalPath)
        ? envDotLocalPath
        : fs.existsSync(envDotPath)
          ? envDotPath
          : fs.existsSync(envLocalPath)
            ? envLocalPath
            : fs.existsSync(envPath)
              ? envPath
              : "process environment");
    throw new Error(
      `Missing required environment variable: ${name}. Add it to ${where} and restart the server.`
    );
  }
  return value;
}

export function requireIntEnv(name: string, defaultValue?: number): number {
  const raw = process.env[name];
  if (!raw || String(raw).trim().length === 0) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required environment variable: ${name}.`);
    }
    return defaultValue;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${name}. Expected a non-negative integer.`);
  }
  return parsed;
}

export function validateCoreEnv(): void {
  requireEnv("DATABASE_URL");
  requireEnv("JWT_ACCESS_SECRET");
  requireEnv("JWT_REFRESH_SECRET");
  requireIntEnv("BCRYPT_SALT_ROUNDS", 10);
}

export interface EnvWarning {
  name: string;
  message: string;
}

export function validateRuntimeEnv(): EnvWarning[] {
  const warnings: EnvWarning[] = [];

  const accessSecret = process.env.JWT_ACCESS_SECRET || "";
  const refreshSecret = process.env.JWT_REFRESH_SECRET || "";

  if (accessSecret.length > 0 && accessSecret.length < 16) {
    warnings.push({
      name: "JWT_ACCESS_SECRET",
      message: "JWT_ACCESS_SECRET is shorter than 16 characters; use a longer secret in production."
    });
  }
  if (refreshSecret.length > 0 && refreshSecret.length < 16) {
    warnings.push({
      name: "JWT_REFRESH_SECRET",
      message: "JWT_REFRESH_SECRET is shorter than 16 characters; use a longer secret in production."
    });
  }
  if (accessSecret.length > 0 && refreshSecret.length > 0 && accessSecret === refreshSecret) {
    warnings.push({
      name: "JWT_REFRESH_SECRET",
      message: "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are identical; use distinct secrets."
    });
  }
  if (!process.env.REDIS_URL) {
    warnings.push({
      name: "REDIS_URL",
      message: "REDIS_URL is not set; the server will use an in-memory cache (single instance only)."
    });
  }
  if (!process.env.CORS_ORIGIN) {
    warnings.push({
      name: "CORS_ORIGIN",
      message: "CORS_ORIGIN is not set; only the built-in default origins are allowed."
    });
  }
  const nodeEnv = process.env.NODE_ENV || "";
  if (nodeEnv !== "production") {
    warnings.push({
      name: "NODE_ENV",
      message: `NODE_ENV is "${nodeEnv || "undefined"}"; set it to "production" for deployed environments.`
    });
  }

  const emailEnabled = ["1", "true", "yes", "on"].includes(
    String(process.env.EMAIL_ENABLED || "").trim().toLowerCase()
  );
  if (emailEnabled) {
    const missing = ["RESEND_API_KEY"].filter(
      (name) => !process.env[name] || String(process.env[name]).trim().length === 0
    );
    if (missing.length > 0) {
      warnings.push({
        name: missing[0],
        message: `EMAIL_ENABLED is true but ${missing.join(
          ", "
        )} is not set; verification and notification emails cannot be delivered.`
      });
    }
  } else {
    warnings.push({
      name: "EMAIL_ENABLED",
      message:
        "EMAIL_ENABLED is not true; transactional emails (including email verification) will not be delivered."
    });
  }

  return warnings;
}

export function logEnvWarnings(): void {
  for (const warning of validateRuntimeEnv()) {
    // eslint-disable-next-line no-console
    console.warn(`[env] ${warning.name}: ${warning.message}`);
  }
}

