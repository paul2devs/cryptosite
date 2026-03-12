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

