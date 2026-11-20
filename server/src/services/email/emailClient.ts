import { Resend } from "resend";

export interface EmailSendRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /**
   * Optional stable idempotency key. When supplied it is forwarded to Resend as
   * the `Idempotency-Key` header, so a retried send (for example by a background
   * job that runs twice) is de-duplicated by the provider rather than delivering
   * the same message again.
   */
  idempotencyKey?: string;
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

let cachedResend: Resend | null = null;
let cachedFrom: string | null = null;

export function isEmailEnabled(): boolean {
  return getBoolEnv("EMAIL_ENABLED", false);
}

/**
 * Development-only outbox. When enabled (and never in production) every
 * outgoing message is captured in memory so a developer can complete the
 * verification flow end to end without configuring an email provider. It is
 * strictly opt-in through `EMAIL_DEV_OUTBOX_ENABLED` and exposes nothing unless
 * the developer asks for it.
 */
export interface EmailOutboxEntry {
  capturedAt: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const OUTBOX_LIMIT = 25;
const emailOutbox: EmailOutboxEntry[] = [];

export function isEmailOutboxEnabled(): boolean {
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  return !isProduction && getBoolEnv("EMAIL_DEV_OUTBOX_ENABLED", false);
}

export function recordEmailInOutbox(payload: EmailSendRequest): void {
  if (!isEmailOutboxEnabled()) return;
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

export function getEmailOutbox(): EmailOutboxEntry[] {
  return emailOutbox.slice();
}

export function clearEmailOutbox(): void {
  emailOutbox.length = 0;
}

/**
 * The official public application URL. This is the single source of truth for
 * every link rendered into an email (verification, password reset, CTAs and the
 * footer), so no message can ever point at a decommissioned host.
 */
export const OFFICIAL_APP_BASE_URL = "https://nexocrypto.org";

/**
 * Hosts that must never appear in a user-facing link (for example the retired
 * Vercel frontend). A stale value in the environment is ignored rather than
 * surfaced to users.
 */
const LEGACY_APP_HOSTS = [/(^|\.)vercel\.app$/i];

function sanitizeBaseUrl(candidate: string | undefined): string | null {
  const raw = String(candidate ?? "").trim();
  if (!raw) return null;
  const url = raw.replace(/\/+$/, "");
  try {
    const { hostname } = new URL(url);
    if (LEGACY_APP_HOSTS.some((pattern) => pattern.test(hostname))) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Resolves the application base URL used for email links.
 *
 * Precedence: `APP_BASE_URL` -> `PUBLIC_APP_URL` -> `FRONTEND_URL` -> the
 * official domain. Any candidate pointing at a legacy host (e.g. `*.vercel.app`)
 * is skipped, guaranteeing emails always link to the NexaCrypto domain.
 */
export function getAppBaseUrl(): string {
  const configured = [
    process.env.APP_BASE_URL,
    process.env.PUBLIC_APP_URL,
    process.env.FRONTEND_URL
  ];
  for (const candidate of configured) {
    const url = sanitizeBaseUrl(candidate);
    if (url) return url;
  }
  return OFFICIAL_APP_BASE_URL;
}

export function getMailFrom(): string {
  if (cachedFrom) return cachedFrom;
  const from = process.env.EMAIL_FROM || "NexaCrypto <no-reply@nexocrypto.org>";
  cachedFrom = from;
  return from;
}

/**
 * Lazily constructs the single shared Resend client. The API key is read only
 * from the backend environment (`RESEND_API_KEY`) and is never logged, echoed
 * or returned to callers — a missing key fails fast rather than silently
 * dropping mail.
 */
export function getResendClient(): Resend {
  if (cachedResend) return cachedResend;
  const apiKey = requireEmailEnv("RESEND_API_KEY");
  cachedResend = new Resend(apiKey);
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
export async function sendEmail(payload: EmailSendRequest): Promise<void> {
  // Capture a development copy first (no-op in production), so local flows can
  // be completed even when no provider is configured.
  recordEmailInOutbox(payload);

  if (!isEmailEnabled()) {
    return;
  }

  const resend = getResendClient();
  const from = getMailFrom();

  const { data, error } = await resend.emails.send(
    {
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    },
    payload.idempotencyKey ? { idempotencyKey: payload.idempotencyKey } : undefined
  );

  if (error) {
    // Normalise Resend's structured error into an Error so upstream delivery
    // bookkeeping records a failure (and retries) instead of a false success.
    throw new Error(`Resend rejected the email (${error.name}): ${error.message}`);
  }
  if (!data || !data.id) {
    throw new Error("Resend returned no message id; treating the send as failed.");
  }
}
