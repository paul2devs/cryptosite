"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const depositReference_1 = require("./depositReference");
(0, node_test_1.test)("generates a unique, correctly formatted NX- reference", () => {
    const reference = (0, depositReference_1.generateDepositReference)();
    assert_1.default.ok(reference.startsWith(`${depositReference_1.DEPOSIT_REFERENCE_PREFIX}-`));
    assert_1.default.equal(reference.length, depositReference_1.DEPOSIT_REFERENCE_PREFIX.length + 1 + depositReference_1.DEPOSIT_REFERENCE_BODY_LENGTH);
    assert_1.default.equal((0, depositReference_1.isDepositReference)(reference), true);
    const body = reference.slice(depositReference_1.DEPOSIT_REFERENCE_PREFIX.length + 1);
    for (const character of body) {
        assert_1.default.ok(depositReference_1.DEPOSIT_REFERENCE_ALPHABET.includes(character), `Unexpected character "${character}" in reference body`);
    }
    // Ambiguous characters must never be emitted, so a user can read it back.
    assert_1.default.equal(/[01OIL]/.test(body), false);
});
(0, node_test_1.test)("never reuses a reference across many generations", () => {
    const seen = new Set();
    const total = 5000;
    for (let index = 0; index < total; index += 1) {
        seen.add((0, depositReference_1.generateDepositReference)());
    }
    assert_1.default.equal(seen.size, total);
});
(0, node_test_1.test)("validates and normalizes references without accepting malformed input", () => {
    assert_1.default.equal((0, depositReference_1.normalizeDepositReference)("nx-7k29p4q8"), "NX-7K29P4Q8");
    assert_1.default.equal((0, depositReference_1.normalizeDepositReference)("  NX-7K29P4Q8  "), "NX-7K29P4Q8");
    assert_1.default.equal((0, depositReference_1.isDepositReference)("NX-7K29P4Q8"), true);
    assert_1.default.equal((0, depositReference_1.isDepositReference)("nx-7k29p4q8"), true);
    assert_1.default.equal((0, depositReference_1.isDepositReference)("NX-7K29P4Q"), false, "too short");
    assert_1.default.equal((0, depositReference_1.isDepositReference)("NX-7K29P4Q88"), false, "too long");
    assert_1.default.equal((0, depositReference_1.isDepositReference)("NX7K29P4Q8"), false, "missing separator");
    assert_1.default.equal((0, depositReference_1.isDepositReference)("AB-7K29P4Q8"), false, "wrong prefix");
    assert_1.default.equal((0, depositReference_1.isDepositReference)("NX-7K29P4O8"), false, "ambiguous character O");
    assert_1.default.equal((0, depositReference_1.isDepositReference)("NX-7K29P4I8"), false, "ambiguous character I");
    assert_1.default.equal((0, depositReference_1.isDepositReference)("NX-7K2 4Q8"), false, "contains a space");
    assert_1.default.equal((0, depositReference_1.isDepositReference)(""), false);
    assert_1.default.equal((0, depositReference_1.isDepositReference)(null), false);
    assert_1.default.equal((0, depositReference_1.isDepositReference)(12345678), false);
    assert_1.default.equal((0, depositReference_1.normalizeDepositReference)("not-a-reference"), null);
    assert_1.default.equal((0, depositReference_1.normalizeDepositReference)(undefined), null);
});
