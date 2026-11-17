import { Op } from "sequelize";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { Deposit } from "../models/Deposit";
import { User } from "../models/User";
import { explorerUrlFor } from "../domain/transactionRules";
import { isSupportedDepositCryptoType } from "../domain/depositRules";
import { resolveDepositCapability } from "../domain/depositNetworkCapabilities";
import {
  DepositDetailedStatus,
  describeDepositStatus,
  isDepositDetailedStatus,
  normalizeDepositDetailedStatus
} from "../domain/depositStatus";
import {
  CLOSED_DEPOSIT_STATUSES,
  DepositCreationError,
  detailedStatusOf,
  OPEN_DEPOSIT_STATUSES
} from "./depositLifecycleService";

/** Admin queue filters, matching the vocabulary used by the admin dashboard. */
export const ADMIN_DEPOSIT_FILTERS = [
  "pending",
  "detected",
  "confirming",
  "awaiting_approval",
  "completed",
  "rejected",
  "expired",
  "failed",
  "open",
  "all"
] as const;

export type AdminDepositFilter = (typeof ADMIN_DEPOSIT_FILTERS)[number];

export function normalizeAdminDepositFilter(value: unknown): AdminDepositFilter {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (ADMIN_DEPOSIT_FILTERS as readonly string[]).includes(raw)
    ? (raw as AdminDepositFilter)
    : "open";
}

function statusesForFilter(filter: AdminDepositFilter): DepositDetailedStatus[] | null {
  switch (filter) {
    case "pending":
      return ["PENDING"];
    case "detected":
      return ["DETECTED"];
    case "confirming":
      return ["CONFIRMING"];
    case "awaiting_approval":
      return ["AWAITING_ADMIN_APPROVAL"];
    case "completed":
      return ["COMPLETED"];
    case "rejected":
      return ["REJECTED"];
    case "expired":
      return ["EXPIRED"];
    case "failed":
      return ["FAILED"];
    case "open":
      return OPEN_DEPOSIT_STATUSES;
    case "all":
    default:
      return null;
  }
}

export interface AdminDepositRow {
  depositId: string;
  reference: string;
  status: string;
  detailedStatus: DepositDetailedStatus;
  statusLabel: string;
  statusMessage: string;
  approvalRequired: boolean;
  user: {
    userId: string;
    name: string;
    email: string;
    isAdmin: boolean;
  } | null;
  cryptoType: string;
  symbol: string;
  network: string;
  networkLabel: string;
  receivingAddress: string | null;
  expectedAmount: number;
  expectedAmountLabel: string;
  receivedAmount: number | null;
  usdAmount: number | null;
  memo: string | null;
  memoLabel: string | null;
  memoRequired: boolean;
  txHash: string | null;
  explorerUrl: string | null;
  confirmations: number;
  minConfirmations: number;
  verification: {
    stage: string;
    success: boolean;
    amount: number;
    toAddress: string;
    confirmations: number;
    failureReason: string | null;
  } | null;
  createdAt: string;
  detectedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  approvedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  canApprove: boolean;
  canReject: boolean;
}

function trimNumberLabel(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}

function verificationSummary(deposit: Deposit): AdminDepositRow["verification"] {
  const raw = deposit.verification_result;
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  return {
    stage: typeof record.stage === "string" ? record.stage : "unknown",
    success: record.success === true,
    amount: Number.isFinite(Number(record.amount)) ? Number(record.amount) : 0,
    toAddress: typeof record.toAddress === "string" ? record.toAddress : "",
    confirmations: Number.isFinite(Number(record.confirmations)) ? Number(record.confirmations) : 0,
    failureReason:
      typeof record.failureReason === "string" && record.failureReason.length > 0
        ? record.failureReason
        : null
  };
}

export function projectAdminDepositRow(
  deposit: Deposit,
  user: User | null | undefined
): AdminDepositRow {
  const detailedStatus = detailedStatusOf(deposit);
  const view = describeDepositStatus(detailedStatus);
  const capability = isSupportedDepositCryptoType(deposit.crypto_type)
    ? resolveDepositCapability(deposit.crypto_type)
    : null;
  const decimals = capability?.decimals ?? 8;
  const closed = CLOSED_DEPOSIT_STATUSES.includes(detailedStatus);

  return {
    depositId: deposit.deposit_id,
    reference: deposit.reference ?? "",
    status: deposit.status,
    detailedStatus,
    statusLabel: view.label,
    statusMessage: view.message,
    approvalRequired: !closed,
    user: user
      ? {
          userId: user.user_id,
          name: user.name,
          email: user.email,
          isAdmin: Boolean(user.is_admin)
        }
      : null,
    cryptoType: deposit.crypto_type,
    symbol: capability?.symbol ?? deposit.crypto_type,
    network: deposit.network ?? "",
    networkLabel: capability?.networkLabel ?? deposit.network ?? "",
    receivingAddress: deposit.deposit_wallet ?? null,
    expectedAmount: Number(deposit.amount),
    expectedAmountLabel: `${trimNumberLabel(Number(deposit.amount), decimals)} ${
      capability?.symbol ?? deposit.crypto_type
    }`,
    receivedAmount:
      deposit.received_amount === null || deposit.received_amount === undefined
        ? null
        : Number(deposit.received_amount),
    usdAmount:
      deposit.usd_amount === null || deposit.usd_amount === undefined
        ? null
        : Number(deposit.usd_amount),
    memo: deposit.memo ?? null,
    memoLabel: deposit.memo_label ?? null,
    memoRequired: Boolean(deposit.memo_required),
    txHash: deposit.tx_hash ?? null,
    explorerUrl: explorerUrlFor(deposit.network, deposit.tx_hash),
    confirmations: Number(deposit.confirmation_count || 0),
    minConfirmations: capability?.minConfirmations ?? 0,
    verification: verificationSummary(deposit),
    createdAt: (deposit.timestamp || new Date()).toISOString(),
    detectedAt: deposit.detected_at ? deposit.detected_at.toISOString() : null,
    verifiedAt: deposit.verified_at ? deposit.verified_at.toISOString() : null,
    expiresAt: deposit.expires_at ? deposit.expires_at.toISOString() : null,
    approvedAt: deposit.approved_at ? deposit.approved_at.toISOString() : null,
    reviewedAt: deposit.reviewed_at ? deposit.reviewed_at.toISOString() : null,
    reviewedBy: deposit.reviewed_by ?? null,
    rejectionReason: deposit.rejection_reason ?? null,
    canApprove: !closed,
    canReject: !closed
  };
}

export interface AdminDepositListResult {
  page: number;
  pageSize: number;
  total: number;
  filter: AdminDepositFilter;
  counts: Record<string, number>;
  deposits: AdminDepositRow[];
}

/**
 * List crypto deposits for the admin dashboard. User details are joined so an
 * administrator always reviews the account behind the request, and the filter
 * vocabulary is server-enforced so the frontend cannot request an unknown set.
 */
export async function listCryptoDepositsForAdmin(
  query: Record<string, unknown>
): Promise<AdminDepositListResult> {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
  const offset = (page - 1) * pageSize;
  const filter = normalizeAdminDepositFilter(query.status);

  const where: Record<string | symbol, unknown> = {};
  const statuses = statusesForFilter(filter);
  if (statuses) {
    where.detailed_status = { [Op.in]: statuses };
  }
  if (query.asset) {
    where.crypto_type = String(query.asset);
  }
  if (query.network) {
    where.network = { [Op.iLike]: `%${String(query.network)}%` };
  }
  if (query.from || query.to) {
    where.timestamp = {
      ...(query.from ? { [Op.gte]: new Date(String(query.from)) } : {}),
      ...(query.to ? { [Op.lte]: new Date(String(query.to)) } : {})
    };
  }

  const term = String(query.q || "").trim();
  if (term) {
    const matchingUsers = await User.findAll({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: `%${term}%` } },
          { name: { [Op.iLike]: `%${term}%` } }
        ]
      },
      attributes: ["user_id"]
    });
    where[Op.or] = [
      { reference: { [Op.iLike]: `%${term}%` } },
      { tx_hash: { [Op.iLike]: `%${term}%` } },
      { user_id: { [Op.in]: matchingUsers.map((row) => row.user_id) } }
    ];
  }

  const { rows, count } = await Deposit.findAndCountAll({
    where,
    include: [{ model: User }],
    limit: pageSize,
    offset,
    order: [["timestamp", "DESC"]]
  });

  const counts: Record<string, number> = {};
  for (const status of [
    "PENDING",
    "DETECTED",
    "CONFIRMING",
    "AWAITING_ADMIN_APPROVAL",
    "COMPLETED",
    "REJECTED",
    "EXPIRED",
    "FAILED"
  ] as DepositDetailedStatus[]) {
    counts[status] = await Deposit.count({ where: { detailed_status: status } });
  }

  return {
    page,
    pageSize,
    total: count,
    filter,
    counts,
    deposits: rows.map((deposit) =>
      projectAdminDepositRow(deposit, (deposit as Deposit & { User?: User }).User)
    )
  };
}

export interface AdminDepositDetail {
  deposit: AdminDepositRow;
  auditTrail: Array<{
    auditId: string;
    adminId: string;
    action: string;
    reason: string;
    metadata: unknown;
    createdAt: string;
  }>;
  canApprove: boolean;
  canReject: boolean;
  approvalBlockedReason: string | null;
}

/**
 * Full deposit record for the review screen, including the audit trail of every
 * administrator decision recorded against it.
 */
export async function cryptoDepositDetailForAdmin(
  depositId: string
): Promise<AdminDepositDetail> {
  const deposit = await Deposit.findByPk(depositId, { include: [{ model: User }] });
  if (!deposit) {
    throw new DepositCreationError(404, "DEPOSIT_NOT_FOUND", "That deposit does not exist.");
  }

  const audits = await AdminAuditLog.findAll({
    where: { entity_type: "deposit", entity_id: depositId },
    order: [["created_at", "DESC"]]
  });

  const row = projectAdminDepositRow(deposit, (deposit as Deposit & { User?: User }).User);
  const detailed = detailedStatusOf(deposit);
  const closed = CLOSED_DEPOSIT_STATUSES.includes(detailed);

  let approvalBlockedReason: string | null = null;
  if (detailed === "REJECTED") {
    approvalBlockedReason =
      "Rejected deposits cannot be approved through this action. Use the controlled reconsideration process.";
  } else if (detailed === "EXPIRED" || detailed === "FAILED") {
    approvalBlockedReason = "This deposit is closed and can no longer be approved.";
  } else if (detailed === "COMPLETED") {
    approvalBlockedReason = "This deposit has already been approved and credited.";
  } else if (!deposit.tx_hash) {
    approvalBlockedReason =
      "No transaction hash is recorded. Scan the chain or record the hash before approving.";
  }

  return {
    deposit: row,
    auditTrail: audits.map((audit) => ({
      auditId: audit.audit_id,
      adminId: audit.admin_id,
      action: audit.action,
      reason: audit.reason,
      metadata: audit.metadata,
      createdAt: audit.created_at.toISOString()
    })),
    canApprove: !closed && Boolean(deposit.tx_hash),
    canReject: !closed,
    approvalBlockedReason
  };
}

export async function pendingDepositReviewCounts(): Promise<{
  awaitingApproval: number;
  open: number;
}> {
  const [awaitingApproval, open] = await Promise.all([
    Deposit.count({ where: { detailed_status: "AWAITING_ADMIN_APPROVAL" } }),
    Deposit.count({ where: { detailed_status: { [Op.in]: OPEN_DEPOSIT_STATUSES } } })
  ]);
  return { awaitingApproval, open };
}

export function isClosedDetail(value: unknown): boolean {
  return CLOSED_DEPOSIT_STATUSES.includes(normalizeDepositDetailedStatus(value));
}

export function isKnownDetailStatus(value: unknown): boolean {
  return isDepositDetailedStatus(value);
}
