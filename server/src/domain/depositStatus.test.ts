import assert from "assert";
import { test } from "node:test";
import {
  DEPOSIT_DETAILED_STATUSES,
  coarseStatusForDepositDetailed,
  depositStatusMessage,
  describeDepositStatus,
  detailedStatusFromCoarse,
  isDepositDetailedStatus,
  normalizeDepositDetailedStatus
} from "./depositStatus";

test("exposes exactly the documented deposit statuses", () => {
  assert.deepEqual(DEPOSIT_DETAILED_STATUSES, [
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

test("only COMPLETED maps to the coarse Approved status", () => {
  assert.equal(coarseStatusForDepositDetailed("COMPLETED"), "Approved");

  for (const status of [
    "PENDING",
    "DETECTED",
    "CONFIRMING",
    "AWAITING_ADMIN_APPROVAL"
  ] as const) {
    assert.equal(coarseStatusForDepositDetailed(status), "Pending");
  }

  for (const status of ["REJECTED", "EXPIRED", "FAILED"] as const) {
    assert.equal(coarseStatusForDepositDetailed(status), "Rejected");
  }
});

test("describes each status with a stable user-facing label and message", () => {
  assert.equal(describeDepositStatus("PENDING").label, "Waiting for payment");
  assert.equal(describeDepositStatus("DETECTED").label, "Transaction detected");
  assert.equal(describeDepositStatus("CONFIRMING").label, "Confirming");
  assert.equal(describeDepositStatus("AWAITING_ADMIN_APPROVAL").label, "Awaiting approval");
  assert.equal(describeDepositStatus("COMPLETED").label, "Completed");
  assert.equal(describeDepositStatus("COMPLETED").tone, "positive");
  assert.equal(describeDepositStatus("REJECTED").label, "Rejected");
  assert.equal(describeDepositStatus("REJECTED").tone, "negative");
  assert.equal(describeDepositStatus("EXPIRED").label, "Expired");
  assert.equal(describeDepositStatus("FAILED").label, "Failed");

  // The awaiting-approval copy must tell the user the wallet is not credited yet.
  assert.ok(
    depositStatusMessage("AWAITING_ADMIN_APPROVAL").includes("platform verification")
  );
});

test("accepts legacy coarse statuses and unknown values without throwing", () => {
  assert.equal(describeDepositStatus("Approved").label, "Completed");
  assert.equal(describeDepositStatus("Rejected").label, "Rejected");
  assert.equal(describeDepositStatus("Pending").label, "Waiting for payment");
  assert.equal(describeDepositStatus("SomethingUnexpected").label, "Waiting for payment");

  assert.equal(detailedStatusFromCoarse("Approved"), "COMPLETED");
  assert.equal(detailedStatusFromCoarse("Rejected"), "FAILED");
  assert.equal(detailedStatusFromCoarse("Pending"), "PENDING");
  assert.equal(detailedStatusFromCoarse("anything"), "PENDING");
});

test("normalizes and guards the detailed status input", () => {
  assert.equal(isDepositDetailedStatus("COMPLETED"), true);
  assert.equal(isDepositDetailedStatus("completed"), false, "guard is case-sensitive");
  assert.equal(isDepositDetailedStatus(null), false);

  assert.equal(normalizeDepositDetailedStatus(" awaiting_admin_approval "), "AWAITING_ADMIN_APPROVAL");
  assert.equal(normalizeDepositDetailedStatus("completed"), "COMPLETED");
  assert.equal(normalizeDepositDetailedStatus("nonsense"), "PENDING");
  assert.equal(normalizeDepositDetailedStatus(undefined), "PENDING");
});
