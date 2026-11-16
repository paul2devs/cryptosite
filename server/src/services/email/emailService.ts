import { sendEmail } from "./emailClient";
import {
  renderPasswordChangedEmail,
  renderPasswordResetRequestEmail,
  renderWelcomeEmail
} from "./templates/account";
import {
  renderDepositStatusEmail,
  renderLevelUpEmail,
  renderReferralRewardEmail,
  renderWithdrawalStatusEmail
} from "./templates/activity";
import { renderVerificationEmail } from "./templates/verification";
import { getAppBaseUrl, isEmailEnabled } from "./emailClient";

function safeFireAndForget(promise: Promise<void>): void {
  promise.catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("[email] send failed", String(err));
  });
}

/** Builds the single-use verification URL the email button links to. */
export function buildVerificationUrl(token: string): string {
  const baseUrl = getAppBaseUrl();
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
export async function sendVerificationEmail(args: {
  to: string;
  name?: string;
  token: string;
  expiresMinutes: number;
}): Promise<void> {
  const verifyUrl = buildVerificationUrl(args.token);
  const { subject, html, text } = renderVerificationEmail({
    name: args.name,
    verifyUrl,
    expiresMinutes: args.expiresMinutes
  });
  await sendEmail({ to: args.to, subject, html, text });
}

export function sendEmailVerificationEmail(args: {
  to: string;
  name?: string;
  token: string;
  expiresMinutes: number;
}): void {
  // `sendEmail` records a development outbox copy (when enabled) and skips the
  // SMTP transport entirely when email delivery is disabled, so a single call
  // correctly covers both real delivery and local development.
  safeFireAndForget(sendVerificationEmail(args));
}

export function sendWelcomeEmail(args: { to: string; name: string }): void {
  if (!isEmailEnabled()) return;
  const { subject, html } = renderWelcomeEmail({ name: args.name });
  safeFireAndForget(sendEmail({ to: args.to, subject, html }));
}

export function sendPasswordResetEmail(args: {
  to: string;
  name: string;
  token: string;
  expiresMinutes: number;
}): void {
  if (!isEmailEnabled()) return;
  const baseUrl = getAppBaseUrl();
  const resetUrl = `${baseUrl}/reset-password/${encodeURIComponent(args.token)}`;
  const { subject, html } = renderPasswordResetRequestEmail({
    name: args.name,
    resetUrl,
    expiresMinutes: args.expiresMinutes
  });
  safeFireAndForget(sendEmail({ to: args.to, subject, html }));
}

export function sendPasswordChangedEmail(args: { to: string; name: string }): void {
  if (!isEmailEnabled()) return;
  const { subject, html } = renderPasswordChangedEmail({ name: args.name });
  safeFireAndForget(sendEmail({ to: args.to, subject, html }));
}

export function sendDepositStatusEmail(args: {
  to: string;
  name: string;
  status: "Approved" | "Rejected" | "Pending";
  amount: number;
  asset: string;
}): void {
  if (!isEmailEnabled()) return;
  const { subject, html } = renderDepositStatusEmail(args);
  safeFireAndForget(sendEmail({ to: args.to, subject, html }));
}

export function sendWithdrawalStatusEmail(args: {
  to: string;
  name: string;
  status: "Approved" | "Rejected" | "Pending";
  amount: number;
}): void {
  if (!isEmailEnabled()) return;
  const { subject, html } = renderWithdrawalStatusEmail(args);
  safeFireAndForget(sendEmail({ to: args.to, subject, html }));
}

export function sendReferralRewardEmail(args: {
  to: string;
  name: string;
  bonusPercent: number;
  durationHours: number;
}): void {
  if (!isEmailEnabled()) return;
  const { subject, html } = renderReferralRewardEmail(args);
  safeFireAndForget(sendEmail({ to: args.to, subject, html }));
}

export function sendLevelUpEmail(args: {
  to: string;
  name: string;
  newLevel: number;
  multiplierPreview?: number;
}): void {
  if (!isEmailEnabled()) return;
  const { subject, html } = renderLevelUpEmail(args);
  safeFireAndForget(sendEmail({ to: args.to, subject, html }));
}

