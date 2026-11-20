"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TONE = exports.BRAND = void 0;
exports.escapeHtml = escapeHtml;
exports.escapeAttr = escapeAttr;
exports.emailLogoUrl = emailLogoUrl;
exports.renderBrandHeader = renderBrandHeader;
exports.renderEyebrow = renderEyebrow;
exports.renderHero = renderHero;
exports.renderEmailButton = renderEmailButton;
exports.renderFallbackLink = renderFallbackLink;
exports.renderDetailCard = renderDetailCard;
exports.renderNotice = renderNotice;
exports.renderInfoBlock = renderInfoBlock;
exports.renderDivider = renderDivider;
exports.renderBrandFooter = renderBrandFooter;
exports.renderBrandEmailShell = renderBrandEmailShell;
/**
 * NexaCrypto branded email design system.
 *
 * Email HTML is not website HTML: these primitives deliberately use
 * table-based layout, inline CSS and no JavaScript so the design renders
 * predictably in Gmail, Outlook, Apple Mail and mobile clients. Media queries
 * are used only as progressive enhancement, and solid hex colours are used
 * instead of rgba() so the layout keeps its shape in Outlook.
 *
 * Every dynamic value must be passed through `escapeHtml` / `escapeAttr` so a
 * value can never inject markup into a message.
 */
const emailClient_1 = require("../emailClient");
exports.BRAND = {
    canvas: "#0B0C0E",
    container: "#111315",
    surface: "#17191C",
    surfaceRaised: "#1C1E22",
    text: "#F5F5F7",
    textMuted: "#92969D",
    textFaint: "#6B7280",
    gold: "#C6A15B",
    goldSoft: "#E7C989",
    border: "#26272B",
    borderStrong: "#33353A"
};
/** Tone palette: accent (border/marker), tint (card background), text (value). */
exports.TONE = {
    info: { accent: exports.BRAND.gold, tint: "#1A1712", text: exports.BRAND.goldSoft },
    positive: { accent: "#16C784", tint: "#0F1A16", text: "#4FE0A6" },
    negative: { accent: "#EA3943", tint: "#1A1011", text: "#F08A84" },
    warning: { accent: "#F0B429", tint: "#1A160D", text: "#F6CE6B" },
    neutral: { accent: "#6B7280", tint: exports.BRAND.surface, text: "#C7CBD1" }
};
const HEADING_FONT = "'Space Grotesk','Segoe UI',Helvetica,Arial,sans-serif";
const BODY_FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
function escapeHtml(input) {
    return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function escapeAttr(input) {
    return escapeHtml(input).replace(/`/g, "&#96;");
}
/** The real NexaCrypto brand icon (lightweight PNG that renders in every client). */
function emailLogoUrl() {
    return `${(0, emailClient_1.getAppBaseUrl)()}/icon-192.png`;
}
/**
 * Brand header: the real NexaCrypto logo mark followed by the wordmark and a
 * context label (for example "Account Security"). No placeholder monogram tile.
 */
function renderBrandHeader(args) {
    const label = escapeHtml(args.label.toUpperCase());
    const logoUrl = escapeAttr(emailLogoUrl());
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:6px 0 30px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <img src="${logoUrl}" width="40" height="40" alt="NexaCrypto" style="display:block;width:40px;height:40px;border:0;outline:none;text-decoration:none;border-radius:11px;" />
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <div style="font-family:${HEADING_FONT};font-size:18px;font-weight:700;letter-spacing:0.01em;color:${exports.BRAND.text};line-height:22px;">NexaCrypto</div>
            <div style="font-family:${BODY_FONT};font-size:10px;font-weight:700;letter-spacing:0.22em;color:${exports.BRAND.gold};line-height:16px;">${label}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
/** Small gold kicker rendered above a heading. */
function renderEyebrow(text) {
    return `<div style="font-family:${BODY_FONT};font-size:10px;font-weight:700;letter-spacing:0.22em;color:${exports.BRAND.gold};padding:0 0 10px 0;">${escapeHtml(text.toUpperCase())}</div>`;
}
/** Hero heading with optional eyebrow and support copy. */
function renderHero(args) {
    const eyebrow = args.eyebrow ? renderEyebrow(args.eyebrow) : "";
    const visual = args.visualHtml ? `<div style="margin:0 0 20px 0;">${args.visualHtml}</div>` : "";
    const support = args.support
        ? `<p style="margin:12px 0 0 0;font-family:${BODY_FONT};font-size:15px;line-height:24px;color:${exports.BRAND.textMuted};">${escapeHtml(args.support)}</p>`
        : "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:0 0 4px 0;">
      ${visual}
      ${eyebrow}
      <h1 class="hero-heading" style="margin:0;font-family:${HEADING_FONT};font-size:29px;line-height:37px;font-weight:700;letter-spacing:-0.01em;color:${exports.BRAND.text};">
        ${escapeHtml(args.heading)}
      </h1>
      ${support}
    </td>
  </tr>
</table>`;
}
/** Email-safe call-to-action button (table based, no images, no JS). */
function renderEmailButton(args) {
    const secondary = args.variant === "secondary";
    const bg = secondary ? "transparent" : exports.BRAND.gold;
    const color = secondary ? exports.BRAND.text : exports.BRAND.canvas;
    const border = secondary ? `1px solid ${exports.BRAND.borderStrong}` : "none";
    const bgAttr = secondary ? "" : ` bgcolor="${exports.BRAND.gold}"`;
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0 0;">
  <tr>
    <td align="center"${bgAttr} style="background:${bg};border:${border};border-radius:10px;">
      <a class="btn" href="${escapeAttr(args.href)}" style="display:inline-block;padding:15px 30px;font-family:${HEADING_FONT};font-size:14px;font-weight:700;letter-spacing:0.08em;color:${color};text-decoration:none;border-radius:10px;">${escapeHtml(args.label)}</a>
    </td>
  </tr>
</table>`;
}
/** Plain-text fallback link block (used by the verification email). */
function renderFallbackLink(args) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0 0;">
  <tr>
    <td style="padding:0 0 10px 0;font-family:${BODY_FONT};font-size:13px;line-height:20px;color:${exports.BRAND.textMuted};">
      ${escapeHtml(args.intro)}
    </td>
  </tr>
  <tr>
    <td style="background:${exports.BRAND.surface};border:1px solid ${exports.BRAND.border};border-radius:10px;padding:14px 16px;font-family:${BODY_FONT};font-size:12px;line-height:20px;color:${exports.BRAND.text};word-break:break-all;-ms-word-break:break-all;">
      <a href="${escapeAttr(args.url)}" style="color:${exports.BRAND.gold};text-decoration:none;word-break:break-all;">${escapeHtml(args.url)}</a>
    </td>
  </tr>
</table>`;
}
/**
 * Structured "summary" card: label/value rows plus an optional coloured status.
 * Replaces the ad-hoc inline cards so every email shows transaction data the
 * same way.
 */
function renderDetailCard(args) {
    const rows = (args.rows ?? []).filter((row) => String(row.label).trim().length > 0);
    if (rows.length === 0 && !args.statusLabel)
        return "";
    const title = args.title
        ? `<tr><td style="padding:0 0 12px 0;font-family:${BODY_FONT};font-size:10px;font-weight:700;letter-spacing:0.2em;color:${exports.BRAND.gold};">${escapeHtml(args.title.toUpperCase())}</td></tr>`
        : "";
    const rowHtml = rows
        .map((row, index) => {
        const divider = index === 0 ? "" : `<tr><td style="border-top:1px solid ${exports.BRAND.border};font-size:0;line-height:0;">&nbsp;</td></tr>`;
        const valueStyle = row.emphasize
            ? `font-family:${HEADING_FONT};font-size:18px;line-height:26px;font-weight:700;color:${exports.BRAND.text};`
            : `font-family:${BODY_FONT};font-size:14px;line-height:21px;color:${exports.BRAND.text};`;
        return `${divider}
      <tr>
        <td style="padding:12px 0;">
          <div style="font-family:${BODY_FONT};font-size:11px;line-height:16px;letter-spacing:0.04em;color:${exports.BRAND.textFaint};">${escapeHtml(row.label)}</div>
          <div style="padding-top:3px;${valueStyle}word-break:break-word;">${escapeHtml(row.value)}</div>
        </td>
      </tr>`;
    })
        .join("");
    const status = args.statusLabel
        ? (() => {
            const tone = exports.TONE[args.statusTone ?? "info"];
            const firstRow = rows.length === 0;
            return `<tr><td style="padding:${firstRow ? "0" : "12px 0 0 0"};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="8" height="8" style="width:8px;height:8px;background:${tone.accent};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
              <td style="padding-left:8px;font-family:${BODY_FONT};font-size:13px;line-height:18px;font-weight:700;color:${tone.text};">${escapeHtml(args.statusLabel)}</td>
            </tr>
          </table>
        </td></tr>`;
        })()
        : "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;">
  <tr>
    <td style="background:${exports.BRAND.surface};border:1px solid ${exports.BRAND.border};border-radius:14px;padding:18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${title}
        ${rowHtml}
        ${status}
      </table>
    </td>
  </tr>
</table>`;
}
/**
 * Tone-aware callout with a coloured left accent and an optional title. Used
 * for security notes, expirations, and other supporting information.
 */
function renderNotice(args) {
    const tone = exports.TONE[args.tone ?? "info"];
    const title = args.title
        ? `<div style="font-family:${BODY_FONT};font-size:10px;font-weight:700;letter-spacing:0.2em;color:${tone.accent};padding:0 0 6px 0;">${escapeHtml(args.title.toUpperCase())}</div>`
        : "";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;">
  <tr>
    <td width="3" style="width:3px;background:${tone.accent};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="padding:0 0 0 14px;">
      ${title}
      <div style="font-family:${BODY_FONT};font-size:13px;line-height:21px;color:${exports.BRAND.textMuted};">${escapeHtml(args.body)}</div>
    </td>
  </tr>
</table>`;
}
/** Backwards-compatible alias for a titled notice. */
function renderInfoBlock(args) {
    return renderNotice({ title: args.title, body: args.body, tone: "info" });
}
/** A hairline divider with breathing room. */
function renderDivider() {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0 0;">
  <tr>
    <td style="border-top:1px solid ${exports.BRAND.border};font-size:0;line-height:0;">&nbsp;</td>
  </tr>
</table>`;
}
function renderBrandFooter(args) {
    const year = new Date().getFullYear();
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0 0;">
  <tr>
    <td align="center" style="padding:24px 0 0 0;border-top:1px solid ${exports.BRAND.border};">
      <div style="font-family:${HEADING_FONT};font-size:14px;font-weight:700;letter-spacing:0.01em;color:${exports.BRAND.text};padding:0 0 6px 0;">
        NexaCrypto
      </div>
      <div style="font-family:${BODY_FONT};font-size:12px;line-height:19px;color:${exports.BRAND.textMuted};padding:0 0 14px 0;">
        Your investments. Your direction.
      </div>
      <div style="font-family:${BODY_FONT};font-size:12px;line-height:19px;">
        <a href="${escapeAttr(args.websiteUrl)}" style="color:${exports.BRAND.gold};text-decoration:none;">nexocrypto.org</a>
      </div>
      <div style="font-family:${BODY_FONT};font-size:11px;line-height:18px;color:${exports.BRAND.textFaint};padding:16px 0 0 0;">
        &copy; ${year} NexaCrypto. All rights reserved.
      </div>
    </td>
  </tr>
</table>`;
}
/**
 * Shared outer canvas: full-width dark background, centred 600px container with
 * a gold accent rule at the top. Reused by every transactional email.
 */
function renderBrandEmailShell(args) {
    const title = escapeHtml(args.title);
    const preheader = escapeHtml(args.preheader);
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${title}</title>
    <!--[if mso]>
    <style type="text/css">
      body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
    </style>
    <![endif]-->
    <style type="text/css">
      body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
      table { border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
      a { text-decoration: none; }
      @media only screen and (max-width: 620px) {
        .container { width: 100% !important; }
        .px { padding-left: 20px !important; padding-right: 20px !important; }
        .hero-heading { font-size: 24px !important; line-height: 32px !important; }
        .btn { display: block !important; width: 100% !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${exports.BRAND.canvas};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${exports.BRAND.canvas};">
      <tr>
        <td align="center" style="padding:32px 12px 40px 12px;">
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
            <tr>
              <td style="background:${exports.BRAND.container};border:1px solid ${exports.BRAND.border};border-radius:16px;overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 0 0 32px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="72" height="3" style="width:72px;height:3px;background:${exports.BRAND.gold};font-size:0;line-height:0;">&nbsp;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="px" style="padding:0 32px 36px 32px;color:${exports.BRAND.textMuted};font-family:${BODY_FONT};font-size:14px;line-height:22px;">
                      ${args.contentHtml}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
            <tr>
              <td class="px" style="padding:0 32px;font-family:${BODY_FONT};font-size:11px;line-height:18px;color:#5B5F66;">
                This is an automated message from NexaCrypto. Replies to this address are not monitored.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
