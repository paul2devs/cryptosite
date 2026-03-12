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
const depositLevelService_1 = require("../services/depositLevelService");
const emailService_1 = require("../services/email/emailService");
function getWithdrawalMinLevel() {
    const raw = process.env.WITHDRAWAL_MIN_LEVEL;
    const parsed = raw ? Number(raw) : 2;
    if (!Number.isFinite(parsed) || parsed < 1) {
        return 2;
    }
    return parsed;
}
function getWithdrawalCooldownHours() {
    const raw = process.env.WITHDRAWAL_COOLDOWN_HOURS;
    const parsed = raw ? Number(raw) : 24;
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 24;
    }
    return parsed;
}
function getMaxDailyWithdrawal() {
    const raw = process.env.WITHDRAWAL_MAX_DAILY_AMOUNT;
    const parsed = raw ? Number(raw) : 0;
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 0;
    }
    return parsed;
}
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
    const { amount } = req.body;
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const depositStats = await (0, depositLevelService_1.calculateDepositLevelForUser)(user.user_id);
        const minLevel = Math.max(getWithdrawalMinLevel(), 5);
        if (depositStats.level < minLevel) {
            res.status(403).json({
                message: "Withdrawals are locked until you reach Level 5 based on your total approved deposits."
            });
            return;
        }
        const cooldownHours = getWithdrawalCooldownHours();
        if (cooldownHours > 0 && user.last_withdrawal_at) {
            const now = new Date();
            const last = new Date(user.last_withdrawal_at);
            const hoursSince = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
            if (hoursSince < cooldownHours) {
                res.status(429).json({
                    message: "Withdrawal cooldown active. Please try again later."
                });
                return;
            }
        }
        if (amount > user.withdrawable_balance) {
            await (0, behaviorService_1.recordWithdrawalAttempt)(user, amount, false);
            res.status(400).json({
                message: "Requested amount exceeds your withdrawable balance"
            });
            return;
        }
        const maxDaily = getMaxDailyWithdrawal();
        if (maxDaily > 0 && amount > maxDaily) {
            await (0, behaviorService_1.recordWithdrawalAttempt)(user, amount, false);
            res.status(400).json({
                message: "Requested amount exceeds the daily withdrawal limit"
            });
            return;
        }
        const withdrawal = await Withdrawal_1.Withdrawal.create({
            user_id: req.user.userId,
            amount
        });
        user.withdrawable_balance -= amount;
        user.last_withdrawal_at = new Date();
        await user.save();
        await Notification_1.Notification.create({
            type: "withdrawal_created",
            message: "Withdrawal request submitted",
            user_id: req.user.userId
        });
        (0, emailService_1.sendWithdrawalStatusEmail)({
            to: user.email,
            name: user.name,
            status: "Pending",
            amount
        });
        await (0, behaviorService_1.recordWithdrawalAttempt)(user, amount, true);
        await (0, activityService_1.trackUserActivity)(user.user_id, "withdrawal", {
            amount,
            withdrawal_id: withdrawal.withdrawal_id
        });
        res.status(201).json(withdrawal);
    }
    catch (error) {
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
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const depositStats = await (0, depositLevelService_1.calculateDepositLevelForUser)(user.user_id);
        const minLevel = Math.max(getWithdrawalMinLevel(), 5);
        const cooldownHours = getWithdrawalCooldownHours();
        let cooldownRemainingSeconds = 0;
        if (cooldownHours > 0 && user.last_withdrawal_at) {
            const now = new Date();
            const last = new Date(user.last_withdrawal_at);
            const msSince = now.getTime() - last.getTime();
            const cooldownMs = cooldownHours * 60 * 60 * 1000;
            cooldownRemainingSeconds = Math.max(0, Math.floor((cooldownMs - msSince) / 1000));
        }
        res.status(200).json({
            withdrawable_balance: user.withdrawable_balance,
            locked_balance: user.locked_balance,
            pending_earnings_total: user.pending_earnings?.total !== undefined
                ? Number(user.pending_earnings.total)
                : 0,
            user_level: depositStats.level,
            min_level: minLevel,
            cooldown_seconds_remaining: cooldownRemainingSeconds
        });
    }
    catch {
        res.status(500).json({ message: "Failed to load withdrawal summary" });
    }
}
async function updateWithdrawalStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const withdrawal = await Withdrawal_1.Withdrawal.findByPk(id);
        if (!withdrawal) {
            res.status(404).json({ message: "Withdrawal not found" });
            return;
        }
        const user = await User_1.User.findByPk(withdrawal.user_id);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (withdrawal.status === "Rejected" && status === "Approved") {
            res.status(400).json({ message: "Cannot approve a rejected withdrawal" });
            return;
        }
        if (withdrawal.status === "Approved" && status !== "Approved") {
            res.status(400).json({ message: "Approved withdrawals cannot be changed" });
            return;
        }
        if (status === "Rejected" && withdrawal.status === "Pending") {
            user.withdrawable_balance += withdrawal.amount;
            await user.save();
        }
        withdrawal.status = status;
        await withdrawal.save();
        await Notification_1.Notification.create({
            type: "withdrawal_status",
            message: `Your withdrawal was ${status}`,
            user_id: withdrawal.user_id
        });
        (0, emailService_1.sendWithdrawalStatusEmail)({
            to: user.email,
            name: user.name,
            status,
            amount: withdrawal.amount
        });
        res.status(200).json(withdrawal);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update withdrawal" });
    }
}
