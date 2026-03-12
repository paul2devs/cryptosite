import nodemailer from "nodemailer";

export interface EmailSendRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function getBoolEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const v = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return defaultValue;
}

function requireEmailEnv(name: string): string {
  const value = process.env[name];
  if (!value || String(value).trim().length === 0) {
    throw new Error(`Missing required email environment variable: ${name}`);
  }
  return String(value).trim();
}

let cachedTransporter: any | null = null;
let cachedFrom: string | null = null;

export function isEmailEnabled(): boolean {
  return getBoolEnv("EMAIL_ENABLED", false);
}

export function getAppBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173";
  return String(raw).replace(/\/+$/, "");
}

export function getMailFrom(): string {
  if (cachedFrom) return cachedFrom;
  const from = process.env.EMAIL_FROM || "Crypto Levels <no-reply@cryptolevels.app>";
  cachedFrom = from;
  return from;
}

export function getTransporter(): any {
  if (cachedTransporter) return cachedTransporter;

  const host = requireEmailEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || "587");
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;
  const user = requireEmailEnv("SMTP_USER");
  const pass = requireEmailEnv("SMTP_PASS");
  const pool = getBoolEnv("SMTP_POOL", true);
  const maxConnections = Number(process.env.SMTP_MAX_CONNECTIONS || "5");
  const maxMessages = Number(process.env.SMTP_MAX_MESSAGES || "100");

  cachedTransporter = nodemailer.createTransport({
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

export async function sendEmail(payload: EmailSendRequest): Promise<void> {
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

