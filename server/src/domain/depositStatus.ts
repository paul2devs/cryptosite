/**
 * Deposit status model.
 *
 * Two layers are kept so the accounting/reporting code that already keys on the
 * coarse status keeps working, while the deposit experience can report fine
 * grained progress:
 *
 *  - `detailed_status`: PENDING | DETECTED | CONFIRMING | AWAITING_ADMIN_APPROVAL
 *                      | COMPLETED | REJECTED | EXPIRED | FAILED
 *  - `status` (coarse): Pending | Approved | Rejected
 *
 * A deposit is only ever credited when `detailed_status` reaches COMPLETED, and
 * COMPLETED is only reachable through an explicit administrator approval of an
 * on-chain verified transaction. Automatic detection stops at
 * AWAITING_ADMIN_APPROVAL and never credits the wallet by itself.
 */

export type DepositDetailedStatus =
  | "PENDING"
  | "DETECTED"
  | "CONFIRMING"
  | "AWAITING_ADMIN_APPROVAL"
  | "COMPLETED"
  | "REJECTED"
  | "EXPIRED"
  | "FAILED";

export type DepositCoarseStatus = "Pending" | "Approved" | "Rejected";

export type DepositStatusTone = "gold" | "positive" | "negative";

export const DEPOSIT_DETAILED_STATUSES: DepositDetailedStatus[] = [
  "PENDING",
  "DETECTED",
  "CONFIRMING",
  "AWAITING_ADMIN_APPROVAL",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
  "FAILED"
];

export interface DepositStatusView {
  label: string;
  tone: DepositStatusTone;
  /** User-facing explanation of what the state means, shown on the payment screen. */
  message: string;
}

const STATUS_VIEWS: Record<DepositDetailedStatus, DepositStatusView> = {
  PENDING: {
    label: "Waiting for payment",
    tone: "gold",
    message: "Waiting for your crypto transfer to arrive."
  },
  DETECTED: {
    label: "Transaction detected",
    tone: "gold",
    message: "We've detected your transaction and are checking its confirmations."
  },
  CONFIRMING: {
    label: "Confirming",
    tone: "gold",
    message: "Your transaction is being confirmed on the blockchain."
  },
  AWAITING_ADMIN_APPROVAL: {
    label: "Awaiting approval",
    tone: "gold",
    message:
      "We've verified your transaction on the blockchain. It is now awaiting administrator approval before your wallet is credited."
  },
  COMPLETED: {
    label: "Completed",
    tone: "positive",
    message: "Your crypto deposit has been confirmed successfully."
  },
  REJECTED: {
    label: "Rejected",
    tone: "negative",
    message:
      "This deposit was rejected by an administrator. Quote your deposit reference to support if you believe this decision is incorrect."
  },
  EXPIRED: {
    label: "Expired",
    tone: "negative",
    message:
      "This deposit request expired before a matching transfer was detected. Quote your deposit reference to support if you already sent funds."
  },
  FAILED: {
    label: "Failed",
    tone: "negative",
    message:
      "This deposit could not be verified. Quote your deposit reference to support and we will reconcile it manually."
  }
};

export function isDepositDetailedStatus(value: unknown): value is DepositDetailedStatus {
  return (
    typeof value === "string" &&
    (DEPOSIT_DETAILED_STATUSES as string[]).includes(value)
  );
}

export function normalizeDepositDetailedStatus(value: unknown): DepositDetailedStatus {
  if (typeof value !== "string") {
    return "PENDING";
  }
  const upper = value.trim().toUpperCase();
  return isDepositDetailedStatus(upper) ? upper : "PENDING";
}

/**
 * Map a detailed status onto the coarse status used by wallet accounting,
 * reporting and referral rewards. Terminal failures use Rejected so no reward or
 * credit is ever produced for them.
 */
export function coarseStatusForDepositDetailed(
  detailed: DepositDetailedStatus
): DepositCoarseStatus {
  switch (detailed) {
    case "COMPLETED":
      return "Approved";
    case "REJECTED":
    case "EXPIRED":
    case "FAILED":
      return "Rejected";
    default:
      return "Pending";
  }
}

/**
 * Derive the detailed status for a legacy row (or a row whose detailed status is
 * missing) from its coarse status. Used only for reconciliation of existing data.
 */
export function detailedStatusFromCoarse(coarse: string): DepositDetailedStatus {
  if (coarse === "Approved") {
    return "COMPLETED";
  }
  if (coarse === "Rejected") {
    return "FAILED";
  }
  return "PENDING";
}

/**
 * Accepts either a detailed or a coarse status so existing call sites keep
 * working. Unknown values fall back to Pending.
 */
export function describeDepositStatus(status: string): DepositStatusView {
  const upper = typeof status === "string" ? status.trim().toUpperCase() : "";
  if (isDepositDetailedStatus(upper)) {
    return STATUS_VIEWS[upper];
  }
  if (status === "Approved") {
    return STATUS_VIEWS.COMPLETED;
  }
  if (status === "Rejected") {
    return STATUS_VIEWS.FAILED;
  }
  return STATUS_VIEWS.PENDING;
}

export function depositStatusMessage(status: string): string {
  return describeDepositStatus(status).message;
}
