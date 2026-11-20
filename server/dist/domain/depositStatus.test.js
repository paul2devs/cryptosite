"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const depositStatus_1 = require("./depositStatus");
(0, node_test_1.test)("exposes exactly the documented deposit statuses", () => {
    assert_1.default.deepEqual(depositStatus_1.DEPOSIT_DETAILED_STATUSES, [
        "PENDING",
        "DETECTED",
        "CONFIRMING",
        "AWAITING_ADMIN_APPROVAL",
        "COMPLETED",
        "REJECTED",
        "EXPIRED",
        "FAILED"
    ]);
});
(0, node_test_1.test)("only COMPLETED maps to the coarse Approved status", () => {
    assert_1.default.equal((0, depositStatus_1.coarseStatusForDepositDetailed)("COMPLETED"), "Approved");
    for (const status of [
        "PENDING",
        "DETECTED",
        "CONFIRMING",
        "AWAITING_ADMIN_APPROVAL"
    ]) {
        assert_1.default.equal((0, depositStatus_1.coarseStatusForDepositDetailed)(status), "Pending");
    }
    for (const status of ["REJECTED", "EXPIRED", "FAILED"]) {
        assert_1.default.equal((0, depositStatus_1.coarseStatusForDepositDetailed)(status), "Rejected");
    }
});
(0, node_test_1.test)("describes each status with a stable user-facing label and message", () => {
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("PENDING").label, "Waiting for payment");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("DETECTED").label, "Transaction detected");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("CONFIRMING").label, "Confirming");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("AWAITING_ADMIN_APPROVAL").label, "Awaiting approval");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("COMPLETED").label, "Completed");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("COMPLETED").tone, "positive");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("REJECTED").label, "Rejected");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("REJECTED").tone, "negative");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("EXPIRED").label, "Expired");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("FAILED").label, "Failed");
    // The awaiting-approval copy must tell the user the wallet is not credited yet.
    assert_1.default.ok((0, depositStatus_1.depositStatusMessage)("AWAITING_ADMIN_APPROVAL").includes("platform verification"));
});
(0, node_test_1.test)("accepts legacy coarse statuses and unknown values without throwing", () => {
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("Approved").label, "Completed");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("Rejected").label, "Rejected");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("Pending").label, "Waiting for payment");
    assert_1.default.equal((0, depositStatus_1.describeDepositStatus)("SomethingUnexpected").label, "Waiting for payment");
    assert_1.default.equal((0, depositStatus_1.detailedStatusFromCoarse)("Approved"), "COMPLETED");
    assert_1.default.equal((0, depositStatus_1.detailedStatusFromCoarse)("Rejected"), "FAILED");
    assert_1.default.equal((0, depositStatus_1.detailedStatusFromCoarse)("Pending"), "PENDING");
    assert_1.default.equal((0, depositStatus_1.detailedStatusFromCoarse)("anything"), "PENDING");
});
(0, node_test_1.test)("normalizes and guards the detailed status input", () => {
    assert_1.default.equal((0, depositStatus_1.isDepositDetailedStatus)("COMPLETED"), true);
    assert_1.default.equal((0, depositStatus_1.isDepositDetailedStatus)("completed"), false, "guard is case-sensitive");
    assert_1.default.equal((0, depositStatus_1.isDepositDetailedStatus)(null), false);
    assert_1.default.equal((0, depositStatus_1.normalizeDepositDetailedStatus)(" awaiting_admin_approval "), "AWAITING_ADMIN_APPROVAL");
    assert_1.default.equal((0, depositStatus_1.normalizeDepositDetailedStatus)("completed"), "COMPLETED");
    assert_1.default.equal((0, depositStatus_1.normalizeDepositDetailedStatus)("nonsense"), "PENDING");
    assert_1.default.equal((0, depositStatus_1.normalizeDepositDetailedStatus)(undefined), "PENDING");
});
