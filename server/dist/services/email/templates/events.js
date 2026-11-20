"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderAccountEventEmail = renderAccountEventEmail;
const emailClient_1 = require("../emailClient");
const layout_1 = require("./layout");
const TONE_COLOR = {
    positive: "#16C784",
    negative: "#EA3943",
    gold: "#C6A15B"
};
function renderAccountEventEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const tone = args.statusTone ?? "gold";
    const detailRows = (args.details ?? [])
        .filter((detail) => String(detail.label).trim().length > 0)
        .map((detail) => `
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">${escapeInline(detail.label)}</p>
        <p style="margin:2px 0 10px 0;color:#F5F5F7;font-size:14px;line-height:20px;word-break:break-word;"><strong>${escapeInline(detail.value)}</strong></p>`)
        .join("");
    const statusBlock = args.statusLabel
        ? `
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Status</p>
        <p style="margin:2px 0 0 0;color:${TONE_COLOR[tone]};font-size:14px;line-height:20px;font-weight:800;">${escapeInline(args.statusLabel)}</p>`
        : "";
    const summaryBlock = detailRows || statusBlock
        ? `<div style="margin:14px 0;padding:14px;border-radius:16px;background:#17181A;border:1px solid rgba(38,39,43,0.9);">
      ${detailRows}
      ${statusBlock}
    </div>`
        : "";
    const html = (0, layout_1.renderEmailLayout)({
        title: args.heading,
        preheader: args.preheader,
        bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <p style="margin:0 0 12px 0;color:#F5F5F7;font-size:14px;line-height:21px;">${escapeInline(args.message)}</p>
      ${summaryBlock}
      <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">For your security, this message never contains your password, private keys or authentication tokens.</p>
    `,
        ctaLabel: args.ctaLabel,
        ctaHref: args.ctaLabel && args.ctaPath ? `${baseUrl}${args.ctaPath}` : undefined
    });
    return { subject: args.subject, html };
}
function escapeInline(input) {
    return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
