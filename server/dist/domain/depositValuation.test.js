"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const depositValuation_1 = require("./depositValuation");
(0, node_test_1.test)("credits a stablecoin deposit at par with no market conversion", () => {
    const erc20 = (0, depositValuation_1.valueDepositInUsd)({ cryptoType: "ERC20", quantity: "100.00000000" });
    assert_1.default.equal(erc20.usd, "100.00000000");
    assert_1.default.equal(erc20.basis, "stablecoin_par");
    assert_1.default.equal(erc20.price, null);
    const trc20 = (0, depositValuation_1.valueDepositInUsd)({ cryptoType: "TRC20", quantity: "100" });
    assert_1.default.equal(trc20.usd, "100.00000000");
    assert_1.default.equal(trc20.basis, "stablecoin_par");
});
(0, node_test_1.test)("never applies a market price to a stablecoin deposit", () => {
    // Even a wrong/volatile price feed must not change the credited amount.
    const valued = (0, depositValuation_1.valueDepositInUsd)({ cryptoType: "ERC20", quantity: "100", price: 0.87 });
    assert_1.default.equal(valued.usd, "100.00000000");
    assert_1.default.equal(valued.basis, "stablecoin_par");
    assert_1.default.equal(valued.price, null);
});
(0, node_test_1.test)("preserves a volatile deposit quantity and values it with the market price separately", () => {
    const btc = (0, depositValuation_1.valueDepositInUsd)({ cryptoType: "BTC", quantity: "0.50000000", price: 60000 });
    assert_1.default.equal(btc.usd, "30000.00000000");
    assert_1.default.equal(btc.basis, "market_price");
    assert_1.default.equal(btc.price, "60000.00000000");
});
(0, node_test_1.test)("reports a volatile deposit as unavailable when no price is known", () => {
    const eth = (0, depositValuation_1.valueDepositInUsd)({ cryptoType: "ETH", quantity: "2.00000000", price: null });
    assert_1.default.equal(eth.usd, null);
    assert_1.default.equal(eth.basis, "unavailable");
});
(0, node_test_1.test)("a price-provider outage never collapses a volatile deposit to zero", () => {
    for (const cryptoType of ["BTC", "ETH", "SOL"]) {
        const valued = (0, depositValuation_1.valueDepositInUsd)({ cryptoType, quantity: "1.00000000", price: null });
        assert_1.default.equal(valued.usd, null, `${cryptoType} must be unavailable, not zero`);
        assert_1.default.notEqual(valued.usd, "0.00000000");
    }
});
(0, node_test_1.test)("maps crypto types to the correct market symbol", () => {
    assert_1.default.equal((0, depositValuation_1.depositAssetSymbol)("BTC"), "BTC");
    assert_1.default.equal((0, depositValuation_1.depositAssetSymbol)("ERC20"), "USDT");
    assert_1.default.equal((0, depositValuation_1.depositAssetSymbol)("TRC20"), "USDT");
    assert_1.default.equal((0, depositValuation_1.depositAssetSymbol)("DOGE"), null);
    assert_1.default.equal((0, depositValuation_1.isStablecoinDeposit)("TRC20"), true);
    assert_1.default.equal((0, depositValuation_1.isStablecoinDeposit)("SOL"), false);
});
