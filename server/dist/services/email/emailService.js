"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVerificationUrl = buildVerificationUrl;
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendEmailVerificationEmail = sendEmailVerificationEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendPasswordChangedEmail = sendPasswordChangedEmail;
exports.sendReferralRewardEmail = sendReferralRewardEmail;
exports.sendAccountEventEmail = sendAccountEventEmail;
const emailClient_1 = require("./emailClient");
const account_1 = require("./templates/account");
const activity_1 = require("./templates/activity");
const verification_1 = require("./templates/verification");
const events_1 = require("./templates/events");
const emailClient_2 = require("./emailClient");
function safeFireAndForget(promise) {
    promise.catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[email] send failed", String(err));
    });
}
/** Builds the single-use verification URL the email button links to. */
function buildVerificationUrl(token) {
    const baseUrl = (0, emailClient_2.getAppBaseUrl)();
    return `${baseUrl}/verify-email/${encodeURIComponent(token)}`;
}
/**
 * Sends the branded verification email.
 *
 * Delivery is intentionally decoupled from account state: a send failure is
 * logged and swallowed, and the account is never marked verified here. The
 * account only becomes verified once the token is validated through the
 * verification endpoint.
 */
async function sendVerificationEmail(args) {
    const verifyUrl = buildVerificationUrl(args.token);
    const { subject, html, text } = (0, verification_1.renderVerificationEmail)({
        name: args.name,
        verifyUrl,
        expiresMinutes: args.expiresMinutes
    });
    await (0, emailClient_1.sendEmail)({ to: args.to, subject, html, text });
}
function sendEmailVerificationEmail(args) {
    // `sendEmail` records a development outbox copy (when enabled) and skips the
    // SMTP transport entirely when email delivery is disabled, so a single call
    // correctly covers both real delivery and local development.
    safeFireAndForget(sendVerificationEmail(args));
}
function sendWelcomeEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, account_1.renderWelcomeEmail)({ name: args.name });
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendPasswordResetEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const baseUrl = (0, emailClient_2.getAppBaseUrl)();
    const resetUrl = `${baseUrl}/reset-password/${encodeURIComponent(args.token)}`;
    const { subject, html } = (0, account_1.renderPasswordResetRequestEmail)({
        name: args.name,
        resetUrl,
        expiresMinutes: args.expiresMinutes
    });
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendPasswordChangedEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, account_1.renderPasswordChangedEmail)({ name: args.name });
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendReferralRewardEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, activity_1.renderReferralRewardEmail)(args);
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
/**
 * Polymorphic account-event email (deposits, withdrawals, investments,
 * earnings, rewards, membership and security events). Rendered through the one
 * shared `renderAccountEventEmail` template so every financial/account email
 * keeps NexaCrypto branding and a consistent layout.
 *
 * Unlike the fire-and-forget helpers above, this resolves/rejects with the real
 * transport outcome so the caller can record an accurate delivery status and
 * retry a failure — it is never used to gate a financial transaction.
 */
async function sendAccountEventEmail(args) {
    const { subject, html } = (0, events_1.renderAccountEventEmail)(args);
    const detailLines = (args.details ?? [])
        .map((detail) => `${detail.label}: ${detail.value}`)
        .join("\n");
    const text = [args.heading, "", args.message, detailLines ? `\n${detailLines}` : ""]
        .join("\n")
        .trim();
    await (0, emailClient_1.sendEmail)({ to: args.to, subject, html, text });
}
