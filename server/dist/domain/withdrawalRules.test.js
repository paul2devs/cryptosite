"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const withdrawalRules_1 = require("./withdrawalRules");
(0, node_test_1.test)("requires a review step before approval and records rejection as a valid transition", () => {
    assert_1.default.equal((0, withdrawalRules_1.assertWithdrawalTransition)("requested", "under_review"), "under_review");
    assert_1.default.equal((0, withdrawalRules_1.assertWithdrawalTransition)("under_review", "rejected"), "rejected");
    assert_1.default.throws(() => (0, withdrawalRules_1.assertWithdrawalTransition)("requested", "completed"));
});
(0, node_test_1.test)("keeps historical approved withdrawals readable before the detailed status exists", () => {
    assert_1.default.equal((0, withdrawalRules_1.deriveWithdrawalStatus)("Approved", null), "approved");
    assert_1.default.equal((0, withdrawalRules_1.deriveWithdrawalStatus)("Pending", null), "requested");
});
(0, node_test_1.test)("never lets a terminal withdrawal move again", () => {
    assert_1.default.throws(() => (0, withdrawalRules_1.assertWithdrawalTransition)("completed", "processing"));
    assert_1.default.throws(() => (0, withdrawalRules_1.assertWithdrawalTransition)("rejected", "approved"));
    assert_1.default.throws(() => (0, withdrawalRules_1.assertWithdrawalTransition)("cancelled", "approved"));
});
(0, node_test_1.test)("maps the detailed lifecycle onto the coarse stored status", () => {
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("requested"), "Pending");
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("under_review"), "Pending");
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("approved"), "Approved");
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("processing"), "Approved");
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("broadcast"), "Approved");
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("completed"), "Approved");
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("rejected"), "Rejected");
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("failed"), "Rejected");
    assert_1.default.equal((0, withdrawalRules_1.coarseStatusForDetailed)("cancelled"), "Rejected");
});
(0, node_test_1.test)("validates destination addresses per network", () => {
    assert_1.default.equal((0, withdrawalRules_1.isValidWalletAddress)("ERC20", "0x0000000000000000000000000000000000000000"), true);
    assert_1.default.equal((0, withdrawalRules_1.isValidWalletAddress)("ERC20", "not-an-address"), false);
    assert_1.default.equal((0, withdrawalRules_1.isValidWalletAddress)("TRC20", "T" + "A".repeat(33)), true);
    assert_1.default.equal((0, withdrawalRules_1.isValidWalletAddress)("TRC20", "A" + "A".repeat(33)), false);
    assert_1.default.equal((0, withdrawalRules_1.isValidWalletAddress)("BTC", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"), true);
    assert_1.default.equal((0, withdrawalRules_1.isValidWalletAddress)("BTC", "zzzz"), false);
});
(0, node_test_1.test)("rejects submissions with an unknown asset, bad amount, or a network mismatch", () => {
    const unknownAsset = (0, withdrawalRules_1.validateWithdrawalSubmission)({
        asset: "DOGE",
        network: "ERC20",
        address: "0x0000000000000000000000000000000000000000",
        amount: 10
    });
    assert_1.default.equal(unknownAsset.valid, false);
    assert_1.default.equal(unknownAsset.cryptoType, null);
    const mismatch = (0, withdrawalRules_1.validateWithdrawalSubmission)({
        asset: "TRC20",
        network: "ERC20",
        address: "T" + "A".repeat(33),
        amount: 10
    });
    assert_1.default.equal(mismatch.valid, false);
    const badAmount = (0, withdrawalRules_1.validateWithdrawalSubmission)({
        asset: "BTC",
        network: "BTC",
        address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        amount: -1
    });
    assert_1.default.equal(badAmount.valid, false);
    const ok = (0, withdrawalRules_1.validateWithdrawalSubmission)({
        asset: "TRC20",
        network: "TRC20",
        address: "T" + "A".repeat(33),
        amount: 25.5
    });
    assert_1.default.equal(ok.valid, true);
    assert_1.default.equal(ok.platformAsset, "USDT_TRC20");
    assert_1.default.equal(ok.networkType, "TRC20");
});
(0, node_test_1.test)("computes network and platform fees transparently and keeps the net amount non-negative", () => {
    const fees = (0, withdrawalRules_1.computeWithdrawalFees)({ amount: 100, networkFee: 1.5, platformFeePercent: 2 });
    assert_1.default.equal(fees.networkFee, "1.50000000");
    assert_1.default.equal(fees.platformFee, "2.00000000");
    assert_1.default.equal(fees.totalFee, "3.50000000");
    assert_1.default.equal(fees.netAmount, "96.50000000");
    const capped = (0, withdrawalRules_1.computeWithdrawalFees)({ amount: 1, networkFee: 5, platformFeePercent: 0 });
    assert_1.default.equal(capped.netAmount, "0.00000000");
});
