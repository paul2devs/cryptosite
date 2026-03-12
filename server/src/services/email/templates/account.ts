import { getAppBaseUrl } from "../emailClient";
import { renderEmailLayout } from "./layout";

export function renderWelcomeEmail(args: { name: string }): { subject: string; html: string } {
  const baseUrl = getAppBaseUrl();
  const subject = "Welcome to Crypto Levels — your account is ready";
  const html = renderEmailLayout({
    title: "Welcome to Crypto Levels",
    preheader: "Your account is ready. Start with a verified deposit to unlock levels and multipliers.",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <p style="margin:0 0 12px 0;">Your Crypto Levels account is now active. Once you submit an on-chain deposit and it’s approved, you’ll start earning XP, unlocking levels, and compounding rewards through multipliers and streaks.</p>
      <div style="margin:14px 0;padding:14px;border-radius:16px;background:#17181A;border:1px solid rgba(38,39,43,0.9);">
        <p style="margin:0;color:#F5F5F7;font-size:13px;line-height:20px;"><strong>Security note:</strong> We’ll never ask you for your password. Reset links are one-time and expire quickly.</p>
      </div>
    `,
    ctaLabel: "Open dashboard",
    ctaHref: `${baseUrl}/`
  });
  return { subject, html };
}

export function renderPasswordResetRequestEmail(args: {
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): { subject: string; html: string } {
  const subject = "Reset your Crypto Levels password";
  const html = renderEmailLayout({
    title: "Reset your password",
    preheader: "Use this secure link to reset your password. It expires soon.",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <p style="margin:0 0 12px 0;">We received a request to reset your password. Use the secure link below to set a new password.</p>
      <div style="margin:14px 0;padding:14px;border-radius:16px;background:#17181A;border:1px solid rgba(38,39,43,0.9);">
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">This link expires in <strong style="color:#F5F5F7;">${args.expiresMinutes} minutes</strong> and can only be used once.</p>
      </div>
      <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">If you didn’t request this, you can ignore this email.</p>
    `,
    ctaLabel: "Reset password",
    ctaHref: args.resetUrl
  });
  return { subject, html };
}

export function renderPasswordChangedEmail(args: { name: string }): { subject: string; html: string } {
  const baseUrl = getAppBaseUrl();
  const subject = "Your Crypto Levels password was changed";
  const html = renderEmailLayout({
    title: "Password updated",
    preheader: "Your password was changed successfully.",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <p style="margin:0 0 12px 0;">Your password was updated successfully. If you didn’t do this, reset your password immediately and contact support.</p>
    `,
    ctaLabel: "Sign in",
    ctaHref: `${baseUrl}/login`
  });
  return { subject, html };
}

function escapeInline(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

