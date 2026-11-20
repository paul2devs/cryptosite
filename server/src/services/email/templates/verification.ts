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

export interface VerificationEmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * The NexaCrypto verification email.
 *
 * Composed from the shared branded email primitives so this message inherits
 * the same design language as every other transactional email. The real
 * NexaCrypto logo is used in the header (served from the official domain) with
 * the wordmark as fallback alt text when remote images are blocked.
 *
 * `verifyUrl` is the only sensitive value and is always passed through the
 * escaping helpers inside the template primitives, so it can never inject
 * markup into the message. The CTA button and the plain-text fallback link
 * always point at the exact same URL/token.
 */
export function renderVerificationEmail(args: {
  name?: string;
  verifyUrl: string;
  expiresMinutes: number;
}): VerificationEmailContent {
  const websiteUrl = getAppBaseUrl();
  const expiresMinutes = Math.max(1, Math.floor(Number(args.expiresMinutes) || 30));
  const subject = "Verify your NexaCrypto email address";
  const preheader = `Confirm your email address to activate your NexaCrypto account. This link expires in ${expiresMinutes} minutes.`;

  const greeting = args.name && args.name.trim().length > 0 ? args.name.trim() : "";
  const greetingHtml = greeting
    ? `<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi ${escapeHtml(
        greeting
      )},</p>`
    : "";

  const contentHtml = `${renderBrandHeader({ label: "Account Security" })}
${renderHero({
  eyebrow: "Verify your email",
  heading: "One last step to activate your account",
  support:
    "Confirm this email address to secure your NexaCrypto account, then start investing with confidence."
})}
${greetingHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">
      Thanks for creating your NexaCrypto account. Before you continue, please confirm that this email address belongs to you.
    </td>
  </tr>
</table>
${renderEmailButton({ href: args.verifyUrl, label: "VERIFY EMAIL ADDRESS" })}
${renderFallbackLink({
  intro:
    "Having trouble with the button? Copy and paste the secure link below into your browser.",
  url: args.verifyUrl
})}
${renderDetailCard({
  title: "Verification details",
  rows: [
    { label: "Link expires in", value: `${expiresMinutes} minutes`, emphasize: true },
    { label: "Single use", value: "This link can only be used once" }
  ]
})}
${renderNotice({
  title: "Time-sensitive",
  tone: "warning",
  body: `This verification link expires in ${expiresMinutes} minutes. If it expires, request another verification email from the verification screen.`
})}
${renderNotice({
  title: "Didn't sign up?",
  tone: "neutral",
  body: "If you didn't create a NexaCrypto account, you can safely ignore this email. No action is required."
})}
${renderBrandFooter({ websiteUrl })}`;

  const html = renderBrandEmailShell({ title: subject, preheader, contentHtml });

  const text = [
    "NexaCrypto — Account security",
    "",
    "Confirm your email address",
    "",
    "Your NexaCrypto account is almost ready. Confirm your email address to securely continue.",
    "",
    greeting ? `Hi ${greeting},` : "",
    "Thanks for creating your NexaCrypto account. Before you continue, please confirm that this email address belongs to you.",
    "",
    "Verify your email address:",
    args.verifyUrl,
    "",
    `This verification link expires in ${expiresMinutes} minutes. If it expires, you can request another verification email from the verification screen.`,
    "",
    "If you didn't create a NexaCrypto account, you can safely ignore this email. No action is required.",
    "",
    `© ${new Date().getFullYear()} NexaCrypto. All rights reserved.`,
    "Your investments. Your direction.",
    websiteUrl
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n")
    .trim();

  return { subject, html, text };
}
