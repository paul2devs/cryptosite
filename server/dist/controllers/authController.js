"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refreshToken = refreshToken;
exports.me = me;
exports.verifyEmail = verifyEmail;
exports.resendVerification = resendVerification;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
const express_validator_1 = require("express-validator");
const User_1 = require("../models/User");
const jwt_1 = require("../utils/jwt");
const Referral_1 = require("../models/Referral");
const referralCode_1 = require("../utils/referralCode");
const sequelize_1 = require("sequelize");
const activityService_1 = require("../services/activityService");
const emailService_1 = require("../services/email/emailService");
const passwordResetService_1 = require("../services/passwordResetService");
const emailVerificationService_1 = require("../services/emailVerificationService");
const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
function getAuthCookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: (isProduction ? "none" : "lax"),
        path: "/"
    };
}
async function register(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { name, email, password, walletAddress, referralCode } = req.body;
    try {
        const existing = await User_1.User.findOne({ where: { email } });
        if (existing) {
            res.status(409).json({ message: "Email already registered" });
            return;
        }
        const hashed = await bcrypt_1.default.hash(password, saltRounds);
        let code = null;
        for (let i = 0; i < 5; i += 1) {
            const candidate = (0, referralCode_1.generateReferralCode)();
            const exists = await User_1.User.findOne({
                where: {
                    referral_code: candidate
                }
            });
            if (!exists) {
                code = candidate;
                break;
            }
        }
        if (!code) {
            res.status(500).json({ message: "Failed to allocate referral code" });
            return;
        }
        const normalizedWalletAddress = typeof walletAddress === "string" ? walletAddress.trim() : "";
        const user = await User_1.User.create({
            name,
            email,
            password: hashed,
            crypto_wallets: normalizedWalletAddress ? [{ address: normalizedWalletAddress }] : [],
            referral_code: code,
            referred_by: null
        });
        if (referralCode) {
            const referrer = await User_1.User.findOne({
                where: {
                    referral_code: { [sequelize_1.Op.eq]: referralCode }
                }
            });
            if (referrer && referrer.user_id !== user.user_id) {
                const existingReferral = await Referral_1.Referral.findOne({
                    where: { referred_user_id: user.user_id }
                });
                if (!existingReferral) {
                    await Referral_1.Referral.create({
                        referrer_id: referrer.user_id,
                        referred_user_id: user.user_id
                    });
                    user.referred_by = referrer.user_id;
                    await user.save();
                }
            }
        }
        // Email verification is mandatory, so registration deliberately does NOT
        // open a session. The account stays inaccessible until the emailed link is
        // opened and the token is validated on the server.
        const { token, expiresMinutes } = await (0, emailVerificationService_1.createEmailVerificationTokenForUser)(user);
        (0, emailService_1.sendEmailVerificationEmail)({
            to: user.email,
            name: user.name,
            token,
            expiresMinutes
        });
        // The freshly issued token starts the resend cooldown, so the screen can
        // show an accurate countdown instead of an enabled button that would be
        // silently rate-limited server-side.
        const resendAvailableAt = await (0, emailVerificationService_1.getVerificationResendAvailableAt)(user.user_id);
        res.status(201).json({
            message: "Account created. Check your inbox to verify your email address.",
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                email_verified: false,
                is_admin: user.is_admin,
                referral_code: user.referral_code
            },
            verification: {
                required: true,
                email: (0, emailVerificationService_1.maskEmail)(user.email),
                expiresMinutes,
                resendAvailableAt: resendAvailableAt ? resendAvailableAt.toISOString() : null
            }
        });
        await (0, activityService_1.trackUserActivity)(user.user_id, "email_verification_request", {
            source: "register"
        });
    }
    catch (error) {
        res.status(500).json({ message: "Registration failed" });
    }
}
async function login(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { email, password } = req.body;
    try {
        const user = await User_1.User.findOne({ where: { email } });
        if (!user) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        const match = await bcrypt_1.default.compare(password, user.password);
        if (!match) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        // Correct credentials, but the address has not been confirmed: the account
        // must not be misrepresented as a credential failure.
        if (!user.email_verified) {
            const resendAvailableAt = await (0, emailVerificationService_1.getVerificationResendAvailableAt)(user.user_id);
            res.status(403).json({
                message: "Please verify your email address before signing in.",
                code: "EMAIL_NOT_VERIFIED",
                email: (0, emailVerificationService_1.maskEmail)(user.email),
                resendAvailableAt: resendAvailableAt ? resendAvailableAt.toISOString() : null
            });
            return;
        }
        const payload = { userId: user.user_id, isAdmin: user.is_admin };
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload);
        const cookieOptions = getAuthCookieOptions();
        res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
        res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        res.status(200).json({
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                level: user.level,
                xp: user.xp,
                streak: user.streak,
                pending_earnings: user.pending_earnings,
                is_admin: user.is_admin,
                referral_code: user.referral_code,
                referred_by: user.referred_by
            },
            accessToken,
            refreshToken
        });
        await (0, activityService_1.trackUserActivity)(user.user_id, "login", { source: "login" });
    }
    catch (error) {
        res.status(500).json({ message: "Login failed" });
    }
}
async function refreshToken(req, res) {
    const { refreshToken: bodyToken } = req.body;
    const cookieToken = typeof req.cookies?.refreshToken === "string" && req.cookies.refreshToken.length > 0
        ? req.cookies.refreshToken
        : undefined;
    const token = bodyToken || cookieToken;
    if (!token) {
        res.status(400).json({ message: "Refresh token required" });
        return;
    }
    try {
        // `verifyRefreshToken` returns the decoded payload including `iat`/`exp`.
        // Those must not be forwarded to `jwt.sign` together with `expiresIn`,
        // otherwise jsonwebtoken throws and every refresh request fails with 401.
        const { userId, isAdmin } = (0, jwt_1.verifyRefreshToken)(token);
        // A refresh must not resurrect a session for an account whose email is no
        // longer verified (defence in depth: unverified accounts never receive a
        // refresh token in the first place).
        const user = await User_1.User.findByPk(userId);
        if (!user || (!user.email_verified && !user.is_admin)) {
            res.status(403).json({
                message: "Please verify your email address before signing in.",
                code: "EMAIL_NOT_VERIFIED"
            });
            return;
        }
        const accessToken = (0, jwt_1.signAccessToken)({ userId, isAdmin });
        const cookieOptions = getAuthCookieOptions();
        res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
        res.status(200).json({ accessToken });
    }
    catch (error) {
        res.status(401).json({ message: "Invalid refresh token" });
    }
}
async function me(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        res.status(200).json({
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                level: user.level,
                xp: user.xp,
                streak: user.streak,
                pending_earnings: user.pending_earnings,
                is_admin: user.is_admin,
                email_verified: user.email_verified,
                referral_code: user.referral_code,
                referred_by: user.referred_by
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch profile" });
    }
}
/**
 * Consumes a single-use verification token.
 *
 * The response is intentionally explicit about the outcome so the verification
 * screen can render the right state, but it never echoes the token or any
 * backend detail.
 */
async function verifyEmail(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({
            status: "invalid",
            code: "VERIFICATION_TOKEN_INVALID",
            message: "This verification link is invalid or has already been used."
        });
        return;
    }
    const { token } = req.body;
    try {
        const result = await (0, emailVerificationService_1.consumeEmailVerificationToken)({ token: String(token || "") });
        if (result.status === "verified") {
            (0, emailService_1.sendWelcomeEmail)({ to: result.user.email, name: result.user.name });
            await (0, activityService_1.trackUserActivity)(result.user.user_id, "email_verified", {
                source: "verification_link"
            });
            res.status(200).json({
                status: "verified",
                email_verified: true,
                message: "Your email address has been confirmed."
            });
            return;
        }
        if (result.status === "already_verified") {
            res.status(200).json({
                status: "already_verified",
                email_verified: true,
                message: "Your email address is already confirmed."
            });
            return;
        }
        if (result.status === "expired") {
            res.status(410).json({
                status: "expired",
                code: "VERIFICATION_TOKEN_EXPIRED",
                message: "This verification link has expired."
            });
            return;
        }
        res.status(400).json({
            status: "invalid",
            code: "VERIFICATION_TOKEN_INVALID",
            message: "This verification link is invalid or has already been used."
        });
    }
    catch {
        res.status(400).json({
            status: "invalid",
            code: "VERIFICATION_TOKEN_INVALID",
            message: "This verification link is invalid or has already been used."
        });
    }
}
/**
 * Requests a fresh verification email.
 *
 * The response is identical whether or not an account exists for the address,
 * so the endpoint cannot be used to enumerate accounts. The account's own
 * cooldown is enforced silently, while HTTP-level rate limiting protects the
 * email provider from abuse.
 */
async function resendVerification(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const cooldownSeconds = (0, emailVerificationService_1.getEmailVerificationResendCooldownSeconds)();
    const genericResponse = {
        ok: true,
        message: "If an account exists for that address, a new verification email has been sent.",
        cooldownSeconds
    };
    try {
        await (0, emailVerificationService_1.pruneEmailVerificationTokens)();
        const user = await User_1.User.findOne({ where: { email: normalizedEmail } });
        if (user && !user.email_verified) {
            const availableAt = await (0, emailVerificationService_1.getVerificationResendAvailableAt)(user.user_id);
            if (!availableAt) {
                const { token, expiresMinutes } = await (0, emailVerificationService_1.createEmailVerificationTokenForUser)(user);
                (0, emailService_1.sendEmailVerificationEmail)({
                    to: user.email,
                    name: user.name,
                    token,
                    expiresMinutes
                });
                await (0, activityService_1.trackUserActivity)(user.user_id, "email_verification_request", {
                    source: "resend"
                });
            }
        }
        res.status(200).json(genericResponse);
    }
    catch {
        res.status(200).json(genericResponse);
    }
}
async function forgotPassword(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    try {
        await (0, passwordResetService_1.pruneExpiredPasswordResetTokens)();
        const user = await User_1.User.findOne({ where: { email: normalizedEmail } });
        if (user) {
            const { token, expiresMinutes } = await (0, passwordResetService_1.createPasswordResetTokenForUser)(user);
            (0, emailService_1.sendPasswordResetEmail)({
                to: user.email,
                name: user.name,
                token,
                expiresMinutes
            });
            await (0, activityService_1.trackUserActivity)(user.user_id, "password_reset_request", {
                source: "forgot_password"
            });
        }
        res.status(200).json({ ok: true });
    }
    catch {
        res.status(200).json({ ok: true });
    }
}
async function resetPassword(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { token, password } = req.body;
    const newPassword = String(password || "");
    const rawToken = String(token || "");
    if (newPassword.length < 8) {
        res.status(400).json({ message: "Password must be at least 8 characters." });
        return;
    }
    try {
        const { user } = await (0, passwordResetService_1.consumePasswordResetToken)({ token: rawToken });
        const hashed = await bcrypt_1.default.hash(newPassword, saltRounds);
        user.password = hashed;
        await user.save();
        (0, emailService_1.sendPasswordChangedEmail)({ to: user.email, name: user.name });
        await (0, activityService_1.trackUserActivity)(user.user_id, "password_reset_complete", {
            source: "reset_password"
        });
        res.status(200).json({ ok: true });
    }
    catch {
        res.status(400).json({ message: "Invalid, expired, or already used token." });
    }
}
