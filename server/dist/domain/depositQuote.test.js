"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const depositQuote_1 = require("./depositQuote");
(0, node_test_1.test)("validates USD deposit amounts against the platform band", () => {
    assert_1.default.equal((0, depositQuote_1.validateUsdAmountInput)("").valid, false);
    assert_1.default.equal((0, depositQuote_1.validateUsdAmountInput)("").empty, true);
    assert_1.default.equal((0, depositQuote_1.validateUsdAmountInput)("abc").valid, false);
    assert_1.default.equal((0, depositQuote_1.validateUsdAmountInput)("10.999").valid, false);
    const tooSmall = (0, depositQuote_1.validateUsdAmountInput)("50");
    assert_1.default.equal(tooSmall.valid, false);
    assert_1.default.equal(tooSmall.message, `The minimum deposit is $${depositQuote_1.DEPOSIT_MIN_USD.toLocaleString("en-US")}.`);
    const tooLarge = (0, depositQuote_1.validateUsdAmountInput)(String(depositQuote_1.DEPOSIT_MAX_USD + 1));
    assert_1.default.equal(tooLarge.valid, false);
    assert_1.default.equal(tooLarge.message, `The maximum deposit is $${depositQuote_1.DEPOSIT_MAX_USD.toLocaleString("en-US")}.`);
    assert_1.default.equal((0, depositQuote_1.validateUsdAmountInput)("3000").valid, true);
    assert_1.default.equal((0, depositQuote_1.validateUsdAmountInput)("3000.50").valid, true);
});
(0, node_test_1.test)("converts USD to the asset amount using the verified rate", () => {
    const btc = (0, depositQuote_1.usdToCryptoAmount)(3000, 90000, 8);
    assert_1.default.equal(btc, 0.03333333);
    const eth = (0, depositQuote_1.usdToCryptoAmount)(1000, 2500, 8);
    assert_1.default.equal(eth, 0.4);
    const usdt = (0, depositQuote_1.usdToCryptoAmount)(500, 1, 6);
    assert_1.default.equal(usdt, 500);
    assert_1.default.equal((0, depositQuote_1.usdToCryptoAmount)(0, 90000, 8), null);
    assert_1.default.equal((0, depositQuote_1.usdToCryptoAmount)(-5, 90000, 8), null);
    assert_1.default.equal((0, depositQuote_1.usdToCryptoAmount)(3000, 0, 8), null);
    assert_1.default.equal((0, depositQuote_1.usdToCryptoAmount)(0.000001, 90000, 8), null);
});
(0, node_test_1.test)("converts an asset amount back to its USD value", () => {
    assert_1.default.equal((0, depositQuote_1.cryptoToUsdAmount)(0.5, 60000), 30000);
    assert_1.default.equal((0, depositQuote_1.cryptoToUsdAmount)(500, 1), 500);
    assert_1.default.equal((0, depositQuote_1.cryptoToUsdAmount)(0, 60000), null);
    assert_1.default.equal((0, depositQuote_1.cryptoToUsdAmount)(0.5, 0), null);
});
(0, node_test_1.test)("tolerates small rate drift but rejects divergent amounts", () => {
    assert_1.default.equal((0, depositQuote_1.withinConversionTolerance)(0.0333, 0.03333333), true);
    assert_1.default.equal((0, depositQuote_1.withinConversionTolerance)(0.04, 0.03333333), false);
    assert_1.default.equal((0, depositQuote_1.withinConversionTolerance)(0.5, 0), false);
});
