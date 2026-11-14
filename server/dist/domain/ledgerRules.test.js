"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const ledgerRules_1 = require("./ledgerRules");
(0, node_test_1.test)("produces a stable ledger key so a repeated confirmation credits exactly once", () => {
    const first = (0, ledgerRules_1.buildLedgerIdempotencyKey)("deposit", "11111111-1111-1111-1111-111111111111", "confirmed_deposits");
    const repeat = (0, ledgerRules_1.buildLedgerIdempotencyKey)("deposit", "11111111-1111-1111-1111-111111111111", "confirmed_deposits");
    assert_1.default.equal(first, repeat);
    assert_1.default.equal(first, "deposit:11111111-1111-1111-1111-111111111111:confirmed_deposits");
});
(0, node_test_1.test)("keeps distinct keys for different sources, ids and account codes", () => {
    const base = (0, ledgerRules_1.buildLedgerIdempotencyKey)("deposit", "abc", "confirmed_deposits");
    const otherSource = (0, ledgerRules_1.buildLedgerIdempotencyKey)("withdrawal", "abc", "confirmed_deposits");
    const otherId = (0, ledgerRules_1.buildLedgerIdempotencyKey)("deposit", "abcd", "confirmed_deposits");
    const otherCode = (0, ledgerRules_1.buildLedgerIdempotencyKey)("deposit", "abc", "invested_principal");
    assert_1.default.notEqual(base, otherSource);
    assert_1.default.notEqual(base, otherId);
    assert_1.default.notEqual(base, otherCode);
    assert_1.default.equal(new Set([base, otherSource, otherId, otherCode]).size, 4);
});
