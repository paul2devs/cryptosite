"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireEnv = requireEnv;
exports.requireIntEnv = requireIntEnv;
exports.validateCoreEnv = validateCoreEnv;
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
