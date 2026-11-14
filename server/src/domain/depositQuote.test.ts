import assert from "assert";
import { test } from "node:test";
import {
  DEPOSIT_MAX_USD,
  DEPOSIT_MIN_USD,
  cryptoToUsdAmount,
  usdToCryptoAmount,
  validateUsdAmountInput,
  withinConversionTolerance
} from "./depositQuote";

test("validates USD deposit amounts against the platform band", () => {
  assert.equal(validateUsdAmountInput("").valid, false);
  assert.equal(validateUsdAmountInput("").empty, true);

  assert.equal(validateUsdAmountInput("abc").valid, false);
  assert.equal(validateUsdAmountInput("10.999").valid, false);

  const tooSmall = validateUsdAmountInput("50");
  assert.equal(tooSmall.valid, false);
  assert.equal(tooSmall.message, `The minimum deposit is $${DEPOSIT_MIN_USD.toLocaleString("en-US")}.`);

  const tooLarge = validateUsdAmountInput(String(DEPOSIT_MAX_USD + 1));
  assert.equal(tooLarge.valid, false);
  assert.equal(tooLarge.message, `The maximum deposit is $${DEPOSIT_MAX_USD.toLocaleString("en-US")}.`);

  assert.equal(validateUsdAmountInput("3000").valid, true);
  assert.equal(validateUsdAmountInput("3000.50").valid, true);
});

test("converts USD to the asset amount using the verified rate", () => {
  const btc = usdToCryptoAmount(3000, 90000, 8);
  assert.equal(btc, 0.03333333);

  const eth = usdToCryptoAmount(1000, 2500, 8);
  assert.equal(eth, 0.4);

  const usdt = usdToCryptoAmount(500, 1, 6);
  assert.equal(usdt, 500);

  assert.equal(usdToCryptoAmount(0, 90000, 8), null);
  assert.equal(usdToCryptoAmount(-5, 90000, 8), null);
  assert.equal(usdToCryptoAmount(3000, 0, 8), null);
  assert.equal(usdToCryptoAmount(0.000001, 90000, 8), null);
});

test("converts an asset amount back to its USD value", () => {
  assert.equal(cryptoToUsdAmount(0.5, 60000), 30000);
  assert.equal(cryptoToUsdAmount(500, 1), 500);
  assert.equal(cryptoToUsdAmount(0, 60000), null);
  assert.equal(cryptoToUsdAmount(0.5, 0), null);
});

test("tolerates small rate drift but rejects divergent amounts", () => {
  assert.equal(withinConversionTolerance(0.0333, 0.03333333), true);
  assert.equal(withinConversionTolerance(0.04, 0.03333333), false);
  assert.equal(withinConversionTolerance(0.5, 0), false);
});
