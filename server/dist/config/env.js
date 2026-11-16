"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEnv = requireEnv;
exports.requireIntEnv = requireIntEnv;
exports.validateCoreEnv = validateCoreEnv;
exports.validateRuntimeEnv = validateRuntimeEnv;
exports.logEnvWarnings = logEnvWarnings;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const envDotLocalPath = path_1.default.resolve(__dirname, "../../.env.local");
const envDotPath = path_1.default.resolve(__dirname, "../../.env");
const envLocalPath = path_1.default.resolve(__dirname, "../../env.local");
const envPath = path_1.default.resolve(__dirname, "../../env");
const preferredPaths = [envDotLocalPath, envDotPath, envLocalPath, envPath];
let chosen = null;
let loaded = false;
for (const p of preferredPaths) {
    if (!fs_1.default.existsSync(p)) {
        continue;
    }
    const result = dotenv_1.default.config({ path: p });
    if (!result.error) {
        chosen = p;
        loaded = true;
        break;
    }
}
if (!loaded) {
    dotenv_1.default.config();
}
function requireEnv(name) {
    const value = process.env[name];
    if (!value || String(value).trim().length === 0) {
        const where = chosen ||
            (fs_1.default.existsSync(envDotLocalPath)
                ? envDotLocalPath
                : fs_1.default.existsSync(envDotPath)
                    ? envDotPath
                    : fs_1.default.existsSync(envLocalPath)
                        ? envLocalPath
                        : fs_1.default.existsSync(envPath)
                            ? envPath
                            : "process environment");
        throw new Error(`Missing required environment variable: ${name}. Add it to ${where} and restart the server.`);
    }
    return value;
}
function requireIntEnv(name, defaultValue) {
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
function validateCoreEnv() {
    requireEnv("DATABASE_URL");
    requireEnv("JWT_ACCESS_SECRET");
    requireEnv("JWT_REFRESH_SECRET");
    requireIntEnv("BCRYPT_SALT_ROUNDS", 10);
}
function validateRuntimeEnv() {
    const warnings = [];
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
    const emailEnabled = ["1", "true", "yes", "on"].includes(String(process.env.EMAIL_ENABLED || "").trim().toLowerCase());
    if (emailEnabled) {
        const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"].filter((name) => !process.env[name] || String(process.env[name]).trim().length === 0);
        if (missing.length > 0) {
            warnings.push({
                name: missing[0],
                message: `EMAIL_ENABLED is true but ${missing.join(", ")} is not set; verification and notification emails cannot be delivered.`
            });
        }
    }
    else {
        warnings.push({
            name: "EMAIL_ENABLED",
            message: "EMAIL_ENABLED is not true; transactional emails (including email verification) will not be delivered."
        });
    }
    return warnings;
}
function logEnvWarnings() {
    for (const warning of validateRuntimeEnv()) {
        // eslint-disable-next-line no-console
        console.warn(`[env] ${warning.name}: ${warning.message}`);
    }
}
