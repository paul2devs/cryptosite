/**
 * NexaCrypto branded email design system.
 *
 * Email HTML is not website HTML: these primitives deliberately use
 * table-based layout, inline CSS and no JavaScript so the design renders
 * predictably in Gmail, Outlook, Apple Mail and mobile clients. Media queries
 * are used only as progressive enhancement, and the layout keeps its shape even
 * when images are blocked (the design uses no images at all).
 *
 * Every dynamic value must be passed through `escapeHtml` / `escapeAttr` so a
 * value can never inject markup into a message.
 */

export const BRAND = {
  canvas: "#0B0C0E",
  container: "#111315",
  surface: "#17191C",
  text: "#F5F5F7",
  textMuted: "#92969D",
  gold: "#C6A15B",
  border: "rgba(255,255,255,0.09)"
} as const;

const HEADING_FONT = "'Space Grotesk','Segoe UI',Helvetica,Arial,sans-serif";
const BODY_FONT =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeAttr(input: string): string {
  return escapeHtml(input).replace(/`/g, "&#96;");
}

/** Brand wordmark: a gold monogram tile plus the NexaCrypto wordmark. */
export function renderBrandHeader(args: { label: string }): string {
  const label = escapeHtml(args.label.toUpperCase());
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:28px 0 34px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="34" style="width:34px;">
              <tr>
                <td align="center" valign="middle" width="34" height="34" style="width:34px;height:34px;background:${BRAND.surface};border:1px solid rgba(198,161,91,0.5);border-radius:10px;font-family:${HEADING_FONT};font-size:13px;font-weight:700;letter-spacing:0.06em;color:${BRAND.gold};">
                  NX
                </td>
              </tr>
            </table>
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <div style="font-family:${HEADING_FONT};font-size:17px;font-weight:700;letter-spacing:0.01em;color:${BRAND.text};line-height:22px;">NexaCrypto</div>
            <div style="font-family:${BODY_FONT};font-size:10px;font-weight:600;letter-spacing:0.22em;color:${BRAND.gold};line-height:16px;">${label}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Research hero: the emblem is drawn entirely with HTML/CSS so it renders even
 * with images disabled and never depends on a hosted asset.
 */
export function renderVerificationEmblem(): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" style="margin:0 0 22px 0;">
  <tr>
    <td align="center" valign="middle" width="72" height="72" style="width:72px;height:72px;border:1px solid rgba(198,161,91,0.45);border-radius:50%;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="52" style="width:52px;">
        <tr>
          <td align="center" valign="middle" width="52" height="52" style="width:52px;height:52px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:50%;font-family:${HEADING_FONT};font-size:16px;font-weight:700;letter-spacing:0.12em;color:${BRAND.gold};">
            NX
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="padding-top:12px;font-family:${BODY_FONT};font-size:10px;font-weight:600;letter-spacing:0.2em;color:${BRAND.textMuted};white-space:nowrap;">
      SECURE LINK
    </td>
  </tr>
</table>`;
}

export function renderHero(args: { heading: string; support: string; visualHtml?: string }): string {
  const visual = args.visualHtml
    ? `<div style="margin:0 0 20px 0;">${args.visualHtml}</div>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:0 0 4px 0;">
      ${visual}
      <h1 class="hero-heading" style="margin:0 0 12px 0;font-family:${HEADING_FONT};font-size:30px;line-height:38px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.text};">
        ${escapeHtml(args.heading)}
      </h1>
      <p style="margin:0;font-family:${BODY_FONT};font-size:15px;line-height:24px;color:${BRAND.textMuted};">
        ${escapeHtml(args.support)}
      </p>
    </td>
  </tr>
</table>`;
}

/** Email-safe gold call-to-action button (table based, no images, no JS). */
export function renderEmailButton(args: { href: string; label: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0 0;">
  <tr>
    <td align="center" bgcolor="${BRAND.gold}" style="background:${BRAND.gold};border-radius:10px;">
      <a class="btn" href="${escapeAttr(args.href)}" style="display:inline-block;padding:15px 30px;font-family:${HEADING_FONT};font-size:14px;font-weight:700;letter-spacing:0.08em;color:${BRAND.canvas};text-decoration:none;border-radius:10px;">${escapeHtml(
        args.label
      )}</a>
    </td>
  </tr>
</table>`;
}

export function renderFallbackLink(args: { intro: string; url: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0 0;">
  <tr>
    <td style="padding:0 0 10px 0;font-family:${BODY_FONT};font-size:13px;line-height:20px;color:${BRAND.textMuted};">
      ${escapeHtml(args.intro)}
    </td>
  </tr>
  <tr>
    <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:10px;padding:14px 16px;font-family:${BODY_FONT};font-size:12px;line-height:20px;color:${BRAND.text};word-break:break-all;-ms-word-break:break-all;">
      <a href="${escapeAttr(args.url)}" style="color:${BRAND.gold};text-decoration:none;word-break:break-all;">${escapeHtml(
        args.url
      )}</a>
    </td>
  </tr>
</table>`;
}

export function renderInfoBlock(args: { title: string; body: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:22px 0 0 0;border-top:1px solid ${BRAND.border};">
      <div style="font-family:${BODY_FONT};font-size:10px;font-weight:700;letter-spacing:0.2em;color:${BRAND.gold};padding:0 0 8px 0;">
        ${escapeHtml(args.title.toUpperCase())}
      </div>
      <p style="margin:0;font-family:${BODY_FONT};font-size:13px;line-height:21px;color:${BRAND.textMuted};">
        ${escapeHtml(args.body)}
      </p>
    </td>
  </tr>
</table>`;
}

export function renderBrandFooter(args: { websiteUrl: string }): string {
  const year = new Date().getFullYear();
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0 0;">
  <tr>
    <td align="center" style="padding:24px 0 0 0;border-top:1px solid ${BRAND.border};">
      <div style="font-family:${HEADING_FONT};font-size:14px;font-weight:700;letter-spacing:0.01em;color:${BRAND.text};padding:0 0 6px 0;">
        NexaCrypto
      </div>
      <div style="font-family:${BODY_FONT};font-size:12px;line-height:19px;color:${BRAND.textMuted};padding:0 0 14px 0;">
        Your investments. Your direction.
      </div>
      <div style="font-family:${BODY_FONT};font-size:12px;line-height:19px;">
        <a href="${escapeAttr(args.websiteUrl)}" style="color:${BRAND.gold};text-decoration:none;">nexacrypto.com</a>
      </div>
      <div style="font-family:${BODY_FONT};font-size:11px;line-height:18px;color:#6B7280;padding:16px 0 0 0;">
        &copy; ${year} NexaCrypto. All rights reserved.
      </div>
    </td>
  </tr>
</table>`;
}

/**
 * Shared outer canvas: full-width dark background, centred 600px container with
 * a restrained gold rule at the top. Reused by every transactional email.
 */
export function renderBrandEmailShell(args: {
  title: string;
  preheader: string;
  contentHtml: string;
}): string {
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
  <body style="margin:0;padding:0;background:${BRAND.canvas};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};">
      <tr>
        <td align="center" style="padding:32px 12px 40px 12px;">
          <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
            <tr>
              <td style="background:${BRAND.container};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding:0 0 0 32px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="72" height="2" style="width:72px;height:2px;background:${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="px" style="padding:0 32px 36px 32px;">
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
