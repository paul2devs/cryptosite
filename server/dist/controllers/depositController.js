"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeposit = createDeposit;
exports.getDepositQuote = getDepositQuote;
exports.getDepositAddresses = getDepositAddresses;
exports.getDepositCapabilities = getDepositCapabilities;
exports.getUserDeposits = getUserDeposits;
exports.getUserDepositByReference = getUserDepositByReference;
exports.submitDepositTransaction = submitDepositTransaction;
exports.rescanUserDeposit = rescanUserDeposit;
exports.getAdminDeposits = getAdminDeposits;
exports.getAdminDepositCounts = getAdminDepositCounts;
exports.getAdminDepositDetail = getAdminDepositDetail;
exports.approveAdminDeposit = approveAdminDeposit;
exports.rejectAdminDeposit = rejectAdminDeposit;
exports.rescanAdminDeposit = rescanAdminDeposit;
const express_validator_1 = require("express-validator");
const qrcode_1 = __importDefault(require("qrcode"));
const Deposit_1 = require("../models/Deposit");
const depositStatus_1 = require("../domain/depositStatus");
const depositRules_1 = require("../domain/depositRules");
const depositNetworkCapabilities_1 = require("../domain/depositNetworkCapabilities");
const walletService_1 = require("../services/walletService");
const depositQuoteService_1 = require("../services/depositQuoteService");
const depositLifecycleService_1 = require("../services/depositLifecycleService");
const depositAdminService_1 = require("../services/depositAdminService");
const depositMatchingService_1 = require("../services/depositMatchingService");
/**
 * Shape returned for a deposit. Mirrors the stored row plus the derived status
 * view, so the client never has to re-implement the status vocabulary and a
 * raw `verification_result` blob is not leaked to the end user.
 */
function serializeDeposit(deposit) {
    const detailed = (0, depositLifecycleService_1.detailedStatusOf)(deposit);
    return {
        deposit_id: deposit.deposit_id,
        reference: deposit.reference ?? null,
        user_id: deposit.user_id,
        crypto_type: deposit.crypto_type,
        amount: Number(deposit.amount),
        usd_amount: deposit.usd_amount === null || deposit.usd_amount === undefined
            ? null
            : Number(deposit.usd_amount),
        tx_hash: deposit.tx_hash ?? null,
        network: deposit.network ?? null,
        deposit_wallet: deposit.deposit_wallet ?? null,
        memo: deposit.memo ?? null,
        memo_label: deposit.memo_label ?? null,
        memo_required: Boolean(deposit.memo_required),
        received_amount: deposit.received_amount === null || deposit.received_amount === undefined
            ? null
            : Number(deposit.received_amount),
        confirmation_count: Number(deposit.confirmation_count || 0),
        detailed_status: detailed,
        status: deposit.status,
        status_view: (0, depositStatus_1.describeDepositStatus)(detailed),
        approval_required: true,
        rejection_reason: deposit.rejection_reason ?? null,
        reviewed_at: deposit.reviewed_at ? deposit.reviewed_at.toISOString() : null,
        detected_at: deposit.detected_at ? deposit.detected_at.toISOString() : null,
        verified_at: deposit.verified_at ? deposit.verified_at.toISOString() : null,
        expires_at: deposit.expires_at ? deposit.expires_at.toISOString() : null,
        confirmed_at: deposit.confirmed_at ? deposit.confirmed_at.toISOString() : null,
        approved_at: deposit.approved_at ? deposit.approved_at.toISOString() : null,
        timestamp: (deposit.timestamp || new Date()).toISOString()
    };
}
/**
 * Translate a lifecycle failure into a clean response. The internal cause is
 * logged so operators keep full diagnostics, while the user only sees the
 * specific, actionable sentence the service produced.
 */
function handleError(res, error, context, fallbackMessage) {
    if (error instanceof depositLifecycleService_1.DepositCreationError) {
        // eslint-disable-next-line no-console
        console.warn(`[deposit] ${context} rejected`, JSON.stringify({
            code: error.code,
            statusCode: error.statusCode,
            message: error.message,
            diagnostics: error.diagnostics
        }));
        res.status(error.statusCode).json({ message: error.message, code: error.code });
        return;
    }
    // eslint-disable-next-line no-console
    console.error(`[deposit] ${context} failed`, error);
    res.status(500).json({ message: fallbackMessage });
}
/**
 * Create a pending crypto deposit request.
 *
 * Only the authenticated user, a supported asset/network and an amount are
 * required. The record is created first and independently of market data and of
 * the blockchain: a verified conversion is re-checked when a rate is available,
 * but live pricing is never allowed to block the creation of a pending request.
 * The receiving address, exact amount and unique reference are then returned as
 * payment instructions. No wallet balance is touched and no admin approval is
 * bypassed here.
 */
async function createDeposit(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0]?.msg ?? "Invalid deposit request." });
        return;
    }
    const { crypto_type, amount, usd_amount, memo, idempotency_key } = req.body;
    const headerKey = typeof req.headers["idempotency-key"] === "string"
        ? req.headers["idempotency-key"]
        : null;
    try {
        const outcome = await (0, depositLifecycleService_1.createDepositRequest)({
            userId: req.user.userId,
            cryptoType: crypto_type,
            cryptoAmount: amount,
            usdAmount: usd_amount,
            memo,
            idempotencyKey: idempotency_key ?? headerKey
        });
        // eslint-disable-next-line no-console
        console.info("[deposit] request created", JSON.stringify({
            depositId: outcome.deposit.deposit_id,
            reference: outcome.diagnostics.reference,
            cryptoType: outcome.diagnostics.cryptoType,
            rateVerified: outcome.diagnostics.rateVerified,
            amountSource: outcome.diagnostics.amountSource,
            reusedExisting: outcome.diagnostics.reusedExisting,
            internalNotes: outcome.diagnostics.internalNotes
        }));
        res.status(outcome.diagnostics.reusedExisting ? 200 : 201).json({
            deposit: serializeDeposit(outcome.deposit),
            instructions: outcome.instructions,
            diagnostics: outcome.diagnostics
        });
    }
    catch (error) {
        handleError(res, error, "create", "We could not create your deposit right now. Please try again.");
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
/**
 * Configured receiving addresses with their QR codes. Assets whose address is
 * not configured are simply omitted so a single missing variable cannot break
 * the whole deposit surface.
 */
async function getDepositAddresses(_req, res) {
    try {
        const wallets = (0, walletService_1.getPlatformWallets)();
        const capabilities = (0, depositNetworkCapabilities_1.listDepositCapabilities)();
        const items = await Promise.all(wallets.map(async (wallet) => {
            const capability = capabilities.find((entry) => entry.platformAsset === wallet.asset);
            const qrCodeData = await qrcode_1.default.toDataURL(wallet.address, {
                errorCorrectionLevel: "M"
            });
            return {
                asset: wallet.asset,
                name: capability?.networkLabel ?? wallet.network,
                address: wallet.address,
                network: capability?.networkType ?? wallet.network,
                networkType: capability?.networkType ?? wallet.network,
                networkLabel: capability?.networkLabel ?? wallet.network,
                symbol: capability?.symbol ?? wallet.asset,
                cryptoType: capability?.cryptoType ?? null,
                decimals: capability?.decimals ?? 8,
                minConfirmations: capability?.minConfirmations ?? 0,
                memoSupported: capability?.memo.supported ?? false,
                memoRequired: capability?.memo.required ?? false,
                memoLabel: capability?.memo.label ?? null,
                qrCodeData
            };
        }));
        res.status(200).json(items);
    }
    catch (error) {
        handleError(res, error, "addresses", "Deposit addresses are unavailable right now. Please try again.");
    }
}
/** Static capability reference: which networks support a memo/tag and their thresholds. */
function getDepositCapabilities(_req, res) {
    res.status(200).json({
        capabilities: (0, depositNetworkCapabilities_1.listDepositCapabilities)().map((capability) => ({
            cryptoType: capability.cryptoType,
            platformAsset: capability.platformAsset,
            symbol: capability.symbol,
            networkLabel: capability.networkLabel,
            networkType: capability.networkType,
            decimals: capability.decimals,
            minConfirmations: capability.minConfirmations,
            memoSupported: capability.memo.supported,
            memoRequired: capability.memo.required,
            memoLabel: capability.memo.label,
            memoGuidance: capability.memo.guidance,
            sendingInstruction: capability.sendingInstruction,
            networkWarning: capability.networkWarning
        })),
        memoSupport: (0, depositNetworkCapabilities_1.memoSupportSummary)(),
        missingReceivingAddresses: (0, walletService_1.missingDepositAddressEnv)()
    });
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
        res.status(200).json(deposits.map(serializeDeposit));
    }
    catch (error) {
        handleError(res, error, "list", "We could not load your deposits right now.");
    }
}
/** Status and payment instructions for one of the caller's deposits. */
async function getUserDepositByReference(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const deposit = await (0, depositLifecycleService_1.findUserDepositByReference)(req.user.userId, req.params.reference);
        if (!deposit) {
            res.status(404).json({ message: "We could not find that deposit." });
            return;
        }
        res.status(200).json({
            deposit: serializeDeposit(deposit),
            instructions: (0, depositLifecycleService_1.buildDepositInstructions)(deposit)
        });
    }
    catch (error) {
        handleError(res, error, "detail", "We could not load that deposit right now.");
    }
}
/**
 * Attach a transaction hash supplied by the user. The hash is only used as a
 * pointer — the amount, receiver, network and confirmations are all re-read
 * from the blockchain, so a submitted hash is never trusted on its own. A
 * successful verification stops at "awaiting administrator approval".
 */
async function submitDepositTransaction(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ message: errors.array()[0]?.msg ?? "Invalid transaction hash." });
        return;
    }
    const { tx_hash } = req.body;
    try {
        const result = await (0, depositLifecycleService_1.submitDepositTransactionHash)({
            userId: req.user.userId,
            reference: req.params.reference,
            txHash: tx_hash
        });
        res.status(200).json({
            deposit: serializeDeposit(result.deposit),
            instructions: result.instructions,
            verification: result.verification,
            message: result.message
        });
    }
    catch (error) {
        handleError(res, error, "submit-transaction", "We could not verify that transaction right now.");
    }
}
/** Re-check one of the caller's deposits against the chain immediately. */
async function rescanUserDeposit(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const deposit = await (0, depositLifecycleService_1.findUserDepositByReference)(req.user.userId, req.params.reference);
        if (!deposit) {
            res.status(404).json({ message: "We could not find that deposit." });
            return;
        }
        const outcome = await (0, depositMatchingService_1.rescanDeposit)(deposit.deposit_id);
        const refreshed = await Deposit_1.Deposit.findByPk(deposit.deposit_id);
        res.status(200).json({
            deposit: refreshed ? serializeDeposit(refreshed) : serializeDeposit(deposit),
            instructions: refreshed ? (0, depositLifecycleService_1.buildDepositInstructions)(refreshed) : null,
            outcome
        });
    }
    catch (error) {
        handleError(res, error, "rescan", "We could not check that deposit right now.");
    }
}
async function getAdminDeposits(req, res) {
    try {
        const result = await (0, depositAdminService_1.listCryptoDepositsForAdmin)(req.query);
        res.status(200).json(result);
    }
    catch (error) {
        handleError(res, error, "admin-list", "We could not load the deposit queue right now.");
    }
}
async function getAdminDepositCounts(_req, res) {
    try {
        res.status(200).json(await (0, depositAdminService_1.pendingDepositReviewCounts)());
    }
    catch (error) {
        handleError(res, error, "admin-counts", "We could not load deposit review counts right now.");
    }
}
async function getAdminDepositDetail(req, res) {
    try {
        res.status(200).json(await (0, depositAdminService_1.cryptoDepositDetailForAdmin)(req.params.depositId));
    }
    catch (error) {
        handleError(res, error, "admin-detail", "We could not load that deposit right now.");
    }
}
/**
 * Approve a deposit. This is the only path that credits a wallet. The
 * transaction is re-verified on the correct chain first, the status change is
 * row-locked, and every wallet-side effect is idempotent, so a duplicate
 * approval cannot credit twice.
 */
async function approveAdminDeposit(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { reason } = req.body;
    try {
        const outcome = await (0, depositLifecycleService_1.approveDeposit)(req.user.userId, req.params.depositId, typeof reason === "string" ? reason : "");
        res.status(200).json({
            deposit: serializeDeposit(outcome.deposit),
            credited: outcome.credited
        });
    }
    catch (error) {
        handleError(res, error, "approve", "We could not approve that deposit right now.");
    }
}
/** Reject a deposit. A reason is mandatory and is recorded in the audit trail. */
async function rejectAdminDeposit(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { reason } = req.body;
    try {
        const outcome = await (0, depositLifecycleService_1.rejectDeposit)(req.user.userId, req.params.depositId, typeof reason === "string" ? reason : "");
        res.status(200).json({
            deposit: serializeDeposit(outcome.deposit),
            rejected: outcome.rejected
        });
    }
    catch (error) {
        handleError(res, error, "reject", "We could not reject that deposit right now.");
    }
}
/** Administrator-initiated chain re-scan / reconciliation for one deposit. */
async function rescanAdminDeposit(req, res) {
    try {
        const outcome = await (0, depositMatchingService_1.rescanDeposit)(req.params.depositId);
        const detail = await (0, depositAdminService_1.cryptoDepositDetailForAdmin)(req.params.depositId);
        res.status(200).json({ outcome, deposit: detail.deposit, auditTrail: detail.auditTrail });
    }
    catch (error) {
        handleError(res, error, "admin-rescan", "We could not re-scan that deposit right now.");
    }
}
