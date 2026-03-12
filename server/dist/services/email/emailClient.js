"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailEnabled = isEmailEnabled;
exports.getAppBaseUrl = getAppBaseUrl;
exports.getMailFrom = getMailFrom;
exports.getTransporter = getTransporter;
exports.sendEmail = sendEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
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
let cachedTransporter = null;
let cachedFrom = null;
function isEmailEnabled() {
    return getBoolEnv("EMAIL_ENABLED", false);
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
    const from = process.env.EMAIL_FROM || "Crypto Levels <no-reply@cryptolevels.app>";
    cachedFrom = from;
    return from;
}
function getTransporter() {
    if (cachedTransporter)
        return cachedTransporter;
    const host = requireEmailEnv("SMTP_HOST");
    const port = Number(process.env.SMTP_PORT || "587");
    const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
    const user = requireEmailEnv("SMTP_USER");
    const pass = requireEmailEnv("SMTP_PASS");
    const pool = getBoolEnv("SMTP_POOL", true);
    const maxConnections = Number(process.env.SMTP_MAX_CONNECTIONS || "5");
    const maxMessages = Number(process.env.SMTP_MAX_MESSAGES || "100");
    cachedTransporter = nodemailer_1.default.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        pool,
        maxConnections: Number.isFinite(maxConnections) ? maxConnections : 5,
        maxMessages: Number.isFinite(maxMessages) ? maxMessages : 100
    });
    return cachedTransporter;
}
async function sendEmail(payload) {
    if (!isEmailEnabled()) {
        return;
    }
    const transporter = getTransporter();
    const from = getMailFrom();
    await transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text
    });
}
