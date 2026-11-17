import { Request, Response } from "express";
import { validationResult } from "express-validator";
import QRCode from "qrcode";
import { AuthenticatedRequest } from "../middleware/auth";
import { Deposit } from "../models/Deposit";
import { describeDepositStatus } from "../domain/depositStatus";
import { isSupportedDepositCryptoType } from "../domain/depositRules";
import {
  listDepositCapabilities,
  memoSupportSummary
} from "../domain/depositNetworkCapabilities";
import { getPlatformWallets, missingDepositAddressEnv } from "../services/walletService";
import { buildDepositQuote } from "../services/depositQuoteService";
import {
  DepositCreationError,
  approveDeposit,
  buildDepositInstructions,
  createDepositRequest,
  detailedStatusOf,
  findUserDepositByReference,
  rejectDeposit,
  submitDepositTransactionHash
} from "../services/depositLifecycleService";
import {
  cryptoDepositDetailForAdmin,
  listCryptoDepositsForAdmin,
  pendingDepositReviewCounts
} from "../services/depositAdminService";
import { rescanDeposit } from "../services/depositMatchingService";

/**
 * Shape returned for a deposit. Mirrors the stored row plus the derived status
 * view, so the client never has to re-implement the status vocabulary and a
 * raw `verification_result` blob is not leaked to the end user.
 */
function serializeDeposit(deposit: Deposit) {
  const detailed = detailedStatusOf(deposit);
  return {
    deposit_id: deposit.deposit_id,
    reference: deposit.reference ?? null,
    user_id: deposit.user_id,
    crypto_type: deposit.crypto_type,
    amount: Number(deposit.amount),
    usd_amount:
      deposit.usd_amount === null || deposit.usd_amount === undefined
        ? null
        : Number(deposit.usd_amount),
    tx_hash: deposit.tx_hash ?? null,
    network: deposit.network ?? null,
    deposit_wallet: deposit.deposit_wallet ?? null,
    memo: deposit.memo ?? null,
    memo_label: deposit.memo_label ?? null,
    memo_required: Boolean(deposit.memo_required),
    received_amount:
      deposit.received_amount === null || deposit.received_amount === undefined
        ? null
        : Number(deposit.received_amount),
    confirmation_count: Number(deposit.confirmation_count || 0),
    detailed_status: detailed,
    status: deposit.status,
    status_view: describeDepositStatus(detailed),
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
function handleError(
  res: Response,
  error: unknown,
  context: string,
  fallbackMessage: string
): void {
  if (error instanceof DepositCreationError) {
    // eslint-disable-next-line no-console
    console.warn(
      `[deposit] ${context} rejected`,
      JSON.stringify({
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
        diagnostics: error.diagnostics
      })
    );
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
export async function createDeposit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: errors.array()[0]?.msg ?? "Invalid deposit request." });
    return;
  }

  const { crypto_type, amount, usd_amount, memo, idempotency_key } = req.body as {
    crypto_type: string;
    amount?: number | null;
    usd_amount?: number | null;
    memo?: string | null;
    idempotency_key?: string | null;
  };

  const headerKey =
    typeof req.headers["idempotency-key"] === "string"
      ? (req.headers["idempotency-key"] as string)
      : null;

  try {
    const outcome = await createDepositRequest({
      userId: req.user.userId,
      cryptoType: crypto_type,
      cryptoAmount: amount,
      usdAmount: usd_amount,
      memo,
      idempotencyKey: idempotency_key ?? headerKey
    });

    // eslint-disable-next-line no-console
    console.info(
      "[deposit] request created",
      JSON.stringify({
        depositId: outcome.deposit.deposit_id,
        reference: outcome.diagnostics.reference,
        cryptoType: outcome.diagnostics.cryptoType,
        rateVerified: outcome.diagnostics.rateVerified,
        amountSource: outcome.diagnostics.amountSource,
        reusedExisting: outcome.diagnostics.reusedExisting,
        internalNotes: outcome.diagnostics.internalNotes
      })
    );

    res.status(outcome.diagnostics.reusedExisting ? 200 : 201).json({
      deposit: serializeDeposit(outcome.deposit),
      instructions: outcome.instructions,
      diagnostics: outcome.diagnostics
    });
  } catch (error) {
    handleError(
      res,
      error,
      "create",
      "We could not create your deposit right now. Please try again."
    );
  }
}

export async function getDepositQuote(
  req: Request,
  res: Response
): Promise<void> {
  const cryptoType = String(req.query.crypto_type || "").trim().toUpperCase();

  if (!isSupportedDepositCryptoType(cryptoType)) {
    res.status(400).json({
      message: "Select a supported asset and network to see a conversion."
    });
    return;
  }

  const rawUsd = req.query.usd_amount;
  const usdAmount =
    typeof rawUsd === "string" && rawUsd.trim().length > 0 ? Number(rawUsd) : null;

  try {
    const quote = await buildDepositQuote({
      cryptoType,
      usdAmount: usdAmount !== null && Number.isFinite(usdAmount) ? usdAmount : null
    });
    res.status(200).json(quote);
  } catch {
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
export async function getDepositAddresses(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const wallets = getPlatformWallets();
    const capabilities = listDepositCapabilities();

    const items = await Promise.all(
      wallets.map(async (wallet) => {
        const capability = capabilities.find((entry) => entry.platformAsset === wallet.asset);
        const qrCodeData = await QRCode.toDataURL(wallet.address, {
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
      })
    );

    res.status(200).json(items);
  } catch (error) {
    handleError(
      res,
      error,
      "addresses",
      "Deposit addresses are unavailable right now. Please try again."
    );
  }
}

/** Static capability reference: which networks support a memo/tag and their thresholds. */
export function getDepositCapabilities(_req: Request, res: Response): void {
  res.status(200).json({
    capabilities: listDepositCapabilities().map((capability) => ({
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
    memoSupport: memoSupportSummary(),
    missingReceivingAddresses: missingDepositAddressEnv()
  });
}

export async function getUserDeposits(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const deposits = await Deposit.findAll({
      where: { user_id: req.user.userId },
      order: [["timestamp", "DESC"]]
    });
    res.status(200).json(deposits.map(serializeDeposit));
  } catch (error) {
    handleError(res, error, "list", "We could not load your deposits right now.");
  }
}

/** Status and payment instructions for one of the caller's deposits. */
export async function getUserDepositByReference(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const deposit = await findUserDepositByReference(req.user.userId, req.params.reference);
    if (!deposit) {
      res.status(404).json({ message: "We could not find that deposit." });
      return;
    }
    res.status(200).json({
      deposit: serializeDeposit(deposit),
      instructions: buildDepositInstructions(deposit)
    });
  } catch (error) {
    handleError(res, error, "detail", "We could not load that deposit right now.");
  }
}

/**
 * Attach a transaction hash supplied by the user. The hash is only used as a
 * pointer — the amount, receiver, network and confirmations are all re-read
 * from the blockchain, so a submitted hash is never trusted on its own. A
 * successful verification stops at "awaiting administrator approval".
 */
export async function submitDepositTransaction(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: errors.array()[0]?.msg ?? "Invalid transaction hash." });
    return;
  }

  const { tx_hash } = req.body as { tx_hash: string };

  try {
    const result = await submitDepositTransactionHash({
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
  } catch (error) {
    handleError(res, error, "submit-transaction", "We could not verify that transaction right now.");
  }
}

/** Re-check one of the caller's deposits against the chain immediately. */
export async function rescanUserDeposit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const deposit = await findUserDepositByReference(req.user.userId, req.params.reference);
    if (!deposit) {
      res.status(404).json({ message: "We could not find that deposit." });
      return;
    }
    const outcome = await rescanDeposit(deposit.deposit_id);
    const refreshed = await Deposit.findByPk(deposit.deposit_id);
    res.status(200).json({
      deposit: refreshed ? serializeDeposit(refreshed) : serializeDeposit(deposit),
      instructions: refreshed ? buildDepositInstructions(refreshed) : null,
      outcome
    });
  } catch (error) {
    handleError(res, error, "rescan", "We could not check that deposit right now.");
  }
}

export async function getAdminDeposits(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const result = await listCryptoDepositsForAdmin(req.query as Record<string, unknown>);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, "admin-list", "We could not load the deposit queue right now.");
  }
}

export async function getAdminDepositCounts(
  _req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    res.status(200).json(await pendingDepositReviewCounts());
  } catch (error) {
    handleError(res, error, "admin-counts", "We could not load deposit review counts right now.");
  }
}

export async function getAdminDepositDetail(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    res.status(200).json(await cryptoDepositDetailForAdmin(req.params.depositId));
  } catch (error) {
    handleError(res, error, "admin-detail", "We could not load that deposit right now.");
  }
}

/**
 * Approve a deposit. This is the only path that credits a wallet. The
 * transaction is re-verified on the correct chain first, the status change is
 * row-locked, and every wallet-side effect is idempotent, so a duplicate
 * approval cannot credit twice.
 */
export async function approveAdminDeposit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { reason } = req.body as { reason?: string | null };

  try {
    const outcome = await approveDeposit(
      req.user.userId,
      req.params.depositId,
      typeof reason === "string" ? reason : ""
    );
    res.status(200).json({
      deposit: serializeDeposit(outcome.deposit),
      credited: outcome.credited
    });
  } catch (error) {
    handleError(res, error, "approve", "We could not approve that deposit right now.");
  }
}

/** Reject a deposit. A reason is mandatory and is recorded in the audit trail. */
export async function rejectAdminDeposit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { reason } = req.body as { reason?: string | null };

  try {
    const outcome = await rejectDeposit(
      req.user.userId,
      req.params.depositId,
      typeof reason === "string" ? reason : ""
    );
    res.status(200).json({
      deposit: serializeDeposit(outcome.deposit),
      rejected: outcome.rejected
    });
  } catch (error) {
    handleError(res, error, "reject", "We could not reject that deposit right now.");
  }
}

/** Administrator-initiated chain re-scan / reconciliation for one deposit. */
export async function rescanAdminDeposit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const outcome = await rescanDeposit(req.params.depositId);
    const detail = await cryptoDepositDetailForAdmin(req.params.depositId);
    res.status(200).json({ outcome, deposit: detail.deposit, auditTrail: detail.auditTrail });
  } catch (error) {
    handleError(res, error, "admin-rescan", "We could not re-scan that deposit right now.");
  }
}
