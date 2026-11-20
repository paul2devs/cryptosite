"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepositCreationError = exports.RETRYABLE_PROVIDER_STAGES = exports.CLOSED_DEPOSIT_STATUSES = exports.OPEN_DEPOSIT_STATUSES = exports.UNPAID_DEPOSIT_STATUSES = void 0;
exports.depositExpiryHours = depositExpiryHours;
exports.detailedStatusOf = detailedStatusOf;
exports.statusViewOf = statusViewOf;
exports.buildDepositInstructions = buildDepositInstructions;
exports.createDepositRequest = createDepositRequest;
exports.findUserDepositByReference = findUserDepositByReference;
exports.applyVerificationResult = applyVerificationResult;
exports.recordVerifiedPayment = recordVerifiedPayment;
exports.submitDepositTransactionHash = submitDepositTransactionHash;
exports.approveDeposit = approveDeposit;
exports.rejectDeposit = rejectDeposit;
exports.expireStaleDeposits = expireStaleDeposits;
exports.listActiveDepositsForMonitor = listActiveDepositsForMonitor;
exports.capabilityForDeposit = capabilityForDeposit;
exports.requireInstructions = requireInstructions;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Deposit_1 = require("../models/Deposit");
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const depositRules_1 = require("../domain/depositRules");
const depositNetworkCapabilities_1 = require("../domain/depositNetworkCapabilities");
const depositReference_1 = require("../domain/depositReference");
const depositStatus_1 = require("../domain/depositStatus");
const depositQuote_1 = require("../domain/depositQuote");
const gamificationService_1 = require("./gamificationService");
const behaviorService_1 = require("./behaviorService");
const socket_1 = require("../realtime/socket");
const activityService_1 = require("./activityService");
const referralService_1 = require("./referralService");
const walletService_1 = require("./walletService");
const blockchainVerificationService_1 = require("./blockchainVerificationService");
const depositQuoteService_1 = require("./depositQuoteService");
const financialOperationsService_1 = require("./financialOperationsService");
const notificationDispatchService_1 = require("./notificationDispatchService");
const depositValuation_1 = require("../domain/depositValuation");
const marketDataService_1 = require("./marketDataService");
/** A deposit that has not received a matching transfer yet. */
exports.UNPAID_DEPOSIT_STATUSES = ["PENDING"];
/** A deposit that still requires attention (payment, confirmations or review). */
exports.OPEN_DEPOSIT_STATUSES = [
    "PENDING",
    "DETECTED",
    "CONFIRMING",
    "AWAITING_ADMIN_APPROVAL"
];
/** Terminal states never accept a new payment and never change again. */
exports.CLOSED_DEPOSIT_STATUSES = [
    "COMPLETED",
    "REJECTED",
    "EXPIRED",
    "FAILED"
];
/**
 * Verification outcomes that mean "we could not ask the chain", as opposed to
 * "the chain answered". The transfer may still be perfectly valid, so the hash
 * the depositor submitted is kept on the deposit and the lookup is retryable.
 */
exports.RETRYABLE_PROVIDER_STAGES = [
    "provider_unavailable",
    "provider_error"
];
const DEFAULT_EXPIRY_HOURS = 24;
const DEFAULT_DUPLICATE_WINDOW_SECONDS = 60;
const REFERENCE_ATTEMPTS = 6;
function readPositiveNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (!raw || String(raw).trim().length === 0) {
        return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function depositExpiryHours() {
    return readPositiveNumberEnv("DEPOSIT_EXPIRY_HOURS", DEFAULT_EXPIRY_HOURS);
}
function duplicateWindowSeconds() {
    return readPositiveNumberEnv("DEPOSIT_DUPLICATE_WINDOW_SECONDS", DEFAULT_DUPLICATE_WINDOW_SECONDS);
}
/**
 * Best-effort USD valuation of a verified received quantity.
 *
 * Stablecoins are valued at par and need no price. Volatile assets keep their
 * received quantity and use a market price only to record a separate USD figure;
 * if the price provider is unavailable the quantity is still preserved and the
 * USD value is left as "unavailable". This never blocks approval and never
 * substitutes a market price for the amount actually received.
 */
async function resolveDepositUsdValue(cryptoType, quantity) {
    const symbol = (0, depositValuation_1.depositAssetSymbol)(cryptoType);
    let price = null;
    if (symbol && symbol !== "USDT") {
        try {
            const prices = await (0, marketDataService_1.getAllMarketPrices)();
            const point = prices[symbol];
            price = point && Number.isFinite(point.price) ? point.price : null;
        }
        catch {
            price = null;
        }
    }
    const valuation = (0, depositValuation_1.valueDepositInUsd)({ cryptoType, quantity, price });
    return { usd: valuation.usd, basis: valuation.basis };
}
/**
 * A failure the controller can translate into a clean HTTP response. The
 * `diagnostics` payload is logged internally and never returned verbatim to the
 * user, so internal causes stay visible to operators while the user sees one
 * actionable sentence.
 */
class DepositCreationError extends Error {
    constructor(statusCode, code, message, diagnostics = {}) {
        super(message);
        this.name = "DepositCreationError";
        this.statusCode = statusCode;
        this.code = code;
        this.diagnostics = diagnostics;
    }
}
exports.DepositCreationError = DepositCreationError;
function trimNumberLabel(value, decimals) {
    const fixed = value.toFixed(decimals);
    return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}
function detailedStatusOf(deposit) {
    const stored = deposit.detailed_status;
    if ((0, depositStatus_1.isDepositDetailedStatus)(stored)) {
        return stored;
    }
    if (deposit.status === "Approved") {
        return "COMPLETED";
    }
    if (deposit.status === "Rejected") {
        return "FAILED";
    }
    return "PENDING";
}
function statusViewOf(deposit) {
    const detailed = detailedStatusOf(deposit);
    return { ...(0, depositStatus_1.describeDepositStatus)(detailed), detailed };
}
function openStatusWhere() {
    return { [sequelize_1.Op.in]: exports.OPEN_DEPOSIT_STATUSES };
}
/**
 * Build the payment instructions shown to the user after a deposit request
 * exists. Returns null when the asset has no configured receiving address, so
 * the caller can report an unavailable deposit method instead of showing a
 * broken address.
 */
function buildDepositInstructions(deposit) {
    const cryptoType = deposit.crypto_type;
    if (!(0, depositRules_1.isSupportedDepositCryptoType)(cryptoType)) {
        return null;
    }
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)(cryptoType);
    const wallet = (0, walletService_1.getPlatformWallet)(capability.platformAsset);
    if (!wallet) {
        return null;
    }
    const detailed = detailedStatusOf(deposit);
    const view = (0, depositStatus_1.describeDepositStatus)(detailed);
    const amount = Number(deposit.amount);
    const memoSupported = capability.memo.supported;
    return {
        reference: deposit.reference ?? "",
        depositId: deposit.deposit_id,
        cryptoType,
        platformAsset: capability.platformAsset,
        symbol: capability.symbol,
        networkLabel: capability.networkLabel,
        networkType: capability.networkType,
        receivingAddress: wallet.address,
        amountToSend: amount,
        amountToSendLabel: `${trimNumberLabel(amount, capability.decimals)} ${capability.symbol}`,
        usdAmount: deposit.usd_amount === null || deposit.usd_amount === undefined
            ? null
            : Number(deposit.usd_amount),
        memo: memoSupported ? deposit.memo ?? null : null,
        memoLabel: memoSupported ? deposit.memo_label ?? capability.memo.label : null,
        memoRequired: memoSupported ? Boolean(deposit.memo_required) : false,
        memoGuidance: memoSupported ? capability.memo.guidance : null,
        memoSupported,
        minConfirmations: capability.minConfirmations,
        sendingInstruction: capability.sendingInstruction,
        networkWarning: capability.networkWarning,
        status: {
            detailed,
            coarse: deposit.status,
            label: view.label,
            tone: view.tone,
            message: view.message
        },
        transactionHash: deposit.tx_hash ?? null,
        receivedAmount: deposit.received_amount === null || deposit.received_amount === undefined
            ? null
            : Number(deposit.received_amount),
        confirmations: Number(deposit.confirmation_count || 0),
        detectedAt: deposit.detected_at ? deposit.detected_at.toISOString() : null,
        verifiedAt: deposit.verified_at ? deposit.verified_at.toISOString() : null,
        expiresAt: deposit.expires_at ? deposit.expires_at.toISOString() : null,
        createdAt: (deposit.timestamp || new Date()).toISOString(),
        approvalRequired: true,
        rejectionReason: deposit.rejection_reason ?? null
    };
}
function requireInstructions(deposit) {
    const instructions = buildDepositInstructions(deposit);
    if (!instructions) {
        throw new DepositCreationError(500, "INSTRUCTIONS_UNAVAILABLE", "We could not build payment instructions for this deposit. Please contact support.", { depositId: deposit.deposit_id, cryptoType: deposit.crypto_type });
    }
    return instructions;
}
async function pickExistingForIdempotency(userId, idempotencyKey) {
    return Deposit_1.Deposit.findOne({
        where: { user_id: userId, idempotency_key: idempotencyKey },
        order: [["timestamp", "DESC"]]
    });
}
/**
 * Create a pending deposit request.
 *
 * A pending record only needs the authenticated user, a supported asset/network
 * and an amount. It is deliberately independent of live market pricing: the
 * pricing service is consulted only to *re-validate* the conversion when a rate
 * is available, never to authorise the insert. When pricing is unavailable the
 * request is still created and the diagnostics record that the rate could not
 * be re-derived; the exact amount the user must send is the one shown on the
 * payment screen. No wallet balance is touched here.
 */
async function createDepositRequest(request) {
    const cryptoType = request.cryptoType;
    if (!(0, depositRules_1.isSupportedDepositCryptoType)(cryptoType)) {
        throw new DepositCreationError(400, "UNSUPPORTED_ASSET", "Select a supported asset and network before creating a deposit.");
    }
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)(cryptoType);
    const wallet = (0, walletService_1.getPlatformWallet)(capability.platformAsset);
    if (!wallet) {
        throw new DepositCreationError(503, "DEPOSIT_METHOD_UNAVAILABLE", `${capability.networkLabel} deposits are not available right now. Choose a different asset or network, or contact support.`, { cryptoType, missingAddressFor: capability.platformAsset });
    }
    const user = await User_1.User.findByPk(request.userId);
    if (!user) {
        throw new DepositCreationError(404, "USER_NOT_FOUND", "We could not find your account.");
    }
    const intent = (0, depositRules_1.validateDepositIntent)({
        cryptoType,
        cryptoAmount: request.cryptoAmount,
        usdAmount: request.usdAmount
    });
    if (!intent.valid) {
        throw new DepositCreationError(400, "INVALID_INTENT", intent.errors[0], {
            errors: intent.errors
        });
    }
    if (intent.numericUsdAmount !== null) {
        const usdCheck = (0, depositQuote_1.validateUsdAmountInput)(String(intent.numericUsdAmount));
        if (!usdCheck.valid && usdCheck.message) {
            throw new DepositCreationError(400, "INVALID_USD_AMOUNT", usdCheck.message, {
                minUsd: depositQuote_1.DEPOSIT_MIN_USD,
                maxUsd: depositQuote_1.DEPOSIT_MAX_USD
            });
        }
    }
    const memoValidation = (0, depositNetworkCapabilities_1.validateDepositMemo)(capability, request.memo);
    if (!memoValidation.valid && memoValidation.error) {
        throw new DepositCreationError(400, "INVALID_MEMO", memoValidation.error, { cryptoType });
    }
    const internalNotes = [];
    let resolvedCryptoAmount = intent.numericCryptoAmount;
    let amountSource = resolvedCryptoAmount !== null ? "client" : "server-rate";
    let rateVerified = false;
    let rateSource = null;
    let rateReason = null;
    let quoteAvailable = false;
    let quoteRate = null;
    try {
        const quote = await (0, depositQuoteService_1.buildDepositQuote)({ cryptoType });
        quoteAvailable = quote.available && quote.rate !== null;
        quoteRate = quote.rate;
        if (quoteAvailable) {
            rateSource = quote.rateSource;
        }
        else {
            rateReason = quote.reason || "Current conversion pricing is temporarily unavailable.";
            internalNotes.push("market_data_unavailable");
        }
    }
    catch (error) {
        rateReason = "Current conversion pricing is temporarily unavailable.";
        internalNotes.push(`market_data_error:${error instanceof Error ? error.message : String(error)}`);
    }
    if (quoteAvailable && quoteRate !== null) {
        if (intent.numericUsdAmount !== null) {
            const expected = (0, depositQuote_1.usdToCryptoAmount)(intent.numericUsdAmount, quoteRate, depositRules_1.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType]);
            if (expected === null) {
                throw new DepositCreationError(400, "AMOUNT_TOO_SMALL", "The deposit amount is too small to convert to the selected asset.");
            }
            if (resolvedCryptoAmount === null) {
                resolvedCryptoAmount = expected;
            }
            else if (!(0, depositQuote_1.withinConversionTolerance)(resolvedCryptoAmount, expected)) {
                throw new DepositCreationError(409, "RATE_CHANGED", "The submitted amount no longer matches the current exchange rate. Refresh the rate and try again.", { submitted: resolvedCryptoAmount, expectedFromRate: expected });
            }
            rateVerified = true;
        }
        else if (resolvedCryptoAmount !== null) {
            rateVerified = true;
        }
    }
    if (!rateVerified && resolvedCryptoAmount === null) {
        throw new DepositCreationError(409, "RATE_UNAVAILABLE", "We cannot fix the exact amount to send until a live rate is available. Refresh the rate and try again.", { cryptoType, rateReason });
    }
    if (resolvedCryptoAmount === null) {
        throw new DepositCreationError(400, "INVALID_INTENT", "Enter a deposit amount.");
    }
    const numericCryptoAmount = resolvedCryptoAmount;
    const numericUsdAmount = intent.numericUsdAmount;
    const idempotencyKey = typeof request.idempotencyKey === "string" && request.idempotencyKey.trim().length > 0
        ? request.idempotencyKey.trim().slice(0, 120)
        : null;
    if (idempotencyKey) {
        const existing = await pickExistingForIdempotency(request.userId, idempotencyKey);
        if (existing) {
            return {
                deposit: existing,
                instructions: requireInstructions(existing),
                diagnostics: {
                    reference: existing.reference ?? "",
                    cryptoType,
                    networkLabel: capability.networkLabel,
                    rateVerified: false,
                    rateSource,
                    rateReason,
                    amountSource,
                    reusedExisting: true,
                    internalNotes: [...internalNotes, "idempotency_hit"]
                }
            };
        }
    }
    else {
        // No idempotency key was supplied (older clients / direct API use): collapse
        // the double-click case by returning an identical, still-unpaid request made
        // inside the duplicate window instead of inserting a second row.
        const since = new Date(Date.now() - duplicateWindowSeconds() * 1000);
        const duplicate = await Deposit_1.Deposit.findOne({
            where: {
                user_id: request.userId,
                crypto_type: cryptoType,
                amount: numericCryptoAmount,
                detailed_status: { [sequelize_1.Op.in]: exports.UNPAID_DEPOSIT_STATUSES },
                timestamp: { [sequelize_1.Op.gte]: since }
            },
            order: [["timestamp", "DESC"]]
        });
        if (duplicate) {
            return {
                deposit: duplicate,
                instructions: requireInstructions(duplicate),
                diagnostics: {
                    reference: duplicate.reference ?? "",
                    cryptoType,
                    networkLabel: capability.networkLabel,
                    rateVerified,
                    rateSource,
                    rateReason,
                    amountSource,
                    reusedExisting: true,
                    internalNotes: [...internalNotes, "duplicate_window_hit"]
                }
            };
        }
    }
    const expiresAt = new Date(Date.now() + depositExpiryHours() * 60 * 60 * 1000);
    let created = null;
    let lastError = null;
    for (let attempt = 0; attempt < REFERENCE_ATTEMPTS && created === null; attempt += 1) {
        const reference = (0, depositReference_1.generateDepositReference)();
        try {
            created = await database_1.sequelize.transaction(async (transaction) => Deposit_1.Deposit.create({
                user_id: request.userId,
                crypto_type: cryptoType,
                amount: numericCryptoAmount,
                usd_amount: numericUsdAmount,
                network: capability.networkType,
                deposit_wallet: wallet.address,
                memo: memoValidation.memo,
                memo_label: memoValidation.memo ? capability.memo.label : null,
                memo_required: memoValidation.memo ? Boolean(capability.memo.required) : false,
                status: (0, depositStatus_1.coarseStatusForDepositDetailed)("PENDING"),
                detailed_status: "PENDING",
                reference,
                idempotency_key: idempotencyKey,
                expires_at: expiresAt,
                confirmation_count: 0
            }, { transaction }));
        }
        catch (error) {
            lastError = error;
            if (!(error instanceof sequelize_1.UniqueConstraintError)) {
                throw error;
            }
            if (idempotencyKey) {
                const existing = await pickExistingForIdempotency(request.userId, idempotencyKey);
                if (existing) {
                    return {
                        deposit: existing,
                        instructions: requireInstructions(existing),
                        diagnostics: {
                            reference: existing.reference ?? "",
                            cryptoType,
                            networkLabel: capability.networkLabel,
                            rateVerified,
                            rateSource,
                            rateReason,
                            amountSource,
                            reusedExisting: true,
                            internalNotes: [...internalNotes, "idempotency_race"]
                        }
                    };
                }
            }
            internalNotes.push(`reference_collision_attempt_${attempt + 1}`);
        }
    }
    if (!created) {
        throw new DepositCreationError(503, "REFERENCE_EXHAUSTED", "We could not allocate a deposit reference right now. Please try again.", { referenceBodyLength: depositReference_1.DEPOSIT_REFERENCE_BODY_LENGTH, lastError: String(lastError) });
    }
    await (0, activityService_1.trackUserActivity)(request.userId, "deposit", {
        deposit_id: created.deposit_id,
        reference: created.reference,
        amount: numericCryptoAmount,
        usd_amount: numericUsdAmount,
        crypto_type: cryptoType
    });
    const createdMessage = `Deposit request ${created.reference} created. Send exactly ${trimNumberLabel(numericCryptoAmount, capability.decimals)} ${capability.symbol} on the ${capability.networkLabel} network. Your transaction is awaiting platform verification before your wallet can be credited.`;
    await Notification_1.Notification.create({
        type: "deposit_created",
        message: createdMessage,
        user_id: request.userId
    });
    await (0, notificationDispatchService_1.dispatchNotificationEmail)({
        user,
        type: "deposit_created",
        message: createdMessage,
        email: {
            sourceId: created.deposit_id,
            subject: `Deposit submitted: ${capability.symbol}`,
            heading: "Deposit request received",
            preheader: "Your deposit request has been submitted and is awaiting payment.",
            details: [
                { label: "Reference", value: created.reference ?? created.deposit_id },
                {
                    label: "Amount",
                    value: `${trimNumberLabel(numericCryptoAmount, capability.decimals)} ${capability.symbol}`
                },
                { label: "Network", value: capability.networkLabel },
                { label: "Status", value: "Awaiting payment / platform verification" },
                { label: "Date", value: new Date().toISOString() }
            ],
            statusLabel: "Submitted",
            statusTone: "gold",
            ctaLabel: "View deposit",
            ctaPath: "/deposit"
        }
    });
    return {
        deposit: created,
        instructions: requireInstructions(created),
        diagnostics: {
            reference: created.reference ?? "",
            cryptoType,
            networkLabel: capability.networkLabel,
            rateVerified,
            rateSource,
            rateReason,
            amountSource,
            reusedExisting: false,
            internalNotes
        }
    };
}
async function findUserDepositByReference(userId, reference) {
    const normalized = (0, depositReference_1.normalizeDepositReference)(reference);
    if (!normalized) {
        return null;
    }
    return Deposit_1.Deposit.findOne({ where: { user_id: userId, reference: normalized } });
}
/**
 * Record the outcome of an independent verification on the deposit.
 *
 * Nothing is ever credited here. A fully verified transfer stops at
 * AWAITING_ADMIN_APPROVAL, where it waits for an administrator's explicit
 * decision; a transfer that is still confirming moves to DETECTED/CONFIRMING so
 * the user sees real progress; every other stage is stored as a diagnostic and
 * the deposit stays PENDING.
 */
async function applyVerificationResult(deposit, verification) {
    const current = await Deposit_1.Deposit.findByPk(deposit.deposit_id);
    if (!current) {
        return deposit;
    }
    const detailed = detailedStatusOf(current);
    if (exports.CLOSED_DEPOSIT_STATUSES.includes(detailed)) {
        return current;
    }
    if (detailed === "AWAITING_ADMIN_APPROVAL" && verification.stage !== "verified") {
        // The transaction was already verified once; do not regress the state on a
        // transient provider error.
        current.verification_result = verification;
        await current.save();
        return current;
    }
    const now = new Date();
    current.verification_result = verification;
    if (verification.stage === "verified") {
        current.tx_hash = verification.txHash;
        current.received_amount = verification.amount;
        current.confirmation_count = verification.confirmations;
        current.network = verification.network || current.network;
        current.deposit_wallet = verification.toAddress || current.deposit_wallet;
        current.detected_at = current.detected_at ?? now;
        current.verified_at = now;
        current.detailed_status = "AWAITING_ADMIN_APPROVAL";
        current.status = (0, depositStatus_1.coarseStatusForDepositDetailed)("AWAITING_ADMIN_APPROVAL");
        await current.save();
        const awaitingRef = current.reference ?? current.deposit_id;
        const awaitingMessage = `Deposit ${awaitingRef} was verified on-chain and is now awaiting platform verification.`;
        await Notification_1.Notification.create({
            type: "deposit_awaiting_approval",
            message: awaitingMessage,
            user_id: current.user_id
        });
        const awaitingUser = await User_1.User.findByPk(current.user_id);
        if (awaitingUser) {
            await (0, notificationDispatchService_1.dispatchNotificationEmail)({
                user: awaitingUser,
                type: "deposit_awaiting_approval",
                message: awaitingMessage,
                email: {
                    sourceId: current.deposit_id,
                    subject: `Deposit verified: ${current.crypto_type}`,
                    heading: "Deposit verified on-chain",
                    preheader: "Your deposit has been verified and is now awaiting platform verification.",
                    details: [
                        { label: "Reference", value: awaitingRef },
                        {
                            label: "Amount",
                            value: `${current.received_amount ?? current.amount} ${current.crypto_type}`
                        },
                        { label: "Asset", value: current.crypto_type },
                        { label: "Confirmations", value: String(current.confirmation_count ?? 0) },
                        { label: "Date", value: new Date().toISOString() }
                    ],
                    statusLabel: "Awaiting platform verification",
                    statusTone: "gold",
                    ctaLabel: "View deposit",
                    ctaPath: "/deposit"
                }
            });
        }
        return current;
    }
    if (verification.stage === "insufficient_confirmations") {
        current.tx_hash = verification.txHash;
        current.received_amount = verification.amount;
        current.confirmation_count = verification.confirmations;
        current.network = verification.network || current.network;
        current.deposit_wallet = verification.toAddress || current.deposit_wallet;
        current.detected_at = current.detected_at ?? now;
        current.detailed_status = verification.confirmations > 0 ? "CONFIRMING" : "DETECTED";
        current.status = (0, depositStatus_1.coarseStatusForDepositDetailed)(current.detailed_status);
    }
    else if (exports.RETRYABLE_PROVIDER_STAGES.includes(verification.stage)) {
        // The provider could not answer, so we learned nothing about the transfer:
        // keep the deposit PENDING but remember the hash the user submitted, so the
        // rescan / approval path can retry the exact same lookup later instead of
        // asking the depositor to paste it again.
        current.tx_hash = verification.txHash;
    }
    await current.save();
    return current;
}
/**
 * Move a pending deposit into the administrator review queue.
 *
 * The status transition happens inside a row-locked transaction, so the monitor
 * and a user-submitted hash cannot both advance the same deposit, and the
 * exactly-once approval guard later cannot observe a half-updated row.
 */
async function recordVerifiedPayment(depositId, evidence) {
    return database_1.sequelize.transaction(async (transaction) => {
        const deposit = await Deposit_1.Deposit.findByPk(depositId, {
            transaction,
            lock: sequelize_1.Transaction.LOCK.UPDATE
        });
        if (!deposit) {
            return null;
        }
        if (exports.CLOSED_DEPOSIT_STATUSES.includes(detailedStatusOf(deposit))) {
            return deposit;
        }
        if (detailedStatusOf(deposit) === "AWAITING_ADMIN_APPROVAL") {
            return deposit;
        }
        const now = new Date();
        deposit.tx_hash = evidence.txHash;
        deposit.received_amount = evidence.amount;
        deposit.confirmation_count = evidence.confirmations;
        deposit.verification_result = evidence;
        deposit.network = evidence.network || deposit.network;
        deposit.deposit_wallet = evidence.toAddress || deposit.deposit_wallet;
        deposit.detected_at = deposit.detected_at ?? now;
        deposit.verified_at = now;
        deposit.detailed_status = "AWAITING_ADMIN_APPROVAL";
        deposit.status = (0, depositStatus_1.coarseStatusForDepositDetailed)("AWAITING_ADMIN_APPROVAL");
        await deposit.save({ transaction });
        return deposit;
    });
}
/**
 * Two requests can race past the reuse pre-check and try to attach the same
 * transaction hash at the same moment. The database's partial unique index on
 * `deposits(tx_hash)` is the final authority in that case, so a constraint
 * violation is translated into the same clean 409 the pre-check would have
 * produced.
 */
function transactionAlreadyUsedError() {
    return new DepositCreationError(409, "TRANSACTION_ALREADY_USED", "This transaction hash has already been submitted for another deposit. Each on-chain transaction can only be used once.");
}
/**
 * Attach a transaction hash to a pending deposit and verify it independently.
 *
 * The hash is only ever a *pointer*: the amount, receiving address and
 * confirmation count are all re-read from the chain. A hash that is already
 * attached to another deposit is rejected so one on-chain transaction can never
 * fund two deposits. A successful verification moves the deposit to
 * AWAITING_ADMIN_APPROVAL — it never credits the wallet.
 */
async function submitDepositTransactionHash(input) {
    const deposit = await findUserDepositByReference(input.userId, input.reference);
    if (!deposit) {
        throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "We could not find that deposit.");
    }
    const submittedHash = typeof input.txHash === "string" ? input.txHash.trim() : "";
    if (submittedHash.length < 8 || submittedHash.length > 200) {
        throw new DepositCreationError(400, "INVALID_TX_HASH", "Enter the full blockchain transaction hash (8–200 characters).");
    }
    const detailed = detailedStatusOf(deposit);
    if (detailed === "COMPLETED") {
        return {
            deposit,
            instructions: requireInstructions(deposit),
            verification: null,
            message: "This deposit has already been approved and credited."
        };
    }
    if (detailed === "REJECTED" || detailed === "EXPIRED" || detailed === "FAILED") {
        throw new DepositCreationError(409, "DEPOSIT_CLOSED", "This deposit request is closed. Create a new deposit request to send funds.", { reference: deposit.reference, status: detailed });
    }
    if (detailed === "AWAITING_ADMIN_APPROVAL") {
        return {
            deposit,
            instructions: requireInstructions(deposit),
            verification: null,
            message: "We've verified your transaction on the blockchain. It is now awaiting platform verification."
        };
    }
    if (!(0, depositRules_1.isSupportedDepositCryptoType)(deposit.crypto_type)) {
        throw new DepositCreationError(409, "UNSUPPORTED_ASSET", "This deposit used an asset the platform no longer supports. Contact support.");
    }
    // A hash that cannot belong to this network is a caller mistake, so it is
    // rejected here with a specific explanation rather than being sent to a
    // provider and reported back as "the provider is unreachable". The canonical
    // form is used for the duplicate check, the verification and the stored value.
    const txHash = (0, blockchainVerificationService_1.normalizeTransactionHash)(deposit.crypto_type, submittedHash);
    if (!txHash) {
        throw new DepositCreationError(400, "INVALID_TX_HASH", blockchainVerificationService_1.INVALID_TX_HASH_REASON[deposit.crypto_type]);
    }
    const reused = await Deposit_1.Deposit.findOne({
        where: { tx_hash: txHash, deposit_id: { [sequelize_1.Op.ne]: deposit.deposit_id } }
    });
    if (reused) {
        throw new DepositCreationError(409, "TRANSACTION_ALREADY_USED", "This transaction hash has already been submitted for another deposit. Each on-chain transaction can only be used once.", { reference: deposit.reference, conflictingDeposit: reused.deposit_id });
    }
    const verification = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: deposit.crypto_type,
        txHash,
        expectedAmount: Number(deposit.amount)
    });
    let updated;
    try {
        if (verification.stage === "verified") {
            updated = (await recordVerifiedPayment(deposit.deposit_id, verification)) ?? deposit;
        }
        else {
            updated = await applyVerificationResult(deposit, verification);
        }
    }
    catch (error) {
        if (error instanceof sequelize_1.UniqueConstraintError) {
            throw transactionAlreadyUsedError();
        }
        throw error;
    }
    await (0, activityService_1.trackUserActivity)(deposit.user_id, "deposit_submitted", {
        deposit_id: deposit.deposit_id,
        reference: deposit.reference,
        tx_hash: verification.txHash,
        stage: verification.stage,
        confirmations: verification.confirmations
    });
    let message;
    switch (verification.stage) {
        case "verified":
            message =
                "We've verified your transaction on the blockchain. It is now awaiting platform verification.";
            break;
        case "insufficient_confirmations":
            message = "We've detected your transaction and are checking its confirmations.";
            break;
        case "not_found":
            message =
                "We could not find this transaction on the selected network yet. It can take a few minutes to propagate — try again shortly.";
            break;
        case "mismatch":
            message =
                verification.failureReason ||
                    "This transaction does not match the asset, network, receiving address or amount for this deposit.";
            break;
        case "invalid_hash":
            message = verification.failureReason || blockchainVerificationService_1.INVALID_TX_HASH_REASON[deposit.crypto_type];
            break;
        case "provider_unavailable":
            // The chain was never asked, so nothing is wrong with the transfer: the
            // hash is kept and the same check can be retried once the provider is back.
            message =
                "We could not reach the blockchain provider to check this transaction right now. Your transaction hash has been saved and we will keep retrying — no action is needed.";
            break;
        case "provider_error":
            // A persistent provider misconfiguration. Kept distinct from a bad
            // transaction so it is never mistaken for a failed or invalid transfer.
            message =
                "We could not complete the blockchain check for this transaction. Your transaction hash has been saved and will be reconciled through our platform review process.";
            break;
        default:
            message =
                verification.failureReason ||
                    "We could not verify this transaction right now. Your deposit stays pending and will be reconciled through our platform review process.";
            break;
    }
    return {
        deposit: updated,
        instructions: requireInstructions(updated),
        verification,
        message
    };
}
/**
 * Approve a verified deposit and credit the wallet exactly once.
 *
 * Approval always re-verifies the transaction on the correct chain first: an
 * administrator cannot approve something the chain does not confirm. The status
 * flip is guarded by a row lock, so two simultaneous approvals cannot both
 * credit, and every wallet-side effect is idempotent on top of that.
 */
async function approveDeposit(adminId, depositId, reason) {
    const existing = await Deposit_1.Deposit.findByPk(depositId);
    if (!existing) {
        throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "That deposit does not exist.");
    }
    const detailed = detailedStatusOf(existing);
    if (detailed === "COMPLETED") {
        return { deposit: existing, credited: false };
    }
    if (detailed === "REJECTED") {
        throw new DepositCreationError(409, "DEPOSIT_REJECTED", "A rejected deposit cannot be approved through this action. Use the controlled reconsideration process so the audit trail stays intact.");
    }
    if (detailed === "EXPIRED" || detailed === "FAILED") {
        throw new DepositCreationError(409, "DEPOSIT_CLOSED", `This deposit is ${detailed.toLowerCase()} and can no longer be approved.`, { reference: existing.reference });
    }
    if (!existing.tx_hash) {
        throw new DepositCreationError(409, "NO_TRANSACTION", "This deposit has no transaction hash to verify. Record the on-chain transaction hash (or search the chain) before approving.");
    }
    if (!(0, depositRules_1.isSupportedDepositCryptoType)(existing.crypto_type)) {
        throw new DepositCreationError(409, "UNSUPPORTED_ASSET", "This deposit uses an asset the platform cannot verify automatically.");
    }
    const reused = await Deposit_1.Deposit.findOne({
        where: { tx_hash: existing.tx_hash, deposit_id: { [sequelize_1.Op.ne]: existing.deposit_id } }
    });
    if (reused) {
        throw new DepositCreationError(409, "TRANSACTION_ALREADY_USED", "This transaction hash is already attached to another deposit and cannot be credited twice.", { conflictingDeposit: reused.deposit_id });
    }
    const verification = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: existing.crypto_type,
        txHash: existing.tx_hash,
        expectedAmount: Number(existing.amount)
    });
    if (!verification.success) {
        throw new DepositCreationError(409, "VERIFICATION_FAILED", verification.failureReason ||
            "The transaction could not be verified on-chain, so this deposit cannot be approved.", { stage: verification.stage, reference: existing.reference });
    }
    const auditReason = reason.trim().length > 0
        ? reason.trim()
        : "Deposit approved after independent on-chain verification.";
    // The independently verified on-chain amount is the source of truth for the
    // credit; the originally requested amount is preserved separately. A separate
    // USD figure is recorded best-effort and a price outage never blocks approval.
    const receivedQuantity = verification.amount;
    const usdValuation = await resolveDepositUsdValue(existing.crypto_type, receivedQuantity);
    const outcome = await (async () => {
        try {
            return await database_1.sequelize.transaction(async (transaction) => {
                const deposit = await Deposit_1.Deposit.findByPk(depositId, {
                    transaction,
                    lock: sequelize_1.Transaction.LOCK.UPDATE
                });
                if (!deposit) {
                    throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "That deposit does not exist.");
                }
                if (detailedStatusOf(deposit) === "COMPLETED") {
                    return { deposit, credited: false };
                }
                if (exports.CLOSED_DEPOSIT_STATUSES.includes(detailedStatusOf(deposit))) {
                    throw new DepositCreationError(409, "DEPOSIT_CLOSED", "This deposit can no longer be approved.");
                }
                // Re-check inside the lock so two approvals (or an approval racing the
                // monitor) cannot both bind the same on-chain transaction. The unique
                // index remains the final authority if these still interleave.
                const conflicting = await Deposit_1.Deposit.findOne({
                    where: { tx_hash: verification.txHash, deposit_id: { [sequelize_1.Op.ne]: deposit.deposit_id } },
                    transaction
                });
                if (conflicting) {
                    throw transactionAlreadyUsedError();
                }
                const now = new Date();
                const previous = detailedStatusOf(deposit);
                deposit.tx_hash = verification.txHash;
                deposit.received_amount = verification.amount;
                if (usdValuation.usd !== null) {
                    deposit.usd_amount = Number(usdValuation.usd);
                }
                deposit.confirmation_count = verification.confirmations;
                deposit.verification_result = verification;
                deposit.network = verification.network || deposit.network;
                deposit.deposit_wallet = verification.toAddress || deposit.deposit_wallet;
                deposit.detected_at = deposit.detected_at ?? now;
                deposit.verified_at = now;
                deposit.reviewed_by = adminId;
                deposit.reviewed_at = now;
                deposit.approved_at = now;
                deposit.confirmed_at = now;
                deposit.detailed_status = "COMPLETED";
                deposit.status = (0, depositStatus_1.coarseStatusForDepositDetailed)("COMPLETED");
                await deposit.save({ transaction });
                await AdminAuditLog_1.AdminAuditLog.create({
                    admin_id: adminId,
                    action: "deposit_approved",
                    entity_type: "deposit",
                    entity_id: deposit.deposit_id,
                    reason: auditReason,
                    metadata: {
                        reference: deposit.reference,
                        previous,
                        cryptoType: deposit.crypto_type,
                        network: deposit.network,
                        expectedAmount: Number(deposit.amount),
                        receivedAmount: verification.amount,
                        usdBasis: usdValuation.basis,
                        usdAmount: usdValuation.usd,
                        txHash: verification.txHash,
                        confirmations: verification.confirmations
                    }
                }, { transaction });
                return { deposit, credited: true };
            });
        }
        catch (error) {
            if (error instanceof sequelize_1.UniqueConstraintError) {
                throw transactionAlreadyUsedError();
            }
            throw error;
        }
    })();
    if (outcome.credited) {
        await runApprovedDepositSideEffects(outcome.deposit);
    }
    return outcome;
}
/**
 * The wallet credit runs first and must not be silently skipped; the
 * engagement/reporting steps are best-effort because they are idempotent and
 * can be re-run by the reconciliation endpoint.
 */
async function runApprovedDepositSideEffects(deposit) {
    const amount = Number(deposit.amount);
    await (0, financialOperationsService_1.recordConfirmedDeposit)(deposit);
    await Notification_1.Notification.create({
        type: "deposit_approved",
        message: `Deposit ${deposit.reference ?? deposit.deposit_id} was approved and credited to your wallet.`,
        user_id: deposit.user_id
    });
    const user = await User_1.User.findByPk(deposit.user_id);
    await (0, activityService_1.trackUserActivity)(deposit.user_id, "deposit_confirmed", {
        deposit_id: deposit.deposit_id,
        reference: deposit.reference,
        amount,
        asset: deposit.crypto_type,
        tx_hash: deposit.tx_hash
    });
    try {
        if (user) {
            await (0, gamificationService_1.applyDepositGamification)(user, deposit, { hasReferralBonus: false });
            await (0, behaviorService_1.recordDepositBehavior)(user, amount);
            (0, socket_1.emitSocialProofDeposit)(deposit, `${user.name.slice(0, 3)}***`);
        }
        await (0, referralService_1.grantReferralRewardsOnApprovedDeposit)(deposit);
    }
    catch (error) {
        console.warn("[deposit] Non-critical approval step failed", JSON.stringify({
            depositId: deposit.deposit_id,
            reference: deposit.reference,
            error: error instanceof Error ? error.message : String(error)
        }));
    }
}
/**
 * Reject a deposit. A reason is mandatory and is surfaced to the user. Nothing
 * is credited, and the row is closed so an ordinary repeated approval request
 * cannot resurrect it.
 */
async function rejectDeposit(adminId, depositId, reason) {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
        throw new DepositCreationError(400, "REASON_REQUIRED", "A rejection reason is required and is recorded in the audit trail.");
    }
    const outcome = await database_1.sequelize.transaction(async (transaction) => {
        const deposit = await Deposit_1.Deposit.findByPk(depositId, {
            transaction,
            lock: sequelize_1.Transaction.LOCK.UPDATE
        });
        if (!deposit) {
            throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "That deposit does not exist.");
        }
        const detailed = detailedStatusOf(deposit);
        if (detailed === "COMPLETED") {
            throw new DepositCreationError(409, "DEPOSIT_COMPLETED", "This deposit has already been credited and cannot be rejected.");
        }
        if (detailed === "REJECTED") {
            return { deposit, rejected: false };
        }
        const now = new Date();
        deposit.rejection_reason = trimmed;
        deposit.reviewed_by = adminId;
        deposit.reviewed_at = now;
        deposit.detailed_status = "REJECTED";
        deposit.status = (0, depositStatus_1.coarseStatusForDepositDetailed)("REJECTED");
        await deposit.save({ transaction });
        await AdminAuditLog_1.AdminAuditLog.create({
            admin_id: adminId,
            action: "deposit_rejected",
            entity_type: "deposit",
            entity_id: deposit.deposit_id,
            reason: trimmed,
            metadata: {
                reference: deposit.reference,
                previous: detailed,
                cryptoType: deposit.crypto_type,
                expectedAmount: Number(deposit.amount),
                txHash: deposit.tx_hash
            }
        }, { transaction });
        return { deposit, rejected: true };
    });
    if (outcome.rejected) {
        const user = await User_1.User.findByPk(outcome.deposit.user_id);
        const rejectedRef = outcome.deposit.reference ?? outcome.deposit.deposit_id;
        const rejectedAmount = Number(outcome.deposit.amount);
        const rejectedMessage = `Deposit ${rejectedRef} was rejected. Reason: ${trimmed}`;
        await Notification_1.Notification.create({
            type: "deposit_rejected",
            message: rejectedMessage,
            user_id: outcome.deposit.user_id
        });
        if (user) {
            await (0, notificationDispatchService_1.dispatchNotificationEmail)({
                user,
                type: "deposit_rejected",
                message: rejectedMessage,
                email: {
                    sourceId: outcome.deposit.deposit_id,
                    subject: `Deposit not approved: ${outcome.deposit.crypto_type}`,
                    heading: "Deposit could not be approved",
                    preheader: "Your deposit could not be approved.",
                    details: [
                        { label: "Reference", value: rejectedRef },
                        { label: "Amount", value: `${rejectedAmount} ${outcome.deposit.crypto_type}` },
                        { label: "Asset", value: outcome.deposit.crypto_type },
                        { label: "Date", value: new Date().toISOString() }
                    ],
                    statusLabel: "Rejected",
                    statusTone: "negative",
                    ctaLabel: "View deposit",
                    ctaPath: "/deposit"
                }
            });
        }
        await (0, activityService_1.trackUserActivity)(outcome.deposit.user_id, "deposit_rejected", {
            deposit_id: outcome.deposit.deposit_id,
            reference: outcome.deposit.reference,
            reason: trimmed
        });
    }
    return outcome;
}
/**
 * Expire requests whose window elapsed without a matching transfer. A deposit
 * that has already received funds (DETECTED/CONFIRMING/AWAITING approval) is
 * never expired, and completed deposits are never touched, so wallet accounting
 * is unaffected.
 */
async function expireStaleDeposits() {
    const now = new Date();
    const expired = await Deposit_1.Deposit.findAll({
        where: {
            detailed_status: { [sequelize_1.Op.in]: exports.UNPAID_DEPOSIT_STATUSES },
            expires_at: { [sequelize_1.Op.ne]: null, [sequelize_1.Op.lt]: now }
        },
        attributes: ["deposit_id", "user_id", "reference", "crypto_type"]
    });
    let count = 0;
    for (const deposit of expired) {
        const [updated] = await Deposit_1.Deposit.update({
            detailed_status: "EXPIRED",
            status: (0, depositStatus_1.coarseStatusForDepositDetailed)("EXPIRED")
        }, {
            where: {
                deposit_id: deposit.deposit_id,
                detailed_status: { [sequelize_1.Op.in]: exports.UNPAID_DEPOSIT_STATUSES }
            }
        });
        if (updated > 0) {
            count += 1;
            const expiredRef = deposit.reference ?? deposit.deposit_id;
            const expiredMessage = `Deposit request ${expiredRef} expired before a matching transfer was detected.`;
            await Notification_1.Notification.create({
                type: "deposit_expired",
                message: expiredMessage,
                user_id: deposit.user_id
            });
            const expiredUser = await User_1.User.findByPk(deposit.user_id);
            if (expiredUser) {
                await (0, notificationDispatchService_1.dispatchNotificationEmail)({
                    user: expiredUser,
                    type: "deposit_expired",
                    message: expiredMessage,
                    email: {
                        sourceId: deposit.deposit_id,
                        subject: `Deposit request expired: ${deposit.crypto_type}`,
                        heading: "Deposit request expired",
                        preheader: "Your deposit request expired before a matching transfer was detected.",
                        details: [
                            { label: "Reference", value: expiredRef },
                            { label: "Asset", value: deposit.crypto_type },
                            { label: "Date", value: new Date().toISOString() }
                        ],
                        statusLabel: "Expired",
                        statusTone: "negative",
                        ctaLabel: "Start a new deposit",
                        ctaPath: "/deposit"
                    }
                });
            }
        }
    }
    return count;
}
async function listActiveDepositsForMonitor(limit = 200) {
    const now = new Date();
    return Deposit_1.Deposit.findAll({
        where: {
            detailed_status: { [sequelize_1.Op.in]: ["PENDING", "DETECTED", "CONFIRMING"] },
            [sequelize_1.Op.or]: [{ expires_at: null }, { expires_at: { [sequelize_1.Op.gt]: now } }]
        },
        order: [["timestamp", "ASC"]],
        limit
    });
}
function capabilityForDeposit(deposit) {
    return (0, depositRules_1.isSupportedDepositCryptoType)(deposit.crypto_type)
        ? (0, depositNetworkCapabilities_1.resolveDepositCapability)(deposit.crypto_type)
        : null;
}
