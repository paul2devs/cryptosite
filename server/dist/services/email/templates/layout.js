"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderEmailLayout = renderEmailLayout;
const emailClient_1 = require("../emailClient");
function renderEmailLayout(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const logo = `${baseUrl}/logo-email.svg`;
    const safeTitle = escapeHtml(args.title);
    const safePreheader = escapeHtml(args.preheader);
    const footer = args.footerNote
        ? `<p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">${escapeHtml(args.footerNote)}</p>`
        : `<p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">You’re receiving this email because security-relevant or reward-related activity occurred on your Crypto Levels account.</p>`;
    const cta = args.ctaLabel && args.ctaHref
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
  <tr>
    <td style="border-radius:999px;background:#C6A15B;">
      <a href="${escapeAttr(args.ctaHref)}" style="display:inline-block;padding:12px 18px;font-size:13px;font-weight:700;color:#0F0F10;text-decoration:none;border-radius:999px;">${escapeHtml(args.ctaLabel)}</a>
    </td>
  </tr>
</table>`
        : "";
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeTitle}</title>
    <style>
      @media (prefers-color-scheme: dark) { body { background: #050509 !important; } }
      @media (max-width: 600px) { .container { width: 100% !important; } .px { padding-left: 18px !important; padding-right: 18px !important; } }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#050509;color:#F5F5F7;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050509;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;">
            <tr>
              <td class="px" style="padding:0 8px 14px 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align:middle;">
                            <div style="height:34px;width:34px;border-radius:999px;background:#17181A;border:1px solid rgba(38,39,43,0.9);display:inline-flex;align-items:center;justify-content:center;">
                              <span style="color:#C6A15B;font-weight:800;font-size:12px;letter-spacing:0.18em;">CL</span>
                            </div>
                          </td>
                          <td style="padding-left:10px;vertical-align:middle;">
                            <div style="color:#F5F5F7;font-size:13px;font-weight:700;letter-spacing:0.16em;">CRYPTO LEVELS</div>
                            <div style="color:#9CA3AF;font-size:11px;">Custodial levels &amp; multiplier rewards</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <a href="${escapeAttr(baseUrl)}" style="color:#9CA3AF;font-size:12px;text-decoration:none;">Dashboard</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#0F0F10;border-radius:24px;border:1px solid rgba(38,39,43,0.9);box-shadow:0 25px 80px rgba(0,0,0,0.55);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td class="px" style="padding:22px 22px 10px 22px;">
                      <div style="color:#F5F5F7;font-size:18px;font-weight:800;line-height:26px;">${safeTitle}</div>
                    </td>
                  </tr>
                  <tr>
                    <td class="px" style="padding:0 22px 18px 22px;">
                      <div style="color:#9CA3AF;font-size:13px;line-height:20px;">${args.bodyHtml}</div>
                      ${cta}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:16px 22px;border-top:1px solid rgba(38,39,43,0.9);">
                      ${footer}
                      <p style="margin:10px 0 0 0;color:#6B7280;font-size:11px;line-height:16px;">
                        If you didn’t initiate this activity, reset your password immediately and contact support.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 10px 0 10px;text-align:center;color:#6B7280;font-size:11px;line-height:16px;">
                © ${new Date().getFullYear()} Crypto Levels. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
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
