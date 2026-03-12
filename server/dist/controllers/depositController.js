"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeposit = createDeposit;
exports.getDepositAddresses = getDepositAddresses;
exports.getUserDeposits = getUserDeposits;
exports.getAllDeposits = getAllDeposits;
exports.updateDepositStatus = updateDepositStatus;
const express_validator_1 = require("express-validator");
const Deposit_1 = require("../models/Deposit");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const gamificationService_1 = require("../services/gamificationService");
const behaviorService_1 = require("../services/behaviorService");
const socket_1 = require("../realtime/socket");
const activityService_1 = require("../services/activityService");
const referralService_1 = require("../services/referralService");
const walletService_1 = require("../services/walletService");
const blockchainVerificationService_1 = require("../services/blockchainVerificationService");
const qrcode_1 = __importDefault(require("qrcode"));
const emailService_1 = require("../services/email/emailService");
async function createDeposit(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    const { crypto_type, amount, tx_hash } = req.body;
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (!tx_hash || typeof tx_hash !== "string" || tx_hash.trim().length < 8) {
            res.status(400).json({
                message: "A valid blockchain transaction hash is required to submit a deposit."
            });
            return;
        }
        const normalizedHash = tx_hash.trim();
        const existing = await Deposit_1.Deposit.findOne({
            where: { tx_hash: normalizedHash }
        });
        if (existing) {
            res.status(400).json({
                message: "This transaction hash has already been submitted. Each on-chain transaction can only be used once."
            });
            return;
        }
        const numericAmount = Number(amount);
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
            res.status(400).json({
                message: "Deposit amount must be a positive number."
            });
            return;
        }
        console.info("[deposit] Incoming deposit request", JSON.stringify({
            userId: user.user_id,
            crypto_type,
            amount: numericAmount,
            tx_hash: normalizedHash
        }));
        const verification = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
            cryptoType: crypto_type,
            txHash: normalizedHash,
            expectedAmount: numericAmount
        });
        if (!verification.success) {
            console.warn("[deposit] Blockchain verification failed", JSON.stringify({
                userId: user.user_id,
                crypto_type,
                amount: numericAmount,
                tx_hash: normalizedHash,
                reason: verification.failureReason,
                confirmations: verification.confirmations
            }));
            res.status(400).json({
                message: verification.failureReason ||
                    "Blockchain verification failed for this transaction hash."
            });
            return;
        }
        console.info("[deposit] Blockchain verification passed", JSON.stringify({
            userId: user.user_id,
            crypto_type,
            amount: numericAmount,
            tx_hash: normalizedHash,
            confirmations: verification.confirmations
        }));
        const deposit = await Deposit_1.Deposit.create({
            user_id: req.user.userId,
            crypto_type,
            amount: numericAmount,
            tx_hash: normalizedHash
        });
        await (0, gamificationService_1.applyDepositGamification)(user, deposit, {
            hasReferralBonus: false
        });
        await Notification_1.Notification.create({
            type: "deposit_created",
            message: "Deposit verified on-chain and submitted for review",
            user_id: req.user.userId
        });
        (0, emailService_1.sendDepositStatusEmail)({
            to: user.email,
            name: user.name,
            status: "Pending",
            amount: numericAmount,
            asset: crypto_type
        });
        await (0, behaviorService_1.recordDepositBehavior)(user, amount);
        await (0, activityService_1.trackUserActivity)(user.user_id, "deposit", {
            amount,
            crypto_type,
            deposit_id: deposit.deposit_id
        });
        const alias = `${user.name.slice(0, 3)}***`;
        (0, socket_1.emitSocialProofDeposit)(deposit, alias);
        res.status(201).json(deposit);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create deposit" });
    }
}
async function getDepositAddresses(_req, res) {
    try {
        const wallets = (0, walletService_1.getPlatformWallets)();
        const items = await Promise.all(wallets.map(async (w) => {
            const qrCodeData = await qrcode_1.default.toDataURL(w.address, {
                errorCorrectionLevel: "M"
            });
            let name;
            let networkType;
            switch (w.asset) {
                case "BTC":
                    name = "Bitcoin";
                    networkType = "BTC";
                    break;
                case "ETH":
                    name = "Ethereum";
                    networkType = "ERC20";
                    break;
                case "SOL":
                    name = "Solana";
                    networkType = "SOL";
                    break;
                case "USDT_TRC20":
                    name = "Tether (USDT)";
                    networkType = "TRC20";
                    break;
                case "USDT_ERC20":
                default:
                    name = "Tether (USDT)";
                    networkType = "ERC20";
                    break;
            }
            return {
                asset: w.asset,
                name,
                address: w.address,
                network: w.network,
                networkType,
                qrCodeData
            };
        }));
        res.status(200).json(items);
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to load deposit addresses. Please contact support."
        });
    }
}
async function getUserDeposits(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const deposits = await Deposit_1.Deposit.findAll({
            where: { user_id: req.user.userId },
            order: [["timestamp", "DESC"]]
        });
        res.status(200).json(deposits);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch deposits" });
    }
}
async function getAllDeposits(req, res) {
    try {
        const deposits = await Deposit_1.Deposit.findAll({
            include: [{ model: User_1.User }],
            order: [["timestamp", "DESC"]]
        });
        res.status(200).json(deposits);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch deposits" });
    }
}
async function updateDepositStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const deposit = await Deposit_1.Deposit.findByPk(id);
        if (!deposit) {
            res.status(404).json({ message: "Deposit not found" });
            return;
        }
        const previousStatus = deposit.status;
        deposit.status = status;
        if (status === "Approved") {
            if (!deposit.approved_at) {
                deposit.approved_at = new Date();
            }
        }
        if (previousStatus === "Approved" && status !== "Approved") {
            deposit.approved_at = null;
        }
        await deposit.save();
        await Notification_1.Notification.create({
            type: "deposit_status",
            message: `Your deposit was ${status}`,
            user_id: deposit.user_id
        });
        const owner = await User_1.User.findByPk(deposit.user_id);
        if (owner) {
            (0, emailService_1.sendDepositStatusEmail)({
                to: owner.email,
                name: owner.name,
                status,
                amount: deposit.amount,
                asset: deposit.crypto_type
            });
        }
        if (status === "Approved" && previousStatus !== "Approved") {
            await (0, referralService_1.grantReferralRewardsOnApprovedDeposit)(deposit);
        }
        res.status(200).json(deposit);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update deposit" });
    }
}
