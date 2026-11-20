"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderReferralRewardEmail = renderReferralRewardEmail;
const emailClient_1 = require("../emailClient");
const brand_1 = require("./brand");
function renderReferralRewardEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = `Referral reward unlocked: +${Math.round(args.bonusPercent)}% multiplier`;
    const preheader = `You unlocked a referral multiplier boost for ${args.durationHours} hours.`;
    const multiplier = `+${Math.round(args.bonusPercent)}%`;
    const contentHtml = `${(0, brand_1.renderBrandHeader)({ label: "Rewards" })}
${(0, brand_1.renderHero)({
        eyebrow: "Referral reward",
        heading: "Your referral paid off",
        support: "Someone you invited just triggered a reward. Your multiplier boost is active right now."
    })}
<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi <strong>${(0, brand_1.escapeHtml)(args.name)}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">A referral you invited just triggered a reward. Your multiplier boost is now active on your account.</p>
${(0, brand_1.renderDetailCard)({
        title: "Your boost",
        rows: [
            { label: "Multiplier boost", value: multiplier, emphasize: true },
            { label: "Active for", value: `${args.durationHours} hours` }
        ],
        statusLabel: "Active now",
        statusTone: "positive"
    })}
${(0, brand_1.renderEmailButton)({ href: `${baseUrl}/referrals`, label: "OPEN REFERRALS" })}
${(0, brand_1.renderNotice)({
        title: "Keep it going",
        tone: "info",
        body: "Invite more members to stack multipliers and compound your rewards faster."
    })}
${(0, brand_1.renderBrandFooter)({ websiteUrl: baseUrl })}`;
    const html = (0, brand_1.renderBrandEmailShell)({ title: subject, preheader, contentHtml });
    return { subject, html };
}
