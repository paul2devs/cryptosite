"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderAccountEventEmail = renderAccountEventEmail;
const emailClient_1 = require("../emailClient");
const brand_1 = require("./brand");
const TONE_MAP = {
    positive: "positive",
    negative: "negative",
    gold: "info"
};
function renderAccountEventEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const tone = TONE_MAP[args.statusTone ?? "gold"];
    const details = (args.details ?? []).filter((detail) => String(detail.label).trim().length > 0);
    const contentHtml = `${(0, brand_1.renderBrandHeader)({ label: "Account Activity" })}
${(0, brand_1.renderHero)({ heading: args.heading, support: args.message })}
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">Hi <strong style="color:#F5F5F7;">${(0, brand_1.escapeHtml)(args.name)}</strong>, here is a summary of the recent activity on your NexaCrypto account.</p>
${(0, brand_1.renderDetailCard)({
        title: "Transaction summary",
        rows: details.map((detail) => ({ label: detail.label, value: detail.value })),
        statusLabel: args.statusLabel,
        statusTone: tone
    })}
${args.ctaLabel && args.ctaPath
        ? (0, brand_1.renderEmailButton)({ href: `${baseUrl}${args.ctaPath}`, label: args.ctaLabel.toUpperCase() })
        : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0 0;">
  <tr>
    <td style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:19px;color:#6B7280;">
      For your security, this message never contains your password, private keys or authentication tokens.
    </td>
  </tr>
</table>
${(0, brand_1.renderBrandFooter)({ websiteUrl: baseUrl })}`;
    const html = (0, brand_1.renderBrandEmailShell)({ title: args.subject, preheader: args.preheader, contentHtml });
    return { subject: args.subject, html };
}
