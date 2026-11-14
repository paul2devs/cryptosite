import assert from "assert";
import { test } from "node:test";
import {
  DEPOSIT_DECIMALS_BY_CRYPTO_TYPE,
  SUPPORTED_DEPOSIT_CRYPTO_TYPES,
  describeDepositStatus,
  exceedsDecimalPrecision,
  isSupportedDepositCryptoType,
  normalizeTxHash,
  resolveDepositNetwork,
  resolvePlatformAsset,
  validateDepositSubmission
} from "./depositRules";

test("accepts only the supported asset and network combinations", () => {
  assert.deepEqual(SUPPORTED_DEPOSIT_CRYPTO_TYPES, [
    "BTC",
    "ETH",
    "SOL",
    "ERC20",
    "TRC20"
  ]);

  assert.equal(isSupportedDepositCryptoType("BTC"), true);
  assert.equal(isSupportedDepositCryptoType("USDT"), false);
  assert.equal(isSupportedDepositCryptoType("DOGE"), false);
  assert.equal(isSupportedDepositCryptoType(""), false);
  assert.equal(isSupportedDepositCryptoType(null), false);
  assert.equal(isSupportedDepositCryptoType(42), false);
});

test("maps each crypto type to the correct platform asset and network", () => {
  assert.equal(resolvePlatformAsset("BTC"), "BTC");
  assert.equal(resolvePlatformAsset("ETH"), "ETH");
  assert.equal(resolvePlatformAsset("SOL"), "SOL");
  assert.equal(resolvePlatformAsset("ERC20"), "USDT_ERC20");
  assert.equal(resolvePlatformAsset("TRC20"), "USDT_TRC20");

  assert.equal(resolveDepositNetwork("BTC"), "Bitcoin");
  assert.equal(resolveDepositNetwork("TRC20"), "TRC20");
  assert.equal(resolveDepositNetwork("ERC20"), "ERC20");

  assert.throws(() => resolvePlatformAsset("DOGE" as never));
  assert.throws(() => resolveDepositNetwork("DOGE" as never));
});

test("normalizes transaction hashes so whitespace cannot resubmit the same payment", () => {
  assert.equal(normalizeTxHash("  abc12345  "), "abc12345");
  assert.equal(normalizeTxHash("abc12345\n"), "abc12345");
  assert.equal(normalizeTxHash(undefined), "");
  assert.equal(normalizeTxHash(12345), "");

  const first = validateDepositSubmission({
    cryptoType: "BTC",
    amount: 1,
    txHash: "  deadbeefdeadbeef  "
  });
  const second = validateDepositSubmission({
    cryptoType: "BTC",
    amount: 1,
    txHash: "deadbeefdeadbeef"
  });
  assert.equal(first.normalizedTxHash, second.normalizedTxHash);
});

test("rejects invalid payment submissions", () => {
  const missingHash = validateDepositSubmission({
    cryptoType: "BTC",
    amount: 1,
    txHash: "short"
  });
  assert.equal(missingHash.valid, false);
  assert.ok(
    missingHash.errors.includes(
      "A valid blockchain transaction hash is required to submit a deposit."
    )
  );

  const nonPositive = validateDepositSubmission({
    cryptoType: "ETH",
    amount: 0,
    txHash: "0xabcdef123456"
  });
  assert.equal(nonPositive.valid, false);
  assert.ok(nonPositive.errors.includes("Deposit amount must be a positive number."));

  const negative = validateDepositSubmission({
    cryptoType: "ETH",
    amount: -5,
    txHash: "0xabcdef123456"
  });
  assert.equal(negative.valid, false);

  const notANumber = validateDepositSubmission({
    cryptoType: "ETH",
    amount: "not-a-number",
    txHash: "0xabcdef123456"
  });
  assert.equal(notANumber.valid, false);

  const wrongNetwork = validateDepositSubmission({
    cryptoType: "USDT",
    amount: 10,
    txHash: "0xabcdef123456"
  });
  assert.equal(wrongNetwork.valid, false);
  assert.ok(
    wrongNetwork.errors.includes(
      "Select a supported asset and network before submitting a deposit."
    )
  );

  const valid = validateDepositSubmission({
    cryptoType: "TRC20",
    amount: 25.5,
    txHash: "0xabcdef123456"
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.numericAmount, 25.5);
});

test("enforces the asset decimal precision on both ends", () => {
  assert.equal(DEPOSIT_DECIMALS_BY_CRYPTO_TYPE.ERC20, 6);
  assert.equal(DEPOSIT_DECIMALS_BY_CRYPTO_TYPE.BTC, 8);

  assert.equal(exceedsDecimalPrecision(0.12345678, 8), false);
  assert.equal(exceedsDecimalPrecision(0.123456789, 8), true);
  assert.equal(exceedsDecimalPrecision(1.234567, 6), false);
  assert.equal(exceedsDecimalPrecision(1.2345678, 6), true);

  const tooPreciseBtc = validateDepositSubmission({
    cryptoType: "BTC",
    amount: 0.123456789,
    txHash: "deadbeefdeadbeef"
  });
  assert.equal(tooPreciseBtc.valid, false);
  assert.ok(
    tooPreciseBtc.errors.includes(
      "Amount supports at most 8 decimal places for this asset."
    )
  );

  const preciseBtc = validateDepositSubmission({
    cryptoType: "BTC",
    amount: 0.12345678,
    txHash: "deadbeefdeadbeef"
  });
  assert.equal(preciseBtc.valid, true);

  const tooPreciseUsdt = validateDepositSubmission({
    cryptoType: "TRC20",
    amount: 1.2345678,
    txHash: "0xabcdef123456"
  });
  assert.equal(tooPreciseUsdt.valid, false);
  assert.ok(
    tooPreciseUsdt.errors.includes(
      "Amount supports at most 6 decimal places for this asset."
    )
  );
});

test("describes deposit statuses with the correct label and tone", () => {
  assert.deepEqual(describeDepositStatus("Pending"), {
    label: "Pending",
    tone: "gold"
  });
  assert.deepEqual(describeDepositStatus("Approved"), {
    label: "Confirmed",
    tone: "positive"
  });
  assert.deepEqual(describeDepositStatus("Rejected"), {
    label: "Rejected",
    tone: "negative"
  });
  assert.deepEqual(describeDepositStatus("AnythingElse"), {
    label: "Pending",
    tone: "gold"
  });
});
