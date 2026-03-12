"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAdminAccount = ensureAdminAccount;
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const sequelize_1 = require("sequelize");
const env_1 = require("../config/env");
const User_1 = require("../models/User");
function normalizeEmail(email) {
    return String(email || "")
        .trim()
        .toLowerCase();
}
function looksLikeEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function generatePassword() {
    return crypto_1.default.randomBytes(18).toString("base64url");
}
async function ensureAdminAccount() {
    const existingAdmin = await User_1.User.findOne({ where: { is_admin: true } });
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
    const bootstrapPassword = envPassword && String(envPassword).trim().length > 0
        ? String(envPassword)
        : isProd
            ? (() => {
                throw new Error("ADMIN_BOOTSTRAP_PASSWORD is required in production when no admin exists.");
            })()
            : generatePassword();
    const saltRounds = (0, env_1.requireIntEnv)("BCRYPT_SALT_ROUNDS", 10);
    const hashed = await bcrypt_1.default.hash(bootstrapPassword, saltRounds);
    const existingUser = await User_1.User.findOne({
        where: {
            email: {
                [sequelize_1.Op.iLike]: bootstrapEmail
            }
        }
    });
    if (existingUser) {
        existingUser.is_admin = true;
        existingUser.password = hashed;
        await existingUser.save();
    }
    else {
        await User_1.User.create({
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
    (0, env_1.requireEnv)("JWT_ACCESS_SECRET");
    (0, env_1.requireEnv)("JWT_REFRESH_SECRET");
}
