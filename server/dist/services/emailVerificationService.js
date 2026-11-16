"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmailVerificationExpiryMinutes = getEmailVerificationExpiryMinutes;
exports.getEmailVerificationResendCooldownSeconds = getEmailVerificationResendCooldownSeconds;
exports.maskEmail = maskEmail;
exports.createEmailVerificationTokenForUser = createEmailVerificationTokenForUser;
exports.consumeEmailVerificationToken = consumeEmailVerificationToken;
exports.pruneEmailVerificationTokens = pruneEmailVerificationTokens;
exports.getVerificationResendAvailableAt = getVerificationResendAvailableAt;
const crypto_1 = __importDefault(require("crypto"));
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const EmailVerificationToken_1 = require("../models/EmailVerificationToken");
const User_1 = require("../models/User");
const DEFAULT_TTL_MINUTES = 30;
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 1440;
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const USED_TOKEN_RETENTION_MS = 24 * 60 * 60 * 1000;
function sha256(input) {
    return crypto_1.default.createHash("sha256").update(input, "utf8").digest("hex");
}
function randomToken() {
    return crypto_1.default.randomBytes(32).toString("base64url");
}
function getEmailVerificationExpiryMinutes() {
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
function getEmailVerificationResendCooldownSeconds() {
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
function maskEmail(email) {
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
async function createEmailVerificationTokenForUser(user) {
    const token = randomToken();
    const tokenHash = sha256(token);
    const expiresMinutes = getEmailVerificationExpiryMinutes();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresMinutes * 60 * 1000);
    await database_1.sequelize.transaction(async (transaction) => {
        await EmailVerificationToken_1.EmailVerificationToken.update({ used_at: now }, { where: { user_id: user.user_id, used_at: { [sequelize_1.Op.is]: null } }, transaction });
        await EmailVerificationToken_1.EmailVerificationToken.create({
            user_id: user.user_id,
            token_hash: tokenHash,
            expires_at: expiresAt
        }, { transaction });
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
async function consumeEmailVerificationToken(args) {
    const tokenHash = sha256(String(args.token || ""));
    const now = new Date();
    return database_1.sequelize.transaction(async (transaction) => {
        const record = await EmailVerificationToken_1.EmailVerificationToken.findOne({
            where: { token_hash: tokenHash },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!record) {
            return { status: "invalid" };
        }
        const user = await User_1.User.findByPk(record.user_id, {
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
        await EmailVerificationToken_1.EmailVerificationToken.update({ used_at: now }, { where: { user_id: user.user_id, used_at: { [sequelize_1.Op.is]: null } }, transaction });
        return { status: "verified", user };
    });
}
async function pruneEmailVerificationTokens() {
    const now = new Date();
    const usedCutoff = new Date(now.getTime() - USED_TOKEN_RETENTION_MS);
    await EmailVerificationToken_1.EmailVerificationToken.destroy({
        where: {
            [sequelize_1.Op.or]: [
                { expires_at: { [sequelize_1.Op.lte]: now } },
                { used_at: { [sequelize_1.Op.lte]: usedCutoff } }
            ]
        }
    });
}
/**
 * Returns the moment a new verification email may be requested again, or null
 * when the user has no outstanding request.
 */
async function getVerificationResendAvailableAt(userId) {
    const cooldownSeconds = getEmailVerificationResendCooldownSeconds();
    if (cooldownSeconds <= 0) {
        return null;
    }
    const latest = await EmailVerificationToken_1.EmailVerificationToken.findOne({
        where: { user_id: userId },
        order: [["created_at", "DESC"]]
    });
    if (!latest) {
        return null;
    }
    const availableAt = new Date(latest.created_at.getTime() + cooldownSeconds * 1000);
    return availableAt.getTime() > Date.now() ? availableAt : null;
}
