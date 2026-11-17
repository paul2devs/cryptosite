import assert from "assert";
import { test } from "node:test";
import {
  DEPOSIT_REFERENCE_ALPHABET,
  DEPOSIT_REFERENCE_BODY_LENGTH,
  DEPOSIT_REFERENCE_PREFIX,
  generateDepositReference,
  isDepositReference,
  normalizeDepositReference
} from "./depositReference";

test("generates a unique, correctly formatted NX- reference", () => {
  const reference = generateDepositReference();
  assert.ok(reference.startsWith(`${DEPOSIT_REFERENCE_PREFIX}-`));
  assert.equal(reference.length, DEPOSIT_REFERENCE_PREFIX.length + 1 + DEPOSIT_REFERENCE_BODY_LENGTH);
  assert.equal(isDepositReference(reference), true);

  const body = reference.slice(DEPOSIT_REFERENCE_PREFIX.length + 1);
  for (const character of body) {
    assert.ok(
      DEPOSIT_REFERENCE_ALPHABET.includes(character),
      `Unexpected character "${character}" in reference body`
    );
  }

  // Ambiguous characters must never be emitted, so a user can read it back.
  assert.equal(/[01OIL]/.test(body), false);
});

test("never reuses a reference across many generations", () => {
  const seen = new Set<string>();
  const total = 5000;
  for (let index = 0; index < total; index += 1) {
    seen.add(generateDepositReference());
  }
  assert.equal(seen.size, total);
});

test("validates and normalizes references without accepting malformed input", () => {
  assert.equal(normalizeDepositReference("nx-7k29p4q8"), "NX-7K29P4Q8");
  assert.equal(normalizeDepositReference("  NX-7K29P4Q8  "), "NX-7K29P4Q8");

  assert.equal(isDepositReference("NX-7K29P4Q8"), true);
  assert.equal(isDepositReference("nx-7k29p4q8"), true);
  assert.equal(isDepositReference("NX-7K29P4Q"), false, "too short");
  assert.equal(isDepositReference("NX-7K29P4Q88"), false, "too long");
  assert.equal(isDepositReference("NX7K29P4Q8"), false, "missing separator");
  assert.equal(isDepositReference("AB-7K29P4Q8"), false, "wrong prefix");
  assert.equal(isDepositReference("NX-7K29P4O8"), false, "ambiguous character O");
  assert.equal(isDepositReference("NX-7K29P4I8"), false, "ambiguous character I");
  assert.equal(isDepositReference("NX-7K2 4Q8"), false, "contains a space");
  assert.equal(isDepositReference(""), false);
  assert.equal(isDepositReference(null), false);
  assert.equal(isDepositReference(12345678), false);

  assert.equal(normalizeDepositReference("not-a-reference"), null);
  assert.equal(normalizeDepositReference(undefined), null);
});
