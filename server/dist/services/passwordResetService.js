"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPasswordResetTokenForUser = createPasswordResetTokenForUser;
exports.consumePasswordResetToken = consumePasswordResetToken;
exports.pruneExpiredPasswordResetTokens = pruneExpiredPasswordResetTokens;
const crypto_1 = __importDefault(require("crypto"));
const sequelize_1 = require("sequelize");
const PasswordResetToken_1 = require("../models/PasswordResetToken");
const User_1 = require("../models/User");
function sha256(input) {
    return crypto_1.default.createHash("sha256").update(input, "utf8").digest("hex");
}
function randomToken() {
    return crypto_1.default.randomBytes(32).toString("base64url");
}
function getResetExpiryMinutes() {
    const raw = process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES;
    const parsed = raw ? Number(raw) : 30;
    if (!Number.isFinite(parsed) || parsed < 10 || parsed > 180) {
        return 30;
    }
    return Math.floor(parsed);
}
async function createPasswordResetTokenForUser(user) {
    const token = randomToken();
    const tokenHash = sha256(token);
    const expiresMinutes = getResetExpiryMinutes();
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
    await PasswordResetToken_1.PasswordResetToken.create({
        user_id: user.user_id,
        token_hash: tokenHash,
        expires_at: expiresAt
    });
    return { token, expiresMinutes };
}
async function consumePasswordResetToken(args) {
    const tokenHash = sha256(args.token);
    const now = new Date();
    const record = await PasswordResetToken_1.PasswordResetToken.findOne({
        where: {
            token_hash: tokenHash,
            used_at: { [sequelize_1.Op.is]: null },
            expires_at: { [sequelize_1.Op.gt]: now }
        }
    });
    if (!record) {
        throw new Error("invalid_token");
    }
    const user = await User_1.User.findByPk(record.user_id);
    if (!user) {
        throw new Error("invalid_token");
    }
    record.used_at = now;
    await record.save();
    return { user };
}
async function pruneExpiredPasswordResetTokens() {
    const now = new Date();
    await PasswordResetToken_1.PasswordResetToken.destroy({
        where: {
            [sequelize_1.Op.or]: [
                { expires_at: { [sequelize_1.Op.lte]: now } },
                { used_at: { [sequelize_1.Op.not]: null } }
            ]
        }
    });
}
