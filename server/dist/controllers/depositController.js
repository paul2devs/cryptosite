"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeposit = createDeposit;
exports.getDepositQuote = getDepositQuote;
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
const financialOperationsService_1 = require("../services/financialOperationsService");
const depositRules_1 = require("../domain/depositRules");
const depositQuoteService_1 = require("../services/depositQuoteService");
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
    const { crypto_type, amount, tx_hash, usd_amount } = req.body;
    try {
        const user = await User_1.User.findByPk(req.user.userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        if (!(0, depositRules_1.isSupportedDepositCryptoType)(crypto_type)) {
            res.status(400).json({
                message: "Select a supported asset and network before submitting a deposit."
            });
            return;
        }
        const submission = (0, depositRules_1.validateDepositSubmission)({
            cryptoType: crypto_type,
            amount,
            txHash: tx_hash
        });
        if (!submission.valid) {
            res.status(400).json({ message: submission.errors[0] });
            return;
        }
        const normalizedHash = submission.normalizedTxHash;
        const numericAmount = submission.numericAmount;
        // Re-derive the USD→crypto conversion from the backend pricing service so a
        // client-computed amount cannot diverge from the displayed quote.
        const conversion = await (0, depositQuoteService_1.validateDepositConversion)({
            cryptoType: crypto_type,
            cryptoAmount: numericAmount,
            usdAmount: typeof usd_amount === "number" ? usd_amount : null
        });
        if (!conversion.valid) {
            res.status(400).json({ message: conversion.errors[0] });
            return;
        }
        const existing = await Deposit_1.Deposit.findOne({
            where: { tx_hash: normalizedHash }
        });
        if (existing) {
            res.status(400).json({
                message: "This transaction hash has already been submitted. Each on-chain transaction can only be used once."
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
            tx_hash: normalizedHash,
            network: verification.network || (0, depositRules_1.resolveDepositNetwork)(crypto_type),
            deposit_wallet: verification.toAddress || null,
            confirmation_count: verification.confirmations ?? 0,
            verification_result: verification
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
        res
            .status(500)
            .json({ message: "We could not create your deposit right now. Please try again." });
    }
}
async function getDepositQuote(req, res) {
    const cryptoType = String(req.query.crypto_type || "").trim().toUpperCase();
    if (!(0, depositRules_1.isSupportedDepositCryptoType)(cryptoType)) {
        res.status(400).json({
            message: "Select a supported asset and network to see a conversion."
        });
        return;
    }
    const rawUsd = req.query.usd_amount;
    const usdAmount = typeof rawUsd === "string" && rawUsd.trim().length > 0 ? Number(rawUsd) : null;
    try {
        const quote = await (0, depositQuoteService_1.buildDepositQuote)({
            cryptoType,
            usdAmount: usdAmount !== null && Number.isFinite(usdAmount) ? usdAmount : null
        });
        res.status(200).json(quote);
    }
    catch {
        res.status(500).json({
            message: "We could not calculate a conversion right now. Please try again shortly."
        });
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
        if (status === "Approved" && previousStatus !== "Approved") {
            if (!deposit.tx_hash) {
                res.status(400).json({ message: "Deposit cannot be confirmed without a transaction hash." });
                return;
            }
            const verification = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
                cryptoType: deposit.crypto_type,
                txHash: deposit.tx_hash,
                expectedAmount: Number(deposit.amount)
            });
            deposit.verification_result = verification;
            deposit.confirmation_count = verification.confirmations ?? 0;
            if (!verification.success) {
                res.status(400).json({
                    message: verification.failureReason || "Deposit cannot be confirmed without successful blockchain verification."
                });
                return;
            }
            deposit.approved_at = new Date();
            deposit.confirmed_at = deposit.approved_at;
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
            await (0, financialOperationsService_1.recordConfirmedDeposit)(deposit);
        }
        res.status(200).json(deposit);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update deposit" });
    }
}
