"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDepositStatusEmail = renderDepositStatusEmail;
exports.renderWithdrawalStatusEmail = renderWithdrawalStatusEmail;
exports.renderReferralRewardEmail = renderReferralRewardEmail;
exports.renderLevelUpEmail = renderLevelUpEmail;
const emailClient_1 = require("../emailClient");
const layout_1 = require("./layout");
function renderDepositStatusEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = `Deposit ${args.status} — ${args.asset} ${formatAmount(args.amount)}`;
    const accent = args.status === "Approved" ? "#16C784" : args.status === "Rejected" ? "#EA3943" : "#C6A15B";
    const html = (0, layout_1.renderEmailLayout)({
        title: `Deposit ${args.status}`,
        preheader: `Your ${args.asset} deposit was ${args.status.toLowerCase()}.`,
        bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <div style="margin:14px 0;padding:14px;border-radius:16px;background:#17181A;border:1px solid rgba(38,39,43,0.9);">
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Asset</p>
        <p style="margin:2px 0 10px 0;color:#F5F5F7;font-size:14px;line-height:20px;"><strong>${escapeInline(args.asset)}</strong></p>
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Amount</p>
        <p style="margin:2px 0 10px 0;color:#F5F5F7;font-size:14px;line-height:20px;"><strong>${formatAmount(args.amount)}</strong></p>
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Status</p>
        <p style="margin:2px 0 0 0;color:${accent};font-size:14px;line-height:20px;font-weight:800;">${escapeInline(args.status)}</p>
      </div>
      <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Approved deposits increase your progression and can unlock higher multiplier tiers.</p>
    `,
        ctaLabel: "View deposits",
        ctaHref: `${baseUrl}/deposit`
    });
    return { subject, html };
}
function renderWithdrawalStatusEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = `Withdrawal ${args.status} — ${formatAmount(args.amount)}`;
    const accent = args.status === "Approved" ? "#16C784" : args.status === "Rejected" ? "#EA3943" : "#C6A15B";
    const html = (0, layout_1.renderEmailLayout)({
        title: `Withdrawal ${args.status}`,
        preheader: `Your withdrawal was ${args.status.toLowerCase()}.`,
        bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <div style="margin:14px 0;padding:14px;border-radius:16px;background:#17181A;border:1px solid rgba(38,39,43,0.9);">
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Amount</p>
        <p style="margin:2px 0 10px 0;color:#F5F5F7;font-size:14px;line-height:20px;"><strong>${formatAmount(args.amount)}</strong></p>
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Status</p>
        <p style="margin:2px 0 0 0;color:${accent};font-size:14px;line-height:20px;font-weight:800;">${escapeInline(args.status)}</p>
      </div>
      <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Withdrawals are subject to internal review and security checks.</p>
    `,
        ctaLabel: "View withdrawals",
        ctaHref: `${baseUrl}/withdraw`
    });
    return { subject, html };
}
function renderReferralRewardEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = `Referral reward unlocked — +${Math.round(args.bonusPercent)}% multiplier`;
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
function renderLevelUpEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = `Level up unlocked — Level ${args.newLevel}`;
    const html = (0, layout_1.renderEmailLayout)({
        title: `Level ${args.newLevel} unlocked`,
        preheader: "Your progression just increased. Multipliers and rewards have improved.",
        bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi <strong>${escapeInline(args.name)}</strong>,</p>
      <p style="margin:0 0 12px 0;">You’ve unlocked <strong>Level ${args.newLevel}</strong>. This upgrades your progression tier and improves how deposits translate into rewards.</p>
      ${typeof args.multiplierPreview === "number"
            ? `<div style="margin:14px 0;padding:14px;border-radius:16px;background:#17181A;border:1px solid rgba(38,39,43,0.9);">
        <p style="margin:0;color:#9CA3AF;font-size:12px;line-height:18px;">Current multiplier preview</p>
        <p style="margin:2px 0 0 0;color:#16C784;font-size:18px;line-height:24px;font-weight:800;">x${args.multiplierPreview.toFixed(2)}</p>
      </div>`
            : ""}
    `,
        ctaLabel: "View dashboard",
        ctaHref: `${baseUrl}/`
    });
    return { subject, html };
}
function formatAmount(amount) {
    if (!Number.isFinite(amount))
        return "0";
    const fixed = amount >= 100 ? amount.toFixed(2) : amount >= 1 ? amount.toFixed(4) : amount.toFixed(8);
    return fixed.replace(/\.?0+$/, "");
}
function escapeInline(input) {
    return String(input)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
