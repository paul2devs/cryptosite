import { getAppBaseUrl } from "../emailClient";
import {
  EmailTone,
  escapeHtml,
  renderBrandEmailShell,
  renderBrandFooter,
  renderBrandHeader,
  renderDetailCard,
  renderEmailButton,
  renderHero
} from "./brand";

/**
 * Centralised transactional email template for account, financial and security
 * events.
 *
 * Every important notification (deposits, withdrawals, investments, earnings,
 * rewards, membership and security changes) renders through this single
 * template so the branded layout, escaping, mobile responsiveness and copy stay
 * consistent with the in-app notification instead of being duplicated across
 * controllers. Only neutral, non-sensitive fields are ever rendered here — no
 * passwords, tokens, private keys, administrator identities or internal review
 * notes are passed in.
 */
export interface AccountEventEmailDetail {
  label: string;
  value: string;
}

export type AccountEventTone = "positive" | "negative" | "gold";

const TONE_MAP: Record<AccountEventTone, EmailTone> = {
  positive: "positive",
  negative: "negative",
  gold: "info"
};

export function renderAccountEventEmail(args: {
  name: string;
  subject: string;
  heading: string;
  preheader: string;
  /** The exact message shown as the in-app notification, kept in sync. */
  message: string;
  details?: AccountEventEmailDetail[];
  statusLabel?: string;
  statusTone?: AccountEventTone;
  ctaLabel?: string;
  /** Relative app path (e.g. "/deposit"); resolved against the app base URL. */
  ctaPath?: string;
}): { subject: string; html: string } {
  const baseUrl = getAppBaseUrl();
  const tone = TONE_MAP[args.statusTone ?? "gold"];

  const details = (args.details ?? []).filter((detail) => String(detail.label).trim().length > 0);

  const contentHtml = `${renderBrandHeader({ label: "Account Activity" })}
${renderHero({ heading: args.heading, support: args.message })}
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">Hi <strong style="color:#F5F5F7;">${escapeHtml(
    args.name
  )}</strong>, here is a summary of the recent activity on your NexaCrypto account.</p>
${renderDetailCard({
  title: "Transaction summary",
  rows: details.map((detail) => ({ label: detail.label, value: detail.value })),
  statusLabel: args.statusLabel,
  statusTone: tone
})}
${
  args.ctaLabel && args.ctaPath
    ? renderEmailButton({ href: `${baseUrl}${args.ctaPath}`, label: args.ctaLabel.toUpperCase() })
    : ""
}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0 0;">
  <tr>
    <td style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:19px;color:#6B7280;">
      For your security, this message never contains your password, private keys or authentication tokens.
    </td>
  </tr>
</table>
${renderBrandFooter({ websiteUrl: baseUrl })}`;

  const html = renderBrandEmailShell({ title: args.subject, preheader: args.preheader, contentHtml });

  return { subject: args.subject, html };
}
