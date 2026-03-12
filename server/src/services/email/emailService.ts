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
import { getAppBaseUrl, isEmailEnabled } from "./emailClient";

function safeFireAndForget(promise: Promise<void>): void {
  promise.catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("[email] send failed", String(err));
  });
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

