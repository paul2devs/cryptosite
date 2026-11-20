import { getAppBaseUrl } from "../emailClient";
import { renderEmailLayout } from "./layout";

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

const TONE_COLOR: Record<AccountEventTone, string> = {
  positive: "#16C784",
  negative: "#EA3943",
  gold: "#C6A15B"
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
  const tone = args.statusTone ?? "gold";

  const detailRows = (args.details ?? [])
    .filter((detail) => String(detail.label).trim().length > 0)
    .map(
      (detail) => `
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">${escapeInline(
          detail.label
        )}</p>
        <p style="margin:2px 0 10px 0;color:#F5F5F7;font-size:14px;line-height:20px;word-break:break-word;"><strong>${escapeInline(
          detail.value
        )}</strong></p>`
    )
    .join("");

  const statusBlock = args.statusLabel
    ? `
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Status</p>
        <p style="margin:2px 0 0 0;color:${TONE_COLOR[tone]};font-size:14px;line-height:20px;font-weight:800;">${escapeInline(
          args.statusLabel
        )}</p>`
    : "";

  const summaryBlock =
    detailRows || statusBlock
      ? `<div style="margin:14px 0;padding:14px;border-radius:16px;background:#17181A;border:1px solid rgba(38,39,43,0.9);">
      ${detailRows}
      ${statusBlock}
    </div>`
      : "";

  const html = renderEmailLayout({
    title: args.heading,
    preheader: args.preheader,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <p style="margin:0 0 12px 0;color:#F5F5F7;font-size:14px;line-height:21px;">${escapeInline(
        args.message
      )}</p>
      ${summaryBlock}
      <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">For your security, this message never contains your password, private keys or authentication tokens.</p>
    `,
    ctaLabel: args.ctaLabel,
    ctaHref: args.ctaLabel && args.ctaPath ? `${baseUrl}${args.ctaPath}` : undefined
  });

  return { subject: args.subject, html };
}

function escapeInline(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
