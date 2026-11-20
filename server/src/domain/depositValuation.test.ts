import assert from "assert";
import { test } from "node:test";
import { depositAssetSymbol, isStablecoinDeposit, valueDepositInUsd } from "./depositValuation";

test("credits a stablecoin deposit at par with no market conversion", () => {
  const erc20 = valueDepositInUsd({ cryptoType: "ERC20", quantity: "100.00000000" });
  assert.equal(erc20.usd, "100.00000000");
  assert.equal(erc20.basis, "stablecoin_par");
  assert.equal(erc20.price, null);

  const trc20 = valueDepositInUsd({ cryptoType: "TRC20", quantity: "100" });
  assert.equal(trc20.usd, "100.00000000");
  assert.equal(trc20.basis, "stablecoin_par");
});

test("never applies a market price to a stablecoin deposit", () => {
  // Even a wrong/volatile price feed must not change the credited amount.
  const valued = valueDepositInUsd({ cryptoType: "ERC20", quantity: "100", price: 0.87 });
  assert.equal(valued.usd, "100.00000000");
  assert.equal(valued.basis, "stablecoin_par");
  assert.equal(valued.price, null);
});

test("preserves a volatile deposit quantity and values it with the market price separately", () => {
  const btc = valueDepositInUsd({ cryptoType: "BTC", quantity: "0.50000000", price: 60000 });
  assert.equal(btc.usd, "30000.00000000");
  assert.equal(btc.basis, "market_price");
  assert.equal(btc.price, "60000.00000000");
});

test("reports a volatile deposit as unavailable when no price is known", () => {
  const eth = valueDepositInUsd({ cryptoType: "ETH", quantity: "2.00000000", price: null });
  assert.equal(eth.usd, null);
  assert.equal(eth.basis, "unavailable");
});

test("a price-provider outage never collapses a volatile deposit to zero", () => {
  for (const cryptoType of ["BTC", "ETH", "SOL"]) {
    const valued = valueDepositInUsd({ cryptoType, quantity: "1.00000000", price: null });
    assert.equal(valued.usd, null, `${cryptoType} must be unavailable, not zero`);
    assert.notEqual(valued.usd, "0.00000000");
  }
});

test("maps crypto types to the correct market symbol", () => {
  assert.equal(depositAssetSymbol("BTC"), "BTC");
  assert.equal(depositAssetSymbol("ERC20"), "USDT");
  assert.equal(depositAssetSymbol("TRC20"), "USDT");
  assert.equal(depositAssetSymbol("DOGE"), null);
  assert.equal(isStablecoinDeposit("TRC20"), true);
  assert.equal(isStablecoinDeposit("SOL"), false);
});
