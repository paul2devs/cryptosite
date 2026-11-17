"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const depositRules_1 = require("./depositRules");
(0, node_test_1.test)("accepts only the supported asset and network combinations", () => {
    assert_1.default.deepEqual(depositRules_1.SUPPORTED_DEPOSIT_CRYPTO_TYPES, [
        "BTC",
        "ETH",
        "SOL",
        "ERC20",
        "TRC20"
    ]);
    assert_1.default.equal((0, depositRules_1.isSupportedDepositCryptoType)("BTC"), true);
    assert_1.default.equal((0, depositRules_1.isSupportedDepositCryptoType)("USDT"), false);
    assert_1.default.equal((0, depositRules_1.isSupportedDepositCryptoType)("DOGE"), false);
    assert_1.default.equal((0, depositRules_1.isSupportedDepositCryptoType)(""), false);
    assert_1.default.equal((0, depositRules_1.isSupportedDepositCryptoType)(null), false);
    assert_1.default.equal((0, depositRules_1.isSupportedDepositCryptoType)(42), false);
});
(0, node_test_1.test)("maps each crypto type to the correct platform asset and network", () => {
    assert_1.default.equal((0, depositRules_1.resolvePlatformAsset)("BTC"), "BTC");
    assert_1.default.equal((0, depositRules_1.resolvePlatformAsset)("ETH"), "ETH");
    assert_1.default.equal((0, depositRules_1.resolvePlatformAsset)("SOL"), "SOL");
    assert_1.default.equal((0, depositRules_1.resolvePlatformAsset)("ERC20"), "USDT_ERC20");
    assert_1.default.equal((0, depositRules_1.resolvePlatformAsset)("TRC20"), "USDT_TRC20");
    assert_1.default.equal((0, depositRules_1.resolveDepositNetwork)("BTC"), "Bitcoin");
    assert_1.default.equal((0, depositRules_1.resolveDepositNetwork)("TRC20"), "TRC20");
    assert_1.default.equal((0, depositRules_1.resolveDepositNetwork)("ERC20"), "ERC20");
    assert_1.default.throws(() => (0, depositRules_1.resolvePlatformAsset)("DOGE"));
    assert_1.default.throws(() => (0, depositRules_1.resolveDepositNetwork)("DOGE"));
});
(0, node_test_1.test)("normalizes transaction hashes so whitespace cannot resubmit the same payment", () => {
    assert_1.default.equal((0, depositRules_1.normalizeTxHash)("  abc12345  "), "abc12345");
    assert_1.default.equal((0, depositRules_1.normalizeTxHash)("abc12345\n"), "abc12345");
    assert_1.default.equal((0, depositRules_1.normalizeTxHash)(undefined), "");
    assert_1.default.equal((0, depositRules_1.normalizeTxHash)(12345), "");
    const first = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "BTC",
        amount: 1,
        txHash: "  deadbeefdeadbeef  "
    });
    const second = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "BTC",
        amount: 1,
        txHash: "deadbeefdeadbeef"
    });
    assert_1.default.equal(first.normalizedTxHash, second.normalizedTxHash);
});
(0, node_test_1.test)("rejects invalid payment submissions", () => {
    const missingHash = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "BTC",
        amount: 1,
        txHash: "short"
    });
    assert_1.default.equal(missingHash.valid, false);
    assert_1.default.ok(missingHash.errors.includes("A valid blockchain transaction hash is required to submit a deposit."));
    const nonPositive = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "ETH",
        amount: 0,
        txHash: "0xabcdef123456"
    });
    assert_1.default.equal(nonPositive.valid, false);
    assert_1.default.ok(nonPositive.errors.includes("Deposit amount must be a positive number."));
    const negative = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "ETH",
        amount: -5,
        txHash: "0xabcdef123456"
    });
    assert_1.default.equal(negative.valid, false);
    const notANumber = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "ETH",
        amount: "not-a-number",
        txHash: "0xabcdef123456"
    });
    assert_1.default.equal(notANumber.valid, false);
    const wrongNetwork = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "USDT",
        amount: 10,
        txHash: "0xabcdef123456"
    });
    assert_1.default.equal(wrongNetwork.valid, false);
    assert_1.default.ok(wrongNetwork.errors.includes("Select a supported asset and network before submitting a deposit."));
    const valid = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "TRC20",
        amount: 25.5,
        txHash: "0xabcdef123456"
    });
    assert_1.default.equal(valid.valid, true);
    assert_1.default.deepEqual(valid.errors, []);
    assert_1.default.equal(valid.numericAmount, 25.5);
});
(0, node_test_1.test)("enforces the asset decimal precision on both ends", () => {
    assert_1.default.equal(depositRules_1.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE.ERC20, 6);
    assert_1.default.equal(depositRules_1.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE.BTC, 8);
    assert_1.default.equal((0, depositRules_1.exceedsDecimalPrecision)(0.12345678, 8), false);
    assert_1.default.equal((0, depositRules_1.exceedsDecimalPrecision)(0.123456789, 8), true);
    assert_1.default.equal((0, depositRules_1.exceedsDecimalPrecision)(1.234567, 6), false);
    assert_1.default.equal((0, depositRules_1.exceedsDecimalPrecision)(1.2345678, 6), true);
    const tooPreciseBtc = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "BTC",
        amount: 0.123456789,
        txHash: "deadbeefdeadbeef"
    });
    assert_1.default.equal(tooPreciseBtc.valid, false);
    assert_1.default.ok(tooPreciseBtc.errors.includes("Amount supports at most 8 decimal places for this asset."));
    const preciseBtc = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "BTC",
        amount: 0.12345678,
        txHash: "deadbeefdeadbeef"
    });
    assert_1.default.equal(preciseBtc.valid, true);
    const tooPreciseUsdt = (0, depositRules_1.validateDepositSubmission)({
        cryptoType: "TRC20",
        amount: 1.2345678,
        txHash: "0xabcdef123456"
    });
    assert_1.default.equal(tooPreciseUsdt.valid, false);
    assert_1.default.ok(tooPreciseUsdt.errors.includes("Amount supports at most 6 decimal places for this asset."));
});
(0, node_test_1.test)("validates a deposit intent without requiring a transaction hash", () => {
    const valid = (0, depositRules_1.validateDepositIntent)({
        cryptoType: "BTC",
        cryptoAmount: 0.25,
        usdAmount: 15000
    });
    assert_1.default.equal(valid.valid, true);
    assert_1.default.deepEqual(valid.errors, []);
    assert_1.default.equal(valid.numericCryptoAmount, 0.25);
    assert_1.default.equal(valid.numericUsdAmount, 15000);
    const usdOnly = (0, depositRules_1.validateDepositIntent)({
        cryptoType: "TRC20",
        cryptoAmount: null,
        usdAmount: 100
    });
    assert_1.default.equal(usdOnly.valid, true);
    assert_1.default.equal(usdOnly.numericCryptoAmount, null);
    const noAmount = (0, depositRules_1.validateDepositIntent)({
        cryptoType: "ETH",
        cryptoAmount: null,
        usdAmount: null
    });
    assert_1.default.equal(noAmount.valid, false);
    assert_1.default.ok(noAmount.errors.includes("Enter a deposit amount."));
    const unsupported = (0, depositRules_1.validateDepositIntent)({
        cryptoType: "USDT",
        cryptoAmount: 10,
        usdAmount: null
    });
    assert_1.default.equal(unsupported.valid, false);
    assert_1.default.ok(unsupported.errors.includes("Select a supported asset and network before creating a deposit."));
    const nonPositive = (0, depositRules_1.validateDepositIntent)({
        cryptoType: "SOL",
        cryptoAmount: 0,
        usdAmount: null
    });
    assert_1.default.equal(nonPositive.valid, false);
    const tooPrecise = (0, depositRules_1.validateDepositIntent)({
        cryptoType: "TRC20",
        cryptoAmount: 1.2345678,
        usdAmount: null
    });
    assert_1.default.equal(tooPrecise.valid, false);
    assert_1.default.ok(tooPrecise.errors.includes("Amount supports at most 6 decimal places for this asset."));
});
(0, node_test_1.test)("describes deposit statuses with the correct label and tone", () => {
    assert_1.default.deepEqual({ label: (0, depositRules_1.describeDepositStatus)("Pending").label, tone: (0, depositRules_1.describeDepositStatus)("Pending").tone }, { label: "Waiting for payment", tone: "gold" });
    assert_1.default.equal((0, depositRules_1.describeDepositStatus)("Pending").message, "Waiting for your crypto transfer to arrive.");
    assert_1.default.deepEqual({
        label: (0, depositRules_1.describeDepositStatus)("Approved").label,
        tone: (0, depositRules_1.describeDepositStatus)("Approved").tone
    }, { label: "Completed", tone: "positive" });
    assert_1.default.deepEqual({
        label: (0, depositRules_1.describeDepositStatus)("Rejected").label,
        tone: (0, depositRules_1.describeDepositStatus)("Rejected").tone
    }, { label: "Rejected", tone: "negative" });
    assert_1.default.equal((0, depositRules_1.describeDepositStatus)("AnythingElse").label, "Waiting for payment");
    assert_1.default.equal((0, depositRules_1.describeDepositStatus)("AWAITING_ADMIN_APPROVAL").label, "Awaiting approval");
});
