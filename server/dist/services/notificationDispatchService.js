"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationEmailKey = notificationEmailKey;
exports.dispatchNotificationEmail = dispatchNotificationEmail;
const sequelize_1 = require("sequelize");
const NotificationDelivery_1 = require("../models/NotificationDelivery");
const emailClient_1 = require("./email/emailClient");
const emailService_1 = require("./email/emailService");
const EMAIL_CHANNEL = "email";
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function notificationEmailKey(type, sourceId) {
    return `${EMAIL_CHANNEL}:${type}:${sourceId}`;
}
async function finalize(delivery, status, lastError = null) {
    try {
        delivery.status = status;
        delivery.last_error = lastError;
        if (status === "sent")
            delivery.sent_at = new Date();
        delivery.updated_at = new Date();
        await delivery.save();
    }
    catch (error) {
        // Recording the outcome must never throw back into the financial path.
        // eslint-disable-next-line no-console
        console.warn("[notification-email] unable to record delivery status", String(error));
    }
}
/**
 * Delivers a single notification by email, exactly once.
 *
 * The in-app notification is always preserved by the caller; this only adds the
 * email channel. The delivery ledger owns the right to send: the first writer
 * of the unique idempotency key performs the send, every later attempt (retry
 * or concurrent job) is rejected while the delivery is `sent`, `skipped` or in
 * flight, and only a `failed` delivery may be retried. Every failure is caught
 * and logged — a missing/invalid address, a disabled provider or a transport
 * error never throws, and never rolls back or blocks a financial transaction.
 */
async function dispatchNotificationEmail(args) {
    const key = notificationEmailKey(args.type, args.email.sourceId);
    let delivery;
    try {
        delivery = await NotificationDelivery_1.NotificationDelivery.create({
            idempotency_key: key,
            channel: EMAIL_CHANNEL,
            user_id: args.user.user_id,
            notification_type: args.type,
            status: "sending",
            attempts: 1
        });
    }
    catch (error) {
        if (!(error instanceof sequelize_1.UniqueConstraintError)) {
            // eslint-disable-next-line no-console
            console.warn("[notification-email] could not claim delivery", JSON.stringify({ key, type: args.type, error: String(error) }));
            return;
        }
        const existing = await NotificationDelivery_1.NotificationDelivery.findOne({ where: { idempotency_key: key } });
        if (!existing)
            return;
        // Already delivered, intentionally skipped, or being sent right now by
        // another attempt: never send a second copy.
        if (existing.status === "sent" || existing.status === "skipped" || existing.status === "sending") {
            return;
        }
        // A previously failed delivery may be retried safely.
        existing.status = "sending";
        existing.attempts = existing.attempts + 1;
        existing.last_error = null;
        existing.updated_at = new Date();
        await existing.save();
        delivery = existing;
    }
    const recipient = String(args.user.email ?? "").trim();
    if (!recipient || !isValidEmail(recipient)) {
        await finalize(delivery, "skipped", "Recipient email address is missing or invalid");
        // eslint-disable-next-line no-console
        console.warn("[notification-email] skipped delivery: invalid recipient", JSON.stringify({ key, userId: args.user.user_id }));
        return;
    }
    if (!(0, emailClient_1.isEmailEnabled)()) {
        // The provider is not configured/enabled: preserve the in-app notification,
        // record the outcome honestly and do not retry or claim delivery.
        await finalize(delivery, "skipped", "Email delivery is disabled");
        return;
    }
    try {
        await (0, emailService_1.sendAccountEventEmail)({
            to: recipient,
            name: args.user.name || "there",
            subject: args.email.subject,
            heading: args.email.heading,
            preheader: args.email.preheader,
            message: args.message,
            details: args.email.details,
            statusLabel: args.email.statusLabel,
            statusTone: args.email.statusTone,
            ctaLabel: args.email.ctaLabel,
            ctaPath: args.email.ctaPath,
            idempotencyKey: key
        });
        await finalize(delivery, "sent");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await finalize(delivery, "failed", message);
        // eslint-disable-next-line no-console
        console.warn("[notification-email] delivery failed", JSON.stringify({
            key,
            type: args.type,
            userId: args.user.user_id,
            attempts: delivery.attempts,
            error: message
        }));
    }
}
