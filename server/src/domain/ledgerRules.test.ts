import assert from "assert";
import { test } from "node:test";
import { buildLedgerIdempotencyKey } from "./ledgerRules";

test("produces a stable ledger key so a repeated confirmation credits exactly once", () => {
  const first = buildLedgerIdempotencyKey(
    "deposit",
    "11111111-1111-1111-1111-111111111111",
    "confirmed_deposits"
  );
  const repeat = buildLedgerIdempotencyKey(
    "deposit",
    "11111111-1111-1111-1111-111111111111",
    "confirmed_deposits"
  );
  assert.equal(first, repeat);
  assert.equal(first, "deposit:11111111-1111-1111-1111-111111111111:confirmed_deposits");
});

test("keeps distinct keys for different sources, ids and account codes", () => {
  const base = buildLedgerIdempotencyKey("deposit", "abc", "confirmed_deposits");
  const otherSource = buildLedgerIdempotencyKey("withdrawal", "abc", "confirmed_deposits");
  const otherId = buildLedgerIdempotencyKey("deposit", "abcd", "confirmed_deposits");
  const otherCode = buildLedgerIdempotencyKey("deposit", "abc", "invested_principal");

  assert.notEqual(base, otherSource);
  assert.notEqual(base, otherId);
  assert.notEqual(base, otherCode);
  assert.equal(new Set([base, otherSource, otherId, otherCode]).size, 4);
});
