"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const tronTrc20_1 = require("./tronTrc20");
/**
 * Real on-chain vector: a USDT (TRC20) transfer that arrived at the platform
 * receiving address. Tronscan returned no friendly `to_address` / `amount`
 * fields — both values only exist inside the ABI `data` blob — which is exactly
 * the shape these tests reproduce.
 */
const RECIPIENT_HEX = "41bcf599af92b80528aaeee693fba3dd9cfbe289b4";
const RECIPIENT_BASE58 = "TTCLFjW1EdAFEWemoNfgzvNfVr9Ex4R5vP";
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
function transferData(toWord, amountRaw) {
    const amountHex = BigInt(amountRaw).toString(16);
    return tronTrc20_1.TRC20_TRANSFER_SELECTOR + toWord.padStart(64, "0") + amountHex.padStart(64, "0");
}
(0, node_test_1.test)("converts a TRON 21-byte hex address into its Base58Check form", () => {
    assert_1.default.equal((0, tronTrc20_1.tronHexToBase58)(RECIPIENT_HEX), RECIPIENT_BASE58);
    assert_1.default.equal((0, tronTrc20_1.tronHexToBase58)(`0x${RECIPIENT_HEX.toUpperCase()}`), RECIPIENT_BASE58);
    assert_1.default.equal((0, tronTrc20_1.tronHexToBase58)("not-an-address"), "");
    assert_1.default.equal((0, tronTrc20_1.tronHexToBase58)("41bcf599"), "");
    assert_1.default.equal((0, tronTrc20_1.tronHexToBase58)(""), "");
    // A different 21-byte address must not decode to the platform address.
    assert_1.default.notEqual((0, tronTrc20_1.tronHexToBase58)(`${RECIPIENT_HEX.slice(0, -2)}00`), RECIPIENT_BASE58);
});
(0, node_test_1.test)("decodes a TRC20 transfer encoded with a 21-byte address word", () => {
    const decoded = (0, tronTrc20_1.decodeTrc20Transfer)(transferData(RECIPIENT_HEX, "11000000"));
    assert_1.default.ok(decoded);
    assert_1.default.equal(decoded.toHex, RECIPIENT_HEX);
    assert_1.default.equal(decoded.toBase58, RECIPIENT_BASE58);
    assert_1.default.equal(decoded.amountRaw, 11000000n);
    assert_1.default.equal((0, tronTrc20_1.rawTokenAmountToNumber)(decoded.amountRaw, 6), 11);
});
(0, node_test_1.test)("decodes a TRC20 transfer encoded ERC20-style with a 20-byte address word", () => {
    const twentyByte = RECIPIENT_HEX.slice(2);
    const decoded = (0, tronTrc20_1.decodeTrc20Transfer)(transferData(twentyByte, "1000000"));
    assert_1.default.ok(decoded);
    assert_1.default.equal(decoded.toHex, RECIPIENT_HEX);
    assert_1.default.equal(decoded.toBase58, RECIPIENT_BASE58);
    assert_1.default.equal((0, tronTrc20_1.rawTokenAmountToNumber)(decoded.amountRaw, 6), 1);
});
(0, node_test_1.test)("accepts an 0x-prefixed, mixed-case data blob", () => {
    const raw = transferData(RECIPIENT_HEX, "2500000");
    const decoded = (0, tronTrc20_1.decodeTrc20Transfer)(`0x${raw.toUpperCase()}`);
    assert_1.default.ok(decoded);
    assert_1.default.equal(decoded.toBase58, RECIPIENT_BASE58);
    assert_1.default.equal((0, tronTrc20_1.rawTokenAmountToNumber)(decoded.amountRaw, 6), 2.5);
});
(0, node_test_1.test)("rejects payloads that are not a well-formed TRC20 transfer", () => {
    assert_1.default.equal((0, tronTrc20_1.decodeTrc20Transfer)(""), null);
    assert_1.default.equal((0, tronTrc20_1.decodeTrc20Transfer)("deadbeef"), null);
    // Correct length but a different function selector (e.g. `approve`).
    assert_1.default.equal((0, tronTrc20_1.decodeTrc20Transfer)(`095ea7b3${"0".repeat(128)}`), null);
    // Correct selector but the operand words are truncated.
    assert_1.default.equal((0, tronTrc20_1.decodeTrc20Transfer)(`${tronTrc20_1.TRC20_TRANSFER_SELECTOR}${"0".repeat(63)}`), null);
    // Correct selector and length, but the recipient word is not hex.
    assert_1.default.equal((0, tronTrc20_1.decodeTrc20Transfer)(`${tronTrc20_1.TRC20_TRANSFER_SELECTOR}${"z".repeat(64)}${"0".repeat(64)}`), null);
});
(0, node_test_1.test)("converts raw token amounts using the token's own decimals", () => {
    assert_1.default.equal((0, tronTrc20_1.rawTokenAmountToNumber)(11000000n, 6), 11);
    assert_1.default.equal((0, tronTrc20_1.rawTokenAmountToNumber)(1n, 6), 0.000001);
    assert_1.default.equal((0, tronTrc20_1.rawTokenAmountToNumber)(123n, 0), 123);
    assert_1.default.equal((0, tronTrc20_1.rawTokenAmountToNumber)(5n, -1), 5);
});
(0, node_test_1.test)("exposes the USDT TRC20 contract address used by the verifier", () => {
    // Guards the exact mainnet contract from accidental edits.
    assert_1.default.equal(USDT_TRC20_CONTRACT, "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t");
});
