"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_DEPOSIT_FILTERS = void 0;
exports.normalizeAdminDepositFilter = normalizeAdminDepositFilter;
exports.projectAdminDepositRow = projectAdminDepositRow;
exports.listCryptoDepositsForAdmin = listCryptoDepositsForAdmin;
exports.cryptoDepositDetailForAdmin = cryptoDepositDetailForAdmin;
exports.pendingDepositReviewCounts = pendingDepositReviewCounts;
exports.isClosedDetail = isClosedDetail;
exports.isKnownDetailStatus = isKnownDetailStatus;
const sequelize_1 = require("sequelize");
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const Deposit_1 = require("../models/Deposit");
const User_1 = require("../models/User");
const transactionRules_1 = require("../domain/transactionRules");
const depositRules_1 = require("../domain/depositRules");
const depositNetworkCapabilities_1 = require("../domain/depositNetworkCapabilities");
const depositStatus_1 = require("../domain/depositStatus");
const depositLifecycleService_1 = require("./depositLifecycleService");
/** Admin queue filters, matching the vocabulary used by the admin dashboard. */
exports.ADMIN_DEPOSIT_FILTERS = [
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
];
function normalizeAdminDepositFilter(value) {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    return exports.ADMIN_DEPOSIT_FILTERS.includes(raw)
        ? raw
        : "open";
}
function statusesForFilter(filter) {
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
            return depositLifecycleService_1.OPEN_DEPOSIT_STATUSES;
        case "all":
        default:
            return null;
    }
}
function trimNumberLabel(value, decimals) {
    const fixed = value.toFixed(decimals);
    return fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
}
function verificationSummary(deposit) {
    const raw = deposit.verification_result;
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const record = raw;
    return {
        stage: typeof record.stage === "string" ? record.stage : "unknown",
        success: record.success === true,
        amount: Number.isFinite(Number(record.amount)) ? Number(record.amount) : 0,
        toAddress: typeof record.toAddress === "string" ? record.toAddress : "",
        confirmations: Number.isFinite(Number(record.confirmations)) ? Number(record.confirmations) : 0,
        failureReason: typeof record.failureReason === "string" && record.failureReason.length > 0
            ? record.failureReason
            : null
    };
}
function projectAdminDepositRow(deposit, user) {
    const detailedStatus = (0, depositLifecycleService_1.detailedStatusOf)(deposit);
    const view = (0, depositStatus_1.describeDepositStatus)(detailedStatus);
    const capability = (0, depositRules_1.isSupportedDepositCryptoType)(deposit.crypto_type)
        ? (0, depositNetworkCapabilities_1.resolveDepositCapability)(deposit.crypto_type)
        : null;
    const decimals = capability?.decimals ?? 8;
    const closed = depositLifecycleService_1.CLOSED_DEPOSIT_STATUSES.includes(detailedStatus);
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
        expectedAmountLabel: `${trimNumberLabel(Number(deposit.amount), decimals)} ${capability?.symbol ?? deposit.crypto_type}`,
        receivedAmount: deposit.received_amount === null || deposit.received_amount === undefined
            ? null
            : Number(deposit.received_amount),
        usdAmount: deposit.usd_amount === null || deposit.usd_amount === undefined
            ? null
            : Number(deposit.usd_amount),
        memo: deposit.memo ?? null,
        memoLabel: deposit.memo_label ?? null,
        memoRequired: Boolean(deposit.memo_required),
        txHash: deposit.tx_hash ?? null,
        explorerUrl: (0, transactionRules_1.explorerUrlFor)(deposit.network, deposit.tx_hash),
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
/**
 * List crypto deposits for the admin dashboard. User details are joined so an
 * administrator always reviews the account behind the request, and the filter
 * vocabulary is server-enforced so the frontend cannot request an unknown set.
 */
async function listCryptoDepositsForAdmin(query) {
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const filter = normalizeAdminDepositFilter(query.status);
    const where = {};
    const statuses = statusesForFilter(filter);
    if (statuses) {
        where.detailed_status = { [sequelize_1.Op.in]: statuses };
    }
    if (query.asset) {
        where.crypto_type = String(query.asset);
    }
    if (query.network) {
        where.network = { [sequelize_1.Op.iLike]: `%${String(query.network)}%` };
    }
    if (query.from || query.to) {
        where.timestamp = {
            ...(query.from ? { [sequelize_1.Op.gte]: new Date(String(query.from)) } : {}),
            ...(query.to ? { [sequelize_1.Op.lte]: new Date(String(query.to)) } : {})
        };
    }
    const term = String(query.q || "").trim();
    if (term) {
        const matchingUsers = await User_1.User.findAll({
            where: {
                [sequelize_1.Op.or]: [
                    { email: { [sequelize_1.Op.iLike]: `%${term}%` } },
                    { name: { [sequelize_1.Op.iLike]: `%${term}%` } }
                ]
            },
            attributes: ["user_id"]
        });
        where[sequelize_1.Op.or] = [
            { reference: { [sequelize_1.Op.iLike]: `%${term}%` } },
            { tx_hash: { [sequelize_1.Op.iLike]: `%${term}%` } },
            { user_id: { [sequelize_1.Op.in]: matchingUsers.map((row) => row.user_id) } }
        ];
    }
    const { rows, count } = await Deposit_1.Deposit.findAndCountAll({
        where,
        include: [{ model: User_1.User }],
        limit: pageSize,
        offset,
        order: [["timestamp", "DESC"]]
    });
    const counts = {};
    for (const status of [
        "PENDING",
        "DETECTED",
        "CONFIRMING",
        "AWAITING_ADMIN_APPROVAL",
        "COMPLETED",
        "REJECTED",
        "EXPIRED",
        "FAILED"
    ]) {
        counts[status] = await Deposit_1.Deposit.count({ where: { detailed_status: status } });
    }
    return {
        page,
        pageSize,
        total: count,
        filter,
        counts,
        deposits: rows.map((deposit) => projectAdminDepositRow(deposit, deposit.User))
    };
}
/**
 * Full deposit record for the review screen, including the audit trail of every
 * administrator decision recorded against it.
 */
async function cryptoDepositDetailForAdmin(depositId) {
    const deposit = await Deposit_1.Deposit.findByPk(depositId, { include: [{ model: User_1.User }] });
    if (!deposit) {
        throw new depositLifecycleService_1.DepositCreationError(404, "DEPOSIT_NOT_FOUND", "That deposit does not exist.");
    }
    const audits = await AdminAuditLog_1.AdminAuditLog.findAll({
        where: { entity_type: "deposit", entity_id: depositId },
        order: [["created_at", "DESC"]]
    });
    const row = projectAdminDepositRow(deposit, deposit.User);
    const detailed = (0, depositLifecycleService_1.detailedStatusOf)(deposit);
    const closed = depositLifecycleService_1.CLOSED_DEPOSIT_STATUSES.includes(detailed);
    let approvalBlockedReason = null;
    if (detailed === "REJECTED") {
        approvalBlockedReason =
            "Rejected deposits cannot be approved through this action. Use the controlled reconsideration process.";
    }
    else if (detailed === "EXPIRED" || detailed === "FAILED") {
        approvalBlockedReason = "This deposit is closed and can no longer be approved.";
    }
    else if (detailed === "COMPLETED") {
        approvalBlockedReason = "This deposit has already been approved and credited.";
    }
    else if (!deposit.tx_hash) {
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
async function pendingDepositReviewCounts() {
    const [awaitingApproval, open] = await Promise.all([
        Deposit_1.Deposit.count({ where: { detailed_status: "AWAITING_ADMIN_APPROVAL" } }),
        Deposit_1.Deposit.count({ where: { detailed_status: { [sequelize_1.Op.in]: depositLifecycleService_1.OPEN_DEPOSIT_STATUSES } } })
    ]);
    return { awaitingApproval, open };
}
function isClosedDetail(value) {
    return depositLifecycleService_1.CLOSED_DEPOSIT_STATUSES.includes((0, depositStatus_1.normalizeDepositDetailedStatus)(value));
}
function isKnownDetailStatus(value) {
    return (0, depositStatus_1.isDepositDetailedStatus)(value);
}
