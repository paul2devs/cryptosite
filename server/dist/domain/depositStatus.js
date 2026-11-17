"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPOSIT_DETAILED_STATUSES = void 0;
exports.isDepositDetailedStatus = isDepositDetailedStatus;
exports.normalizeDepositDetailedStatus = normalizeDepositDetailedStatus;
exports.coarseStatusForDepositDetailed = coarseStatusForDepositDetailed;
exports.detailedStatusFromCoarse = detailedStatusFromCoarse;
exports.describeDepositStatus = describeDepositStatus;
exports.depositStatusMessage = depositStatusMessage;
exports.DEPOSIT_DETAILED_STATUSES = [
    "PENDING",
    "DETECTED",
    "CONFIRMING",
    "AWAITING_ADMIN_APPROVAL",
    "COMPLETED",
    "REJECTED",
    "EXPIRED",
    "FAILED"
];
const STATUS_VIEWS = {
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
        message: "We've verified your transaction on the blockchain. It is now awaiting administrator approval before your wallet is credited."
    },
    COMPLETED: {
        label: "Completed",
        tone: "positive",
        message: "Your crypto deposit has been confirmed successfully."
    },
    REJECTED: {
        label: "Rejected",
        tone: "negative",
        message: "This deposit was rejected by an administrator. Quote your deposit reference to support if you believe this decision is incorrect."
    },
    EXPIRED: {
        label: "Expired",
        tone: "negative",
        message: "This deposit request expired before a matching transfer was detected. Quote your deposit reference to support if you already sent funds."
    },
    FAILED: {
        label: "Failed",
        tone: "negative",
        message: "This deposit could not be verified. Quote your deposit reference to support and we will reconcile it manually."
    }
};
function isDepositDetailedStatus(value) {
    return (typeof value === "string" &&
        exports.DEPOSIT_DETAILED_STATUSES.includes(value));
}
function normalizeDepositDetailedStatus(value) {
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
function coarseStatusForDepositDetailed(detailed) {
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
function detailedStatusFromCoarse(coarse) {
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
function describeDepositStatus(status) {
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
function depositStatusMessage(status) {
    return describeDepositStatus(status).message;
}
