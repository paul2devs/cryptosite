import { getAppBaseUrl } from "../emailClient";
import {
  escapeHtml,
  renderBrandEmailShell,
  renderBrandFooter,
  renderBrandHeader,
  renderDetailCard,
  renderEmailButton,
  renderFallbackLink,
  renderHero,
  renderNotice
} from "./brand";

export function renderWelcomeEmail(args: { name: string }): { subject: string; html: string } {
  const baseUrl = getAppBaseUrl();
  const subject = "Welcome to NexaCrypto: your account is ready";
  const preheader =
    "Your account is ready. Start with a verified deposit to unlock levels and multipliers.";

  const contentHtml = `${renderBrandHeader({ label: "Welcome" })}
${renderHero({
  eyebrow: "Account activated",
  heading: "Welcome to NexaCrypto",
  support:
    "Your account is live. Here is the fastest path from sign-up to your first compounded reward."
})}
<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi <strong>${escapeHtml(
    args.name
  )}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">Thanks for joining NexaCrypto. Once you submit an on-chain deposit and it is approved, you will start earning XP, unlocking levels, and compounding rewards through multipliers and streaks.</p>
${renderDetailCard({
  title: "Your next steps",
  rows: [
    { label: "1. Verify your email", value: "Secure your account in one click" },
    { label: "2. Make your first deposit", value: "Verified on-chain deposits unlock your tiers" },
    { label: "3. Unlock levels", value: "Compound rewards as your balance grows" }
  ]
})}
${renderEmailButton({ href: `${baseUrl}/`, label: "OPEN DASHBOARD" })}
${renderNotice({
  title: "Security note",
  tone: "info",
  body: "We will never ask you for your password. Password reset links are one-time and expire quickly."
})}
${renderBrandFooter({ websiteUrl: baseUrl })}`;

  const html = renderBrandEmailShell({ title: subject, preheader, contentHtml });
  return { subject, html };
}

export function renderPasswordResetRequestEmail(args: {
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): { subject: string; html: string } {
  const baseUrl = getAppBaseUrl();
  const subject = "Reset your NexaCrypto password";
  const preheader = "Use this secure link to reset your password. It expires soon.";

  const contentHtml = `${renderBrandHeader({ label: "Account Security" })}
${renderHero({
  eyebrow: "Password reset",
  heading: "Reset your password",
  support: "Use the secure link below to choose a new password for your NexaCrypto account."
})}
<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi <strong>${escapeHtml(
    args.name
  )}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">We received a request to reset your password. Choose a new one using the secure link below.</p>
${renderEmailButton({ href: args.resetUrl, label: "RESET PASSWORD" })}
${renderFallbackLink({
  intro: "Button not working? Copy and paste this secure link into your browser.",
  url: args.resetUrl
})}
${renderDetailCard({
  title: "Link details",
  rows: [
    { label: "Expires in", value: `${args.expiresMinutes} minutes`, emphasize: true },
    { label: "Single use", value: "This link can only be used once" }
  ]
})}
${renderNotice({
  title: "Didn't request this?",
  tone: "neutral",
  body: "If you didn't request a password reset, you can safely ignore this email. Your password will not change."
})}
${renderBrandFooter({ websiteUrl: baseUrl })}`;

  const html = renderBrandEmailShell({ title: subject, preheader, contentHtml });
  return { subject, html };
}

export function renderPasswordChangedEmail(args: { name: string }): { subject: string; html: string } {
  const baseUrl = getAppBaseUrl();
  const subject = "Your NexaCrypto password was changed";
  const preheader = "Your password was changed successfully.";

  const contentHtml = `${renderBrandHeader({ label: "Account Security" })}
${renderHero({
  eyebrow: "Password updated",
  heading: "Your password was changed",
  support: "This is a confirmation that the password on your NexaCrypto account was updated."
})}
<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi <strong>${escapeHtml(
    args.name
  )}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">Your password was updated successfully. You can sign in with your new password at any time.</p>
${renderNotice({
  title: "Not you?",
  tone: "warning",
  body: "If you did not make this change, reset your password immediately and contact support right away."
})}
${renderEmailButton({ href: `${baseUrl}/login`, label: "SIGN IN", variant: "secondary" })}
${renderBrandFooter({ websiteUrl: baseUrl })}`;

  const html = renderBrandEmailShell({ title: subject, preheader, contentHtml });
  return { subject, html };
}
