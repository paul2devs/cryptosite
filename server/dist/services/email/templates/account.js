"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderWelcomeEmail = renderWelcomeEmail;
exports.renderPasswordResetRequestEmail = renderPasswordResetRequestEmail;
exports.renderPasswordChangedEmail = renderPasswordChangedEmail;
const emailClient_1 = require("../emailClient");
const brand_1 = require("./brand");
function renderWelcomeEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = "Welcome to NexaCrypto: your account is ready";
    const preheader = "Your account is ready. Start with a verified deposit to unlock levels and multipliers.";
    const contentHtml = `${(0, brand_1.renderBrandHeader)({ label: "Welcome" })}
${(0, brand_1.renderHero)({
        eyebrow: "Account activated",
        heading: "Welcome to NexaCrypto",
        support: "Your account is live. Here is the fastest path from sign-up to your first compounded reward."
    })}
<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi <strong>${(0, brand_1.escapeHtml)(args.name)}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">Thanks for joining NexaCrypto. Once you submit an on-chain deposit and it is approved, you will start earning XP, unlocking levels, and compounding rewards through multipliers and streaks.</p>
${(0, brand_1.renderDetailCard)({
        title: "Your next steps",
        rows: [
            { label: "1. Verify your email", value: "Secure your account in one click" },
            { label: "2. Make your first deposit", value: "Verified on-chain deposits unlock your tiers" },
            { label: "3. Unlock levels", value: "Compound rewards as your balance grows" }
        ]
    })}
${(0, brand_1.renderEmailButton)({ href: `${baseUrl}/`, label: "OPEN DASHBOARD" })}
${(0, brand_1.renderNotice)({
        title: "Security note",
        tone: "info",
        body: "We will never ask you for your password. Password reset links are one-time and expire quickly."
    })}
${(0, brand_1.renderBrandFooter)({ websiteUrl: baseUrl })}`;
    const html = (0, brand_1.renderBrandEmailShell)({ title: subject, preheader, contentHtml });
    return { subject, html };
}
function renderPasswordResetRequestEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = "Reset your NexaCrypto password";
    const preheader = "Use this secure link to reset your password. It expires soon.";
    const contentHtml = `${(0, brand_1.renderBrandHeader)({ label: "Account Security" })}
${(0, brand_1.renderHero)({
        eyebrow: "Password reset",
        heading: "Reset your password",
        support: "Use the secure link below to choose a new password for your NexaCrypto account."
    })}
<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi <strong>${(0, brand_1.escapeHtml)(args.name)}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">We received a request to reset your password. Choose a new one using the secure link below.</p>
${(0, brand_1.renderEmailButton)({ href: args.resetUrl, label: "RESET PASSWORD" })}
${(0, brand_1.renderFallbackLink)({
        intro: "Button not working? Copy and paste this secure link into your browser.",
        url: args.resetUrl
    })}
${(0, brand_1.renderDetailCard)({
        title: "Link details",
        rows: [
            { label: "Expires in", value: `${args.expiresMinutes} minutes`, emphasize: true },
            { label: "Single use", value: "This link can only be used once" }
        ]
    })}
${(0, brand_1.renderNotice)({
        title: "Didn't request this?",
        tone: "neutral",
        body: "If you didn't request a password reset, you can safely ignore this email. Your password will not change."
    })}
${(0, brand_1.renderBrandFooter)({ websiteUrl: baseUrl })}`;
    const html = (0, brand_1.renderBrandEmailShell)({ title: subject, preheader, contentHtml });
    return { subject, html };
}
function renderPasswordChangedEmail(args) {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    const subject = "Your NexaCrypto password was changed";
    const preheader = "Your password was changed successfully.";
    const contentHtml = `${(0, brand_1.renderBrandHeader)({ label: "Account Security" })}
${(0, brand_1.renderHero)({
        eyebrow: "Password updated",
        heading: "Your password was changed",
        support: "This is a confirmation that the password on your NexaCrypto account was updated."
    })}
<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi <strong>${(0, brand_1.escapeHtml)(args.name)}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">Your password was updated successfully. You can sign in with your new password at any time.</p>
${(0, brand_1.renderNotice)({
        title: "Not you?",
        tone: "warning",
        body: "If you did not make this change, reset your password immediately and contact support right away."
    })}
${(0, brand_1.renderEmailButton)({ href: `${baseUrl}/login`, label: "SIGN IN", variant: "secondary" })}
${(0, brand_1.renderBrandFooter)({ websiteUrl: baseUrl })}`;
    const html = (0, brand_1.renderBrandEmailShell)({ title: subject, preheader, contentHtml });
    return { subject, html };
}
