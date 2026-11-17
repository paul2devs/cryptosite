import { Op, Transaction, UniqueConstraintError } from "sequelize";
import { sequelize } from "../config/database";
import { Deposit } from "../models/Deposit";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import {
  DEPOSIT_DECIMALS_BY_CRYPTO_TYPE,
  DepositCryptoType,
  isSupportedDepositCryptoType,
  validateDepositIntent
} from "../domain/depositRules";
import {
  DepositNetworkCapability,
  resolveDepositCapability,
  validateDepositMemo
} from "../domain/depositNetworkCapabilities";
import {
  DEPOSIT_REFERENCE_BODY_LENGTH,
  generateDepositReference,
  normalizeDepositReference
} from "../domain/depositReference";
import {
  DepositDetailedStatus,
  DepositStatusView,
  coarseStatusForDepositDetailed,
  describeDepositStatus,
  isDepositDetailedStatus
} from "../domain/depositStatus";
import {
  DEPOSIT_MAX_USD,
  DEPOSIT_MIN_USD,
  usdToCryptoAmount,
  validateUsdAmountInput,
  withinConversionTolerance
} from "../domain/depositQuote";
import { applyDepositGamification } from "./gamificationService";
import { recordDepositBehavior } from "./behaviorService";
import { emitSocialProofDeposit } from "../realtime/socket";
import { trackUserActivity } from "./activityService";
import { grantReferralRewardsOnApprovedDeposit } from "./referralService";
import { getPlatformWallet } from "./walletService";
import {
  BlockchainVerificationResult,
  INVALID_TX_HASH_REASON,
  normalizeTransactionHash,
  verifyDepositOnChain
} from "./blockchainVerificationService";
import { buildDepositQuote } from "./depositQuoteService";
import { recordConfirmedDeposit } from "./financialOperationsService";
import { sendDepositStatusEmail } from "./email/emailService";

/** A deposit that has not received a matching transfer yet. */
export const UNPAID_DEPOSIT_STATUSES: DepositDetailedStatus[] = ["PENDING"];

/** A deposit that still requires attention (payment, confirmations or review). */
export const OPEN_DEPOSIT_STATUSES: DepositDetailedStatus[] = [
  "PENDING",
  "DETECTED",
  "CONFIRMING",
  "AWAITING_ADMIN_APPROVAL"
];

/** Terminal states never accept a new payment and never change again. */
export const CLOSED_DEPOSIT_STATUSES: DepositDetailedStatus[] = [
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
export const RETRYABLE_PROVIDER_STAGES: BlockchainVerificationResult["stage"][] = [
  "provider_unavailable",
  "provider_error"
];

const DEFAULT_EXPIRY_HOURS = 24;
const DEFAULT_DUPLICATE_WINDOW_SECONDS = 60;
const REFERENCE_ATTEMPTS = 6;

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || String(raw).trim().length === 0) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function depositExpiryHours(): number {
  return readPositiveNumberEnv("DEPOSIT_EXPIRY_HOURS", DEFAULT_EXPIRY_HOURS);
}

function duplicateWindowSeconds(): number {
  return readPositiveNumberEnv(
    "DEPOSIT_DUPLICATE_WINDOW_SECONDS",
    DEFAULT_DUPLICATE_WINDOW_SECONDS
  );
}

/**
 * A failure the controller can translate into a clean HTTP response. The
 * `diagnostics` payload is logged internally and never returned verbatim to the
 * user, so internal causes stay visible to operators while the user sees one
 * actionable sentence.
 */
export class DepositCreationError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly diagnostics: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    diagnostics: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "DepositCreationError";
    this.statusCode = statusCode;
    this.code = code;
    this.diagnostics = diagnostics;
  }
}

export interface DepositPaymentInstructions {
  reference: string;
  depositId: string;
  cryptoType: DepositCryptoType;
  platformAsset: string;
  symbol: string;
  networkLabel: string;
  networkType: string;
  receivingAddress: string;
  amountToSend: number;
  amountToSendLabel: string;
  usdAmount: number | null;
  memo: string | null;
  memoLabel: string | null;
  memoRequired: boolean;
  memoGuidance: string | null;
  memoSupported: boolean;
  minConfirmations: number;
  sendingInstruction: string;
  networkWarning: string;
  status: {
    detailed: DepositDetailedStatus;
    coarse: string;
    label: string;
    tone: string;
    message: string;
  };
  transactionHash: string | null;
  receivedAmount: number | null;
  confirmations: number;
  detectedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  approvalRequired: boolean;
  rejectionReason: string | null;
}

export interface DepositCreationDiagnostics {
  reference: string;
  cryptoType: DepositCryptoType;
  networkLabel: string;
  rateVerified: boolean;
  rateSource: string | null;
  rateReason: string | null;
  amountSource: "client" | "server-rate";
  reusedExisting: boolean;
  internalNotes: string[];
}

export interface DepositCreationOutcome {
  deposit: Deposit;
  instructions: DepositPaymentInstructions;
  diagnostics: DepositCreationDiagnostics;
}

export interface DepositCreationRequest {
  userId: string;
  cryptoType: unknown;
  cryptoAmount?: unknown;
  usdAmount?: unknown;
  memo?: unknown;
  idempotencyKey?: string | null;
}

function trimNumberLabel(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

export function detailedStatusOf(deposit: Deposit): DepositDetailedStatus {
  const stored = deposit.detailed_status;
  if (isDepositDetailedStatus(stored)) {
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

export function statusViewOf(
  deposit: Deposit
): DepositStatusView & { detailed: DepositDetailedStatus } {
  const detailed = detailedStatusOf(deposit);
  return { ...describeDepositStatus(detailed), detailed };
}

function openStatusWhere() {
  return { [Op.in]: OPEN_DEPOSIT_STATUSES };
}

/**
 * Build the payment instructions shown to the user after a deposit request
 * exists. Returns null when the asset has no configured receiving address, so
 * the caller can report an unavailable deposit method instead of showing a
 * broken address.
 */
export function buildDepositInstructions(deposit: Deposit): DepositPaymentInstructions | null {
  const cryptoType = deposit.crypto_type;
  if (!isSupportedDepositCryptoType(cryptoType)) {
    return null;
  }
  const capability = resolveDepositCapability(cryptoType);
  const wallet = getPlatformWallet(capability.platformAsset);
  if (!wallet) {
    return null;
  }

  const detailed = detailedStatusOf(deposit);
  const view = describeDepositStatus(detailed);
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
    usdAmount:
      deposit.usd_amount === null || deposit.usd_amount === undefined
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
    receivedAmount:
      deposit.received_amount === null || deposit.received_amount === undefined
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

function requireInstructions(deposit: Deposit): DepositPaymentInstructions {
  const instructions = buildDepositInstructions(deposit);
  if (!instructions) {
    throw new DepositCreationError(
      500,
      "INSTRUCTIONS_UNAVAILABLE",
      "We could not build payment instructions for this deposit. Please contact support.",
      { depositId: deposit.deposit_id, cryptoType: deposit.crypto_type }
    );
  }
  return instructions;
}

async function pickExistingForIdempotency(
  userId: string,
  idempotencyKey: string
): Promise<Deposit | null> {
  return Deposit.findOne({
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
export async function createDepositRequest(
  request: DepositCreationRequest
): Promise<DepositCreationOutcome> {
  const cryptoType = request.cryptoType;
  if (!isSupportedDepositCryptoType(cryptoType)) {
    throw new DepositCreationError(
      400,
      "UNSUPPORTED_ASSET",
      "Select a supported asset and network before creating a deposit."
    );
  }

  const capability = resolveDepositCapability(cryptoType);
  const wallet = getPlatformWallet(capability.platformAsset);
  if (!wallet) {
    throw new DepositCreationError(
      503,
      "DEPOSIT_METHOD_UNAVAILABLE",
      `${capability.networkLabel} deposits are not available right now. Choose a different asset or network, or contact support.`,
      { cryptoType, missingAddressFor: capability.platformAsset }
    );
  }

  const user = await User.findByPk(request.userId);
  if (!user) {
    throw new DepositCreationError(404, "USER_NOT_FOUND", "We could not find your account.");
  }

  const intent = validateDepositIntent({
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
    const usdCheck = validateUsdAmountInput(String(intent.numericUsdAmount));
    if (!usdCheck.valid && usdCheck.message) {
      throw new DepositCreationError(400, "INVALID_USD_AMOUNT", usdCheck.message, {
        minUsd: DEPOSIT_MIN_USD,
        maxUsd: DEPOSIT_MAX_USD
      });
    }
  }

  const memoValidation = validateDepositMemo(capability, request.memo);
  if (!memoValidation.valid && memoValidation.error) {
    throw new DepositCreationError(400, "INVALID_MEMO", memoValidation.error, { cryptoType });
  }

  const internalNotes: string[] = [];
  let resolvedCryptoAmount = intent.numericCryptoAmount;
  let amountSource: DepositCreationDiagnostics["amountSource"] =
    resolvedCryptoAmount !== null ? "client" : "server-rate";
  let rateVerified = false;
  let rateSource: string | null = null;
  let rateReason: string | null = null;
  let quoteAvailable = false;
  let quoteRate: number | null = null;

  try {
    const quote = await buildDepositQuote({ cryptoType });
    quoteAvailable = quote.available && quote.rate !== null;
    quoteRate = quote.rate;
    if (quoteAvailable) {
      rateSource = quote.rateSource;
    } else {
      rateReason = quote.reason || "Current conversion pricing is temporarily unavailable.";
      internalNotes.push("market_data_unavailable");
    }
  } catch (error) {
    rateReason = "Current conversion pricing is temporarily unavailable.";
    internalNotes.push(
      `market_data_error:${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (quoteAvailable && quoteRate !== null) {
    if (intent.numericUsdAmount !== null) {
      const expected = usdToCryptoAmount(
        intent.numericUsdAmount,
        quoteRate,
        DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType]
      );
      if (expected === null) {
        throw new DepositCreationError(
          400,
          "AMOUNT_TOO_SMALL",
          "The deposit amount is too small to convert to the selected asset."
        );
      }
      if (resolvedCryptoAmount === null) {
        resolvedCryptoAmount = expected;
      } else if (!withinConversionTolerance(resolvedCryptoAmount, expected)) {
        throw new DepositCreationError(
          409,
          "RATE_CHANGED",
          "The submitted amount no longer matches the current exchange rate. Refresh the rate and try again.",
          { submitted: resolvedCryptoAmount, expectedFromRate: expected }
        );
      }
      rateVerified = true;
    } else if (resolvedCryptoAmount !== null) {
      rateVerified = true;
    }
  }

  if (!rateVerified && resolvedCryptoAmount === null) {
    throw new DepositCreationError(
      409,
      "RATE_UNAVAILABLE",
      "We cannot fix the exact amount to send until a live rate is available. Refresh the rate and try again.",
      { cryptoType, rateReason }
    );
  }

  if (resolvedCryptoAmount === null) {
    throw new DepositCreationError(400, "INVALID_INTENT", "Enter a deposit amount.");
  }

  const numericCryptoAmount = resolvedCryptoAmount;
  const numericUsdAmount = intent.numericUsdAmount;

  const idempotencyKey =
    typeof request.idempotencyKey === "string" && request.idempotencyKey.trim().length > 0
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
  } else {
    // No idempotency key was supplied (older clients / direct API use): collapse
    // the double-click case by returning an identical, still-unpaid request made
    // inside the duplicate window instead of inserting a second row.
    const since = new Date(Date.now() - duplicateWindowSeconds() * 1000);
    const duplicate = await Deposit.findOne({
      where: {
        user_id: request.userId,
        crypto_type: cryptoType,
        amount: numericCryptoAmount,
        detailed_status: { [Op.in]: UNPAID_DEPOSIT_STATUSES },
        timestamp: { [Op.gte]: since }
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

  let created: Deposit | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS && created === null; attempt += 1) {
    const reference = generateDepositReference();
    try {
      created = await sequelize.transaction(async (transaction) =>
        Deposit.create(
          {
            user_id: request.userId,
            crypto_type: cryptoType,
            amount: numericCryptoAmount,
            usd_amount: numericUsdAmount,
            network: capability.networkType,
            deposit_wallet: wallet.address,
            memo: memoValidation.memo,
            memo_label: memoValidation.memo ? capability.memo.label : null,
            memo_required: memoValidation.memo ? Boolean(capability.memo.required) : false,
            status: coarseStatusForDepositDetailed("PENDING"),
            detailed_status: "PENDING",
            reference,
            idempotency_key: idempotencyKey,
            expires_at: expiresAt,
            confirmation_count: 0
          },
          { transaction }
        )
      );
    } catch (error) {
      lastError = error;
      if (!(error instanceof UniqueConstraintError)) {
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
    throw new DepositCreationError(
      503,
      "REFERENCE_EXHAUSTED",
      "We could not allocate a deposit reference right now. Please try again.",
      { referenceBodyLength: DEPOSIT_REFERENCE_BODY_LENGTH, lastError: String(lastError) }
    );
  }

  await trackUserActivity(request.userId, "deposit", {
    deposit_id: created.deposit_id,
    reference: created.reference,
    amount: numericCryptoAmount,
    usd_amount: numericUsdAmount,
    crypto_type: cryptoType
  });

  await Notification.create({
    type: "deposit_created",
    message: `Deposit request ${created.reference} created. Send exactly ${trimNumberLabel(
      numericCryptoAmount,
      capability.decimals
    )} ${capability.symbol} on the ${capability.networkLabel} network. Admin approval is required before your wallet is credited.`,
    user_id: request.userId
  });

  sendDepositStatusEmail({
    to: user.email,
    name: user.name,
    status: "Pending",
    amount: numericCryptoAmount,
    asset: cryptoType
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

export async function findUserDepositByReference(
  userId: string,
  reference: unknown
): Promise<Deposit | null> {
  const normalized = normalizeDepositReference(reference);
  if (!normalized) {
    return null;
  }
  return Deposit.findOne({ where: { user_id: userId, reference: normalized } });
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
export async function applyVerificationResult(
  deposit: Deposit,
  verification: BlockchainVerificationResult
): Promise<Deposit> {
  const current = await Deposit.findByPk(deposit.deposit_id);
  if (!current) {
    return deposit;
  }
  const detailed = detailedStatusOf(current);
  if (CLOSED_DEPOSIT_STATUSES.includes(detailed)) {
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
    current.status = coarseStatusForDepositDetailed("AWAITING_ADMIN_APPROVAL");
    await current.save();

    await Notification.create({
      type: "deposit_awaiting_approval",
      message: `Deposit ${current.reference ?? current.deposit_id} was verified on-chain and is awaiting administrator approval.`,
      user_id: current.user_id
    });

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
    current.status = coarseStatusForDepositDetailed(current.detailed_status);
  } else if (RETRYABLE_PROVIDER_STAGES.includes(verification.stage)) {
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
export async function recordVerifiedPayment(
  depositId: string,
  evidence: BlockchainVerificationResult
): Promise<Deposit | null> {
  return sequelize.transaction(async (transaction) => {
    const deposit = await Deposit.findByPk(depositId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });
    if (!deposit) {
      return null;
    }
    if (CLOSED_DEPOSIT_STATUSES.includes(detailedStatusOf(deposit))) {
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
    deposit.status = coarseStatusForDepositDetailed("AWAITING_ADMIN_APPROVAL");
    await deposit.save({ transaction });

    return deposit;
  });
}

export interface DepositSubmissionResult {
  deposit: Deposit;
  instructions: DepositPaymentInstructions;
  verification: BlockchainVerificationResult | null;
  /** Clean, user-facing explanation of the current state. */
  message: string;
}

/**
 * Two requests can race past the reuse pre-check and try to attach the same
 * transaction hash at the same moment. The database's partial unique index on
 * `deposits(tx_hash)` is the final authority in that case, so a constraint
 * violation is translated into the same clean 409 the pre-check would have
 * produced.
 */
function transactionAlreadyUsedError(): DepositCreationError {
  return new DepositCreationError(
    409,
    "TRANSACTION_ALREADY_USED",
    "This transaction hash has already been submitted for another deposit. Each on-chain transaction can only be used once."
  );
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
export async function submitDepositTransactionHash(input: {
  userId: string;
  reference: unknown;
  txHash: unknown;
}): Promise<DepositSubmissionResult> {
  const deposit = await findUserDepositByReference(input.userId, input.reference);
  if (!deposit) {
    throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "We could not find that deposit.");
  }

  const submittedHash = typeof input.txHash === "string" ? input.txHash.trim() : "";
  if (submittedHash.length < 8 || submittedHash.length > 200) {
    throw new DepositCreationError(
      400,
      "INVALID_TX_HASH",
      "Enter the full blockchain transaction hash (8–200 characters)."
    );
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
    throw new DepositCreationError(
      409,
      "DEPOSIT_CLOSED",
      "This deposit request is closed. Create a new deposit request to send funds.",
      { reference: deposit.reference, status: detailed }
    );
  }
  if (detailed === "AWAITING_ADMIN_APPROVAL") {
    return {
      deposit,
      instructions: requireInstructions(deposit),
      verification: null,
      message:
        "We've verified your transaction on the blockchain. It is now awaiting administrator approval."
    };
  }

  if (!isSupportedDepositCryptoType(deposit.crypto_type)) {
    throw new DepositCreationError(
      409,
      "UNSUPPORTED_ASSET",
      "This deposit used an asset the platform no longer supports. Contact support."
    );
  }

  // A hash that cannot belong to this network is a caller mistake, so it is
  // rejected here with a specific explanation rather than being sent to a
  // provider and reported back as "the provider is unreachable". The canonical
  // form is used for the duplicate check, the verification and the stored value.
  const txHash = normalizeTransactionHash(deposit.crypto_type, submittedHash);
  if (!txHash) {
    throw new DepositCreationError(
      400,
      "INVALID_TX_HASH",
      INVALID_TX_HASH_REASON[deposit.crypto_type]
    );
  }

  const reused = await Deposit.findOne({
    where: { tx_hash: txHash, deposit_id: { [Op.ne]: deposit.deposit_id } }
  });
  if (reused) {
    throw new DepositCreationError(
      409,
      "TRANSACTION_ALREADY_USED",
      "This transaction hash has already been submitted for another deposit. Each on-chain transaction can only be used once.",
      { reference: deposit.reference, conflictingDeposit: reused.deposit_id }
    );
  }

  const verification = await verifyDepositOnChain({
    cryptoType: deposit.crypto_type,
    txHash,
    expectedAmount: Number(deposit.amount)
  });

  let updated: Deposit;
  try {
    if (verification.stage === "verified") {
      updated = (await recordVerifiedPayment(deposit.deposit_id, verification)) ?? deposit;
    } else {
      updated = await applyVerificationResult(deposit, verification);
    }
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw transactionAlreadyUsedError();
    }
    throw error;
  }

  await trackUserActivity(deposit.user_id, "deposit_submitted", {
    deposit_id: deposit.deposit_id,
    reference: deposit.reference,
    tx_hash: verification.txHash,
    stage: verification.stage,
    confirmations: verification.confirmations
  });

  let message: string;
  switch (verification.stage) {
    case "verified":
      message =
        "We've verified your transaction on the blockchain. It is now awaiting administrator approval.";
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
      message = verification.failureReason || INVALID_TX_HASH_REASON[deposit.crypto_type];
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
        "We could not complete the blockchain check for this transaction. Your transaction hash has been saved and an administrator will reconcile it.";
      break;
    default:
      message =
        verification.failureReason ||
        "We could not verify this transaction right now. Your deposit stays pending and will be reconciled by an administrator.";
      break;
  }

  return {
    deposit: updated,
    instructions: requireInstructions(updated),
    verification,
    message
  };
}

export interface DepositApprovalOutcome {
  deposit: Deposit;
  credited: boolean;
}

/**
 * Approve a verified deposit and credit the wallet exactly once.
 *
 * Approval always re-verifies the transaction on the correct chain first: an
 * administrator cannot approve something the chain does not confirm. The status
 * flip is guarded by a row lock, so two simultaneous approvals cannot both
 * credit, and every wallet-side effect is idempotent on top of that.
 */
export async function approveDeposit(
  adminId: string,
  depositId: string,
  reason: string
): Promise<DepositApprovalOutcome> {
  const existing = await Deposit.findByPk(depositId);
  if (!existing) {
    throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "That deposit does not exist.");
  }

  const detailed = detailedStatusOf(existing);
  if (detailed === "COMPLETED") {
    return { deposit: existing, credited: false };
  }
  if (detailed === "REJECTED") {
    throw new DepositCreationError(
      409,
      "DEPOSIT_REJECTED",
      "A rejected deposit cannot be approved through this action. Use the controlled reconsideration process so the audit trail stays intact."
    );
  }
  if (detailed === "EXPIRED" || detailed === "FAILED") {
    throw new DepositCreationError(
      409,
      "DEPOSIT_CLOSED",
      `This deposit is ${detailed.toLowerCase()} and can no longer be approved.`,
      { reference: existing.reference }
    );
  }
  if (!existing.tx_hash) {
    throw new DepositCreationError(
      409,
      "NO_TRANSACTION",
      "This deposit has no transaction hash to verify. Record the on-chain transaction hash (or search the chain) before approving."
    );
  }
  if (!isSupportedDepositCryptoType(existing.crypto_type)) {
    throw new DepositCreationError(
      409,
      "UNSUPPORTED_ASSET",
      "This deposit uses an asset the platform cannot verify automatically."
    );
  }

  const reused = await Deposit.findOne({
    where: { tx_hash: existing.tx_hash, deposit_id: { [Op.ne]: existing.deposit_id } }
  });
  if (reused) {
    throw new DepositCreationError(
      409,
      "TRANSACTION_ALREADY_USED",
      "This transaction hash is already attached to another deposit and cannot be credited twice.",
      { conflictingDeposit: reused.deposit_id }
    );
  }

  const verification = await verifyDepositOnChain({
    cryptoType: existing.crypto_type,
    txHash: existing.tx_hash,
    expectedAmount: Number(existing.amount)
  });

  if (!verification.success) {
    throw new DepositCreationError(
      409,
      "VERIFICATION_FAILED",
      verification.failureReason ||
        "The transaction could not be verified on-chain, so this deposit cannot be approved.",
      { stage: verification.stage, reference: existing.reference }
    );
  }

  const auditReason =
    reason.trim().length > 0
      ? reason.trim()
      : "Deposit approved after independent on-chain verification.";

  const outcome = await (async () => {
    try {
      return await sequelize.transaction(async (transaction) => {
        const deposit = await Deposit.findByPk(depositId, {
          transaction,
          lock: Transaction.LOCK.UPDATE
        });
        if (!deposit) {
          throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "That deposit does not exist.");
        }
        if (detailedStatusOf(deposit) === "COMPLETED") {
          return { deposit, credited: false } as DepositApprovalOutcome;
        }
        if (CLOSED_DEPOSIT_STATUSES.includes(detailedStatusOf(deposit))) {
          throw new DepositCreationError(
            409,
            "DEPOSIT_CLOSED",
            "This deposit can no longer be approved."
          );
        }

        // Re-check inside the lock so two approvals (or an approval racing the
        // monitor) cannot both bind the same on-chain transaction. The unique
        // index remains the final authority if these still interleave.
        const conflicting = await Deposit.findOne({
          where: { tx_hash: verification.txHash, deposit_id: { [Op.ne]: deposit.deposit_id } },
          transaction
        });
        if (conflicting) {
          throw transactionAlreadyUsedError();
        }

        const now = new Date();
        const previous = detailedStatusOf(deposit);
        deposit.tx_hash = verification.txHash;
        deposit.received_amount = verification.amount;
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
        deposit.status = coarseStatusForDepositDetailed("COMPLETED");
        await deposit.save({ transaction });

        await AdminAuditLog.create(
          {
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
              txHash: verification.txHash,
              confirmations: verification.confirmations
            }
          },
          { transaction }
        );

        return { deposit, credited: true } as DepositApprovalOutcome;
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
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
async function runApprovedDepositSideEffects(deposit: Deposit): Promise<void> {
  const amount = Number(deposit.amount);
  await recordConfirmedDeposit(deposit);

  await Notification.create({
    type: "deposit_approved",
    message: `Deposit ${deposit.reference ?? deposit.deposit_id} was approved and credited to your wallet.`,
    user_id: deposit.user_id
  });

  const user = await User.findByPk(deposit.user_id);
  if (user) {
    sendDepositStatusEmail({
      to: user.email,
      name: user.name,
      status: "Approved",
      amount,
      asset: deposit.crypto_type
    });
  }

  await trackUserActivity(deposit.user_id, "deposit_confirmed", {
    deposit_id: deposit.deposit_id,
    reference: deposit.reference,
    amount,
    asset: deposit.crypto_type,
    tx_hash: deposit.tx_hash
  });

  try {
    if (user) {
      await applyDepositGamification(user, deposit, { hasReferralBonus: false });
      await recordDepositBehavior(user, amount);
      emitSocialProofDeposit(deposit, `${user.name.slice(0, 3)}***`);
    }
    await grantReferralRewardsOnApprovedDeposit(deposit);
  } catch (error) {
    console.warn(
      "[deposit] Non-critical approval step failed",
      JSON.stringify({
        depositId: deposit.deposit_id,
        reference: deposit.reference,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }
}

export interface DepositRejectionOutcome {
  deposit: Deposit;
  rejected: boolean;
}

/**
 * Reject a deposit. A reason is mandatory and is surfaced to the user. Nothing
 * is credited, and the row is closed so an ordinary repeated approval request
 * cannot resurrect it.
 */
export async function rejectDeposit(
  adminId: string,
  depositId: string,
  reason: string
): Promise<DepositRejectionOutcome> {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new DepositCreationError(
      400,
      "REASON_REQUIRED",
      "A rejection reason is required and is recorded in the audit trail."
    );
  }

  const outcome = await sequelize.transaction(async (transaction) => {
    const deposit = await Deposit.findByPk(depositId, {
      transaction,
      lock: Transaction.LOCK.UPDATE
    });
    if (!deposit) {
      throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "That deposit does not exist.");
    }
    const detailed = detailedStatusOf(deposit);
    if (detailed === "COMPLETED") {
      throw new DepositCreationError(
        409,
        "DEPOSIT_COMPLETED",
        "This deposit has already been credited and cannot be rejected."
      );
    }
    if (detailed === "REJECTED") {
      return { deposit, rejected: false } as DepositRejectionOutcome;
    }

    const now = new Date();
    deposit.rejection_reason = trimmed;
    deposit.reviewed_by = adminId;
    deposit.reviewed_at = now;
    deposit.detailed_status = "REJECTED";
    deposit.status = coarseStatusForDepositDetailed("REJECTED");
    await deposit.save({ transaction });

    await AdminAuditLog.create(
      {
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
      },
      { transaction }
    );

    return { deposit, rejected: true } as DepositRejectionOutcome;
  });

  if (outcome.rejected) {
    const user = await User.findByPk(outcome.deposit.user_id);
    await Notification.create({
      type: "deposit_rejected",
      message: `Deposit ${outcome.deposit.reference ?? outcome.deposit.deposit_id} was rejected. Reason: ${trimmed}`,
      user_id: outcome.deposit.user_id
    });
    if (user) {
      sendDepositStatusEmail({
        to: user.email,
        name: user.name,
        status: "Rejected",
        amount: Number(outcome.deposit.amount),
        asset: outcome.deposit.crypto_type
      });
    }
    await trackUserActivity(outcome.deposit.user_id, "deposit_rejected", {
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
export async function expireStaleDeposits(): Promise<number> {
  const now = new Date();
  const expired = await Deposit.findAll({
    where: {
      detailed_status: { [Op.in]: UNPAID_DEPOSIT_STATUSES },
      expires_at: { [Op.ne]: null, [Op.lt]: now }
    },
    attributes: ["deposit_id", "user_id", "reference", "crypto_type"]
  });

  let count = 0;
  for (const deposit of expired) {
    const [updated] = await Deposit.update(
      {
        detailed_status: "EXPIRED",
        status: coarseStatusForDepositDetailed("EXPIRED")
      },
      {
        where: {
          deposit_id: deposit.deposit_id,
          detailed_status: { [Op.in]: UNPAID_DEPOSIT_STATUSES }
        }
      }
    );
    if (updated > 0) {
      count += 1;
      await Notification.create({
        type: "deposit_expired",
        message: `Deposit request ${deposit.reference ?? deposit.deposit_id} expired before a matching transfer was detected.`,
        user_id: deposit.user_id
      });
    }
  }

  return count;
}

export async function listActiveDepositsForMonitor(limit = 200): Promise<Deposit[]> {
  const now = new Date();
  return Deposit.findAll({
    where: {
      detailed_status: { [Op.in]: ["PENDING", "DETECTED", "CONFIRMING"] },
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }]
    },
    order: [["timestamp", "ASC"]],
    limit
  });
}

export function capabilityForDeposit(deposit: Deposit): DepositNetworkCapability | null {
  return isSupportedDepositCryptoType(deposit.crypto_type)
    ? resolveDepositCapability(deposit.crypto_type)
    : null;
}

export { requireInstructions };
