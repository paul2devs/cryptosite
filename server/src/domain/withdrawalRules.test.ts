import assert from "assert";
import { test } from "node:test";
import {
  assertWithdrawalTransition,
  coarseStatusForDetailed,
  computeWithdrawalFees,
  deriveWithdrawalStatus,
  isValidWalletAddress,
  validateWithdrawalSubmission
} from "./withdrawalRules";

test("requires a review step before approval and records rejection as a valid transition", () => {
  assert.equal(assertWithdrawalTransition("requested", "under_review"), "under_review");
  assert.equal(assertWithdrawalTransition("under_review", "rejected"), "rejected");
  assert.throws(() => assertWithdrawalTransition("requested", "completed"));
});

test("keeps historical approved withdrawals readable before the detailed status exists", () => {
  assert.equal(deriveWithdrawalStatus("Approved", null), "approved");
  assert.equal(deriveWithdrawalStatus("Pending", null), "requested");
});

test("never lets a terminal withdrawal move again", () => {
  assert.throws(() => assertWithdrawalTransition("completed", "processing"));
  assert.throws(() => assertWithdrawalTransition("rejected", "approved"));
  assert.throws(() => assertWithdrawalTransition("cancelled", "approved"));
});

test("maps the detailed lifecycle onto the coarse stored status", () => {
  assert.equal(coarseStatusForDetailed("requested"), "Pending");
  assert.equal(coarseStatusForDetailed("under_review"), "Pending");
  assert.equal(coarseStatusForDetailed("approved"), "Approved");
  assert.equal(coarseStatusForDetailed("processing"), "Approved");
  assert.equal(coarseStatusForDetailed("broadcast"), "Approved");
  assert.equal(coarseStatusForDetailed("completed"), "Approved");
  assert.equal(coarseStatusForDetailed("rejected"), "Rejected");
  assert.equal(coarseStatusForDetailed("failed"), "Rejected");
  assert.equal(coarseStatusForDetailed("cancelled"), "Rejected");
});

test("validates destination addresses per network", () => {
  assert.equal(isValidWalletAddress("ERC20", "0x0000000000000000000000000000000000000000"), true);
  assert.equal(isValidWalletAddress("ERC20", "not-an-address"), false);
  assert.equal(isValidWalletAddress("TRC20", "T" + "A".repeat(33)), true);
  assert.equal(isValidWalletAddress("TRC20", "A" + "A".repeat(33)), false);
  assert.equal(isValidWalletAddress("BTC", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"), true);
  assert.equal(isValidWalletAddress("BTC", "zzzz"), false);
});

test("rejects submissions with an unknown asset, bad amount, or a network mismatch", () => {
  const unknownAsset = validateWithdrawalSubmission({
    asset: "DOGE",
    network: "ERC20",
    address: "0x0000000000000000000000000000000000000000",
    amount: 10
  });
  assert.equal(unknownAsset.valid, false);
  assert.equal(unknownAsset.cryptoType, null);

  const mismatch = validateWithdrawalSubmission({
    asset: "TRC20",
    network: "ERC20",
    address: "T" + "A".repeat(33),
    amount: 10
  });
  assert.equal(mismatch.valid, false);

  const badAmount = validateWithdrawalSubmission({
    asset: "BTC",
    network: "BTC",
    address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    amount: -1
  });
  assert.equal(badAmount.valid, false);

  const ok = validateWithdrawalSubmission({
    asset: "TRC20",
    network: "TRC20",
    address: "T" + "A".repeat(33),
    amount: 25.5
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.platformAsset, "USDT_TRC20");
  assert.equal(ok.networkType, "TRC20");
});

test("computes network and platform fees transparently and keeps the net amount non-negative", () => {
  const fees = computeWithdrawalFees({ amount: 100, networkFee: 1.5, platformFeePercent: 2 });
  assert.equal(fees.networkFee, "1.50000000");
  assert.equal(fees.platformFee, "2.00000000");
  assert.equal(fees.totalFee, "3.50000000");
  assert.equal(fees.netAmount, "96.50000000");

  const capped = computeWithdrawalFees({ amount: 1, networkFee: 5, platformFeePercent: 0 });
  assert.equal(capped.netAmount, "0.00000000");
});
