"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const depositNetworkCapabilities_1 = require("./depositNetworkCapabilities");
const depositRules_1 = require("./depositRules");
(0, node_test_1.test)("describes one capability per supported asset/network", () => {
    const capabilities = (0, depositNetworkCapabilities_1.listDepositCapabilities)();
    assert_1.default.equal(capabilities.length, depositRules_1.SUPPORTED_DEPOSIT_CRYPTO_TYPES.length);
    const cryptoTypes = capabilities.map((capability) => capability.cryptoType);
    for (const expected of depositRules_1.SUPPORTED_DEPOSIT_CRYPTO_TYPES) {
        assert_1.default.ok(cryptoTypes.includes(expected), `missing capability for ${expected}`);
    }
    const trc20 = (0, depositNetworkCapabilities_1.resolveDepositCapability)("TRC20");
    assert_1.default.equal(trc20.symbol, "USDT");
    assert_1.default.equal(trc20.networkLabel, "Tron (TRC20)");
    assert_1.default.equal(trc20.networkType, "TRC20");
    assert_1.default.equal(trc20.decimals, 6);
    assert_1.default.equal(trc20.platformAsset, "USDT_TRC20");
    const erc20 = (0, depositNetworkCapabilities_1.resolveDepositCapability)("ERC20");
    assert_1.default.equal(erc20.symbol, "USDT");
    assert_1.default.equal(erc20.networkType, "ERC20");
    assert_1.default.equal(erc20.decimals, 6);
    assert_1.default.equal(erc20.platformAsset, "USDT_ERC20");
    const btc = (0, depositNetworkCapabilities_1.resolveDepositCapability)("BTC");
    assert_1.default.equal(btc.networkType, "Bitcoin");
    assert_1.default.equal(btc.decimals, 8);
});
(0, node_test_1.test)("every configured network has a positive confirmation threshold and a warning", () => {
    for (const capability of (0, depositNetworkCapabilities_1.listDepositCapabilities)()) {
        assert_1.default.ok(Number.isInteger(capability.minConfirmations) && capability.minConfirmations >= 0, `${capability.cryptoType} has an invalid confirmation threshold`);
        assert_1.default.ok(capability.sendingInstruction.length > 0);
        assert_1.default.ok(capability.networkWarning.length > 0);
    }
    assert_1.default.equal((0, depositNetworkCapabilities_1.resolveDepositNetworkLabel)("TRC20"), "Tron (TRC20)");
    assert_1.default.equal((0, depositNetworkCapabilities_1.resolveDepositNetworkLabel)("ERC20"), "Ethereum (ERC20)");
});
(0, node_test_1.test)("no currently supported network claims memo support", () => {
    for (const capability of (0, depositNetworkCapabilities_1.listDepositCapabilities)()) {
        assert_1.default.equal(capability.memo.supported, false, `${capability.cryptoType} must not claim memo support`);
        assert_1.default.equal(capability.memo.required, false);
        assert_1.default.equal(capability.memo.label, null);
        assert_1.default.equal(capability.memo.pattern, null);
    }
    const summary = (0, depositNetworkCapabilities_1.memoSupportSummary)();
    assert_1.default.equal(summary.length, depositRules_1.SUPPORTED_DEPOSIT_CRYPTO_TYPES.length);
    assert_1.default.equal(summary.some((entry) => entry.memoSupported), false);
});
(0, node_test_1.test)("a memo supplied to a network without memo support is discarded, not stored", () => {
    const btc = (0, depositNetworkCapabilities_1.resolveDepositCapability)("BTC");
    const result = (0, depositNetworkCapabilities_1.validateDepositMemo)(btc, "123456");
    assert_1.default.equal(result.valid, true);
    assert_1.default.equal(result.memo, null, "memo must not be persisted for Bitcoin");
    assert_1.default.equal(result.error, null);
    const trc20 = (0, depositNetworkCapabilities_1.resolveDepositCapability)("TRC20");
    const ignored = (0, depositNetworkCapabilities_1.validateDepositMemo)(trc20, "  anything  ");
    assert_1.default.equal(ignored.memo, null);
    assert_1.default.equal(ignored.valid, true);
    const empty = (0, depositNetworkCapabilities_1.validateDepositMemo)(trc20, undefined);
    assert_1.default.equal(empty.valid, true);
    assert_1.default.equal(empty.memo, null);
});
(0, node_test_1.test)("resolveDepositCapability rejects unsupported crypto types", () => {
    assert_1.default.throws(() => (0, depositNetworkCapabilities_1.resolveDepositCapability)("DOGE"));
    assert_1.default.throws(() => (0, depositNetworkCapabilities_1.resolveDepositNetworkLabel)("DOGE"));
});
