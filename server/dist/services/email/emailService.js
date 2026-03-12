"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendPasswordChangedEmail = sendPasswordChangedEmail;
exports.sendDepositStatusEmail = sendDepositStatusEmail;
exports.sendWithdrawalStatusEmail = sendWithdrawalStatusEmail;
exports.sendReferralRewardEmail = sendReferralRewardEmail;
exports.sendLevelUpEmail = sendLevelUpEmail;
const emailClient_1 = require("./emailClient");
const account_1 = require("./templates/account");
const activity_1 = require("./templates/activity");
const emailClient_2 = require("./emailClient");
function safeFireAndForget(promise) {
    promise.catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[email] send failed", String(err));
    });
}
function sendWelcomeEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, account_1.renderWelcomeEmail)({ name: args.name });
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendPasswordResetEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const baseUrl = (0, emailClient_2.getAppBaseUrl)();
    const resetUrl = `${baseUrl}/reset-password/${encodeURIComponent(args.token)}`;
    const { subject, html } = (0, account_1.renderPasswordResetRequestEmail)({
        name: args.name,
        resetUrl,
        expiresMinutes: args.expiresMinutes
    });
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendPasswordChangedEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, account_1.renderPasswordChangedEmail)({ name: args.name });
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendDepositStatusEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, activity_1.renderDepositStatusEmail)(args);
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendWithdrawalStatusEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, activity_1.renderWithdrawalStatusEmail)(args);
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendReferralRewardEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, activity_1.renderReferralRewardEmail)(args);
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
function sendLevelUpEmail(args) {
    if (!(0, emailClient_2.isEmailEnabled)())
        return;
    const { subject, html } = (0, activity_1.renderLevelUpEmail)(args);
    safeFireAndForget((0, emailClient_1.sendEmail)({ to: args.to, subject, html }));
}
