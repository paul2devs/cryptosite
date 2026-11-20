"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailEnabled = isEmailEnabled;
exports.isEmailOutboxEnabled = isEmailOutboxEnabled;
exports.recordEmailInOutbox = recordEmailInOutbox;
exports.getEmailOutbox = getEmailOutbox;
exports.clearEmailOutbox = clearEmailOutbox;
exports.getAppBaseUrl = getAppBaseUrl;
exports.getMailFrom = getMailFrom;
exports.getResendClient = getResendClient;
exports.sendEmail = sendEmail;
const resend_1 = require("resend");
function getBoolEnv(name, defaultValue) {
    const raw = process.env[name];
    if (!raw)
        return defaultValue;
    const v = String(raw).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(v))
        return true;
    if (["0", "false", "no", "off"].includes(v))
        return false;
    return defaultValue;
}
function requireEmailEnv(name) {
    const value = process.env[name];
    if (!value || String(value).trim().length === 0) {
        throw new Error(`Missing required email environment variable: ${name}`);
    }
    return String(value).trim();
}
let cachedResend = null;
let cachedFrom = null;
function isEmailEnabled() {
    return getBoolEnv("EMAIL_ENABLED", false);
}
const OUTBOX_LIMIT = 25;
const emailOutbox = [];
function isEmailOutboxEnabled() {
    const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
    return !isProduction && getBoolEnv("EMAIL_DEV_OUTBOX_ENABLED", false);
}
function recordEmailInOutbox(payload) {
    if (!isEmailOutboxEnabled())
        return;
    emailOutbox.unshift({
        capturedAt: new Date().toISOString(),
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text
    });
    if (emailOutbox.length > OUTBOX_LIMIT) {
        emailOutbox.length = OUTBOX_LIMIT;
    }
}
function getEmailOutbox() {
    return emailOutbox.slice();
}
function clearEmailOutbox() {
    emailOutbox.length = 0;
}
function getAppBaseUrl() {
    const raw = process.env.APP_BASE_URL ||
        process.env.PUBLIC_APP_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:5173";
    return String(raw).replace(/\/+$/, "");
}
function getMailFrom() {
    if (cachedFrom)
        return cachedFrom;
    const from = process.env.EMAIL_FROM || "NexaCrypto <no-reply@nexacrypto.com>";
    cachedFrom = from;
    return from;
}
/**
 * Lazily constructs the single shared Resend client. The API key is read only
 * from the backend environment (`RESEND_API_KEY`) and is never logged, echoed
 * or returned to callers — a missing key fails fast rather than silently
 * dropping mail.
 */
function getResendClient() {
    if (cachedResend)
        return cachedResend;
    const apiKey = requireEmailEnv("RESEND_API_KEY");
    cachedResend = new resend_1.Resend(apiKey);
    return cachedResend;
}
/**
 * Sends one transactional email through Resend.
 *
 * Unlike the old SMTP transport, Resend reports failures in its resolved
 * response rather than throwing, so the `error` field is inspected explicitly
 * and converted into a thrown error. This keeps the contract callers rely on
 * (`sendEmail` resolves only on a real delivery hand-off, rejects otherwise),
 * which is what the notification delivery ledger uses to record an accurate
 * status and decide whether a retry is safe.
 */
async function sendEmail(payload) {
    // Capture a development copy first (no-op in production), so local flows can
    // be completed even when no provider is configured.
    recordEmailInOutbox(payload);
    if (!isEmailEnabled()) {
        return;
    }
    const resend = getResendClient();
    const from = getMailFrom();
    const { data, error } = await resend.emails.send({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text
    }, payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined);
    if (error) {
        // Normalise Resend's structured error into an Error so upstream delivery
        // bookkeeping records a failure (and retries) instead of a false success.
        throw new Error(`Resend rejected the email (${error.name}): ${error.message}`);
    }
    if (!data || !data.id) {
        throw new Error("Resend returned no message id; treating the send as failed.");
    }
}
