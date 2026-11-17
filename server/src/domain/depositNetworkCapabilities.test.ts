import assert from "assert";
import { test } from "node:test";
import {
  listDepositCapabilities,
  memoSupportSummary,
  resolveDepositCapability,
  resolveDepositNetworkLabel,
  validateDepositMemo
} from "./depositNetworkCapabilities";
import { SUPPORTED_DEPOSIT_CRYPTO_TYPES } from "./depositRules";

test("describes one capability per supported asset/network", () => {
  const capabilities = listDepositCapabilities();
  assert.equal(capabilities.length, SUPPORTED_DEPOSIT_CRYPTO_TYPES.length);

  const cryptoTypes = capabilities.map((capability) => capability.cryptoType);
  for (const expected of SUPPORTED_DEPOSIT_CRYPTO_TYPES) {
    assert.ok(cryptoTypes.includes(expected), `missing capability for ${expected}`);
  }

  const trc20 = resolveDepositCapability("TRC20");
  assert.equal(trc20.symbol, "USDT");
  assert.equal(trc20.networkLabel, "Tron (TRC20)");
  assert.equal(trc20.networkType, "TRC20");
  assert.equal(trc20.decimals, 6);
  assert.equal(trc20.platformAsset, "USDT_TRC20");

  const erc20 = resolveDepositCapability("ERC20");
  assert.equal(erc20.symbol, "USDT");
  assert.equal(erc20.networkType, "ERC20");
  assert.equal(erc20.decimals, 6);
  assert.equal(erc20.platformAsset, "USDT_ERC20");

  const btc = resolveDepositCapability("BTC");
  assert.equal(btc.networkType, "Bitcoin");
  assert.equal(btc.decimals, 8);
});

test("every configured network has a positive confirmation threshold and a warning", () => {
  for (const capability of listDepositCapabilities()) {
    assert.ok(
      Number.isInteger(capability.minConfirmations) && capability.minConfirmations >= 0,
      `${capability.cryptoType} has an invalid confirmation threshold`
    );
    assert.ok(capability.sendingInstruction.length > 0);
    assert.ok(capability.networkWarning.length > 0);
  }

  assert.equal(resolveDepositNetworkLabel("TRC20"), "Tron (TRC20)");
  assert.equal(resolveDepositNetworkLabel("ERC20"), "Ethereum (ERC20)");
});

test("no currently supported network claims memo support", () => {
  for (const capability of listDepositCapabilities()) {
    assert.equal(
      capability.memo.supported,
      false,
      `${capability.cryptoType} must not claim memo support`
    );
    assert.equal(capability.memo.required, false);
    assert.equal(capability.memo.label, null);
    assert.equal(capability.memo.pattern, null);
  }

  const summary = memoSupportSummary();
  assert.equal(summary.length, SUPPORTED_DEPOSIT_CRYPTO_TYPES.length);
  assert.equal(
    summary.some((entry) => entry.memoSupported),
    false
  );
});

test("a memo supplied to a network without memo support is discarded, not stored", () => {
  const btc = resolveDepositCapability("BTC");
  const result = validateDepositMemo(btc, "123456");
  assert.equal(result.valid, true);
  assert.equal(result.memo, null, "memo must not be persisted for Bitcoin");
  assert.equal(result.error, null);

  const trc20 = resolveDepositCapability("TRC20");
  const ignored = validateDepositMemo(trc20, "  anything  ");
  assert.equal(ignored.memo, null);
  assert.equal(ignored.valid, true);

  const empty = validateDepositMemo(trc20, undefined);
  assert.equal(empty.valid, true);
  assert.equal(empty.memo, null);
});

test("resolveDepositCapability rejects unsupported crypto types", () => {
  assert.throws(() => resolveDepositCapability("DOGE" as never));
  assert.throws(() => resolveDepositNetworkLabel("DOGE" as never));
});
