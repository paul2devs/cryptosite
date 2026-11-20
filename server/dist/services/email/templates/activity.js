"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderReferralRewardEmail = renderReferralRewardEmail;
const emailClient_1 = require("../emailClient");
const layout_1 = require("./layout");
function renderReferralRewardEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = `Referral reward unlocked: +${Math.round(args.bonusPercent)}% multiplier`;
    const html = (0, layout_1.renderEmailLayout)({
        title: "Referral reward received",
        preheader: `You unlocked a referral multiplier boost for ${args.durationHours} hours.`,
        bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <p style="margin:0 0 12px 0;">A referral you invited just triggered a reward. Your multiplier boost is now active.</p>
      <div style="margin:14px 0;padding:14px;border-radius:16px;background:#17181A;border:1px solid rgba(38,39,43,0.9);">
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Boost</p>
        <p style="margin:2px 0 10px 0;color:#16C784;font-size:16px;line-height:22px;font-weight:800;">+${Math.round(args.bonusPercent)}% multiplier</p>
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Duration</p>
        <p style="margin:2px 0 0 0;color:#F5F5F7;font-size:13px;line-height:20px;"><strong>${args.durationHours} hours</strong></p>
      </div>
    `,
        ctaLabel: "Open referrals",
        ctaHref: `${baseUrl}/referrals`
    });
    return { subject, html };
}
function escapeInline(input) {
    return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
