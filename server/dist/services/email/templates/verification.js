"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderVerificationEmail = renderVerificationEmail;
const emailClient_1 = require("../emailClient");
const brand_1 = require("./brand");
/**
 * The NexaCrypto verification email.
 *
 * The layout is composed from the shared branded email primitives so this
 * message inherits the same premium visual language as every other
 * transactional email. It intentionally contains no images: the hero emblem is
 * drawn with HTML/CSS so the message still reads as a designed product
 * experience when remote images are blocked.
 *
 * `verifyUrl` is the only sensitive value and is always passed through the
 * escaping helpers inside the template primitives, so it can never inject
 * markup into the message.
 */
function renderVerificationEmail(args) {
    const websiteUrl = (0, emailClient_1.getAppBaseUrl)();
    const expiresMinutes = Math.max(1, Math.floor(Number(args.expiresMinutes) || 30));
    const subject = "Verify your NexaCrypto email address";
    const preheader = `Confirm your email address to activate your NexaCrypto account. This link expires in ${expiresMinutes} minutes.`;
    const greeting = args.name && args.name.trim().length > 0 ? args.name.trim() : "";
    const greetingHtml = greeting
        ? `<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi ${(0, brand_1.escapeHtml)(greeting)},</p>`
        : "";
    const contentHtml = `${(0, brand_1.renderBrandHeader)({ label: "Account Security" })}
${(0, brand_1.renderHero)({
        heading: "One last step. Verify your email.",
        support: "Your NexaCrypto account is almost ready. Confirm your email address to securely continue.",
        visualHtml: (0, brand_1.renderVerificationEmblem)()
    })}
${greetingHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="padding:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">
      Thanks for creating your NexaCrypto account. Before you continue, please confirm that this email address belongs to you.
    </td>
  </tr>
</table>
${(0, brand_1.renderEmailButton)({ href: args.verifyUrl, label: "VERIFY EMAIL ADDRESS" })}
${(0, brand_1.renderFallbackLink)({
        intro: "Having trouble with the button? Copy and paste the secure link below into your browser.",
        url: args.verifyUrl
    })}
${(0, brand_1.renderInfoBlock)({
        title: "Link expiration",
        body: `This verification link expires in ${expiresMinutes} minutes. If it expires, you can request another verification email from the verification screen.`
    })}
${(0, brand_1.renderInfoBlock)({
        title: "Security notice",
        body: "If you didn't create a NexaCrypto account, you can safely ignore this email. No action is required."
    })}
${(0, brand_1.renderBrandFooter)({ websiteUrl })}`;
    const html = (0, brand_1.renderBrandEmailShell)({ title: subject, preheader, contentHtml });
    const text = [
        "NexaCrypto — Account security",
        "",
        "Confirm your email address",
        "",
        "Your NexaCrypto account is almost ready. Confirm your email address to securely continue.",
        "",
        greeting ? `Hi ${greeting},` : "",
        "Thanks for creating your NexaCrypto account. Before you continue, please confirm that this email address belongs to you.",
        "",
        "Verify your email address:",
        args.verifyUrl,
        "",
        `This verification link expires in ${expiresMinutes} minutes. If it expires, you can request another verification email from the verification screen.`,
        "",
        "If you didn't create a NexaCrypto account, you can safely ignore this email. No action is required.",
        "",
        `© ${new Date().getFullYear()} NexaCrypto. All rights reserved.`,
        "Your investments. Your direction.",
        websiteUrl
    ]
        .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
        .join("\n")
        .trim();
    return { subject, html, text };
}
