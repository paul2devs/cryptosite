"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWithdrawal = createWithdrawal;
exports.getUserWithdrawals = getUserWithdrawals;
exports.getAllWithdrawals = getAllWithdrawals;
exports.getWithdrawalSummary = getWithdrawalSummary;
exports.updateWithdrawalStatus = updateWithdrawalStatus;
const express_validator_1 = require("express-validator");
const Withdrawal_1 = require("../models/Withdrawal");
const User_1 = require("../models/User");
const Notification_1 = require("../models/Notification");
const behaviorService_1 = require("../services/behaviorService");
const activityService_1 = require("../services/activityService");
const financialOperationsService_1 = require("../services/financialOperationsService");
const notificationDispatchService_1 = require("../services/notificationDispatchService");
const transactionRules_1 = require("../domain/transactionRules");
const withdrawalService_1 = require("../services/withdrawalService");
async function createWithdrawal(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { amount, asset, address, network, idempotencyKey } = req.body;
    try {
        const result = await (0, withdrawalService_1.reserveWithdrawal)(req.user.userId, {
            asset,
            address,
            network,
            amount,
            idempotencyKey
        });
        const withdrawal = result.withdrawal;
        if (!result.duplicate) {
            const user = await User_1.User.findByPk(req.user.userId);
            if (user) {
                const asset = withdrawal.asset || "USD";
                const reference = (0, transactionRules_1.generateReference)("withdrawal", withdrawal.withdrawal_id);
                const message = "Withdrawal request submitted. Your request is currently under review.";
                await Notification_1.Notification.create({
                    type: "withdrawal_created",
                    message,
                    user_id: req.user.userId
                });
                await (0, notificationDispatchService_1.dispatchNotificationEmail)({
                    user,
                    type: "withdrawal_created",
                    message,
                    email: {
                        sourceId: withdrawal.withdrawal_id,
                        subject: `Withdrawal submitted: ${Number(withdrawal.amount)} ${asset}`,
                        heading: "Withdrawal request received",
                        preheader: "Your withdrawal request has been submitted and is now under review.",
                        details: [
                            { label: "Reference", value: reference },
                            { label: "Amount", value: `${Number(withdrawal.amount)} ${asset}` },
                            { label: "Asset", value: asset },
                            { label: "Date", value: new Date().toISOString() }
                        ],
                        statusLabel: "Under review",
                        statusTone: "gold",
                        ctaLabel: "View withdrawals",
                        ctaPath: "/transactions"
                    }
                });
                await (0, behaviorService_1.recordWithdrawalAttempt)(user, Number(withdrawal.amount), true);
            }
            await (0, activityService_1.trackUserActivity)(req.user.userId, "withdrawal", {
                amount: Number(withdrawal.amount),
                withdrawal_id: withdrawal.withdrawal_id
            });
        }
        res.status(result.duplicate ? 200 : 201).json(withdrawal);
    }
    catch (error) {
        if (error instanceof withdrawalService_1.WithdrawalError) {
            if (error.status === 400 || error.status === 403 || error.status === 429) {
                const user = await User_1.User.findByPk(req.user.userId);
                if (user) {
                    await (0, behaviorService_1.recordWithdrawalAttempt)(user, Number(amount), false).catch(() => undefined);
                }
            }
            res.status(error.status).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: "Failed to create withdrawal" });
    }
}
async function getUserWithdrawals(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const withdrawals = await Withdrawal_1.Withdrawal.findAll({
            where: { user_id: req.user.userId },
            order: [["timestamp", "DESC"]]
        });
        res.status(200).json(withdrawals);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
}
async function getAllWithdrawals(req, res) {
    try {
        const withdrawals = await Withdrawal_1.Withdrawal.findAll({
            include: [{ model: User_1.User }],
            order: [["timestamp", "DESC"]]
        });
        res.status(200).json(withdrawals);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
}
async function getWithdrawalSummary(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const summary = await (0, withdrawalService_1.getUserWithdrawalSummary)(req.user.userId);
        res.status(200).json(summary);
    }
    catch (error) {
        if (error instanceof withdrawalService_1.WithdrawalError) {
            res.status(error.status).json({ message: error.message });
            return;
        }
        res.status(500).json({ message: "Failed to load withdrawal summary" });
    }
}
const LEGACY_STATUS_MAP = {
    Pending: "requested",
    Approved: "approved",
    Rejected: "rejected"
};
async function updateWithdrawalStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const detailed = LEGACY_STATUS_MAP[status];
    if (!detailed) {
        res.status(400).json({ message: "Unsupported withdrawal status" });
        return;
    }
    try {
        const withdrawal = await (0, financialOperationsService_1.reviewWithdrawal)(req.user.userId, id, detailed, "Status updated during platform review.");
        res.status(200).json(withdrawal);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update withdrawal";
        const notFound = message === "Withdrawal not found";
        res.status(notFound ? 404 : 400).json({ message });
    }
}
