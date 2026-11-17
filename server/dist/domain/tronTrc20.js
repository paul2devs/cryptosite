"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRC20_TRANSFER_SELECTOR = void 0;
exports.tronHexToBase58 = tronHexToBase58;
exports.decodeTrc20Transfer = decodeTrc20Transfer;
exports.rawTokenAmountToNumber = rawTokenAmountToNumber;
const crypto_1 = __importDefault(require("crypto"));
/**
 * TRON TRC20 transfer decoding.
 *
 * Tronscan's `/transaction-info` returns a TRC20 transfer as an ABI-encoded
 * `contractData.data` blob rather than the friendly `to_address` / `amount`
 * fields, and its addresses are 21-byte hex (`41…`) rather than the Base58
 * form users and configuration actually use. Both conversions live here so the
 * verifier compares like with like and so they can be unit tested against real
 * on-chain payloads.
 */
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
/** The TRC20 `transfer(address,uint256)` function selector. */
exports.TRC20_TRANSFER_SELECTOR = "a9059cbb";
function base58Encode(buffer) {
    let value = BigInt("0x" + (buffer.toString("hex") || "0"));
    const base = 58n;
    let output = "";
    while (value > 0n) {
        output = BASE58_ALPHABET[Number(value % base)] + output;
        value /= base;
    }
    // Preserve leading zero bytes as '1' (no TRON address has them, but a generic
    // encoder must not silently corrupt the value).
    for (const byte of buffer) {
        if (byte === 0x00) {
            output = "1" + output;
        }
        else {
            break;
        }
    }
    return output;
}
/**
 * Convert a TRON hex account address (`41…`, optionally `0x`-prefixed) into its
 * Base58Check form. Returns "" when the input is not a valid 21-byte address.
 */
function tronHexToBase58(hexAddress) {
    const clean = String(hexAddress || "")
        .trim()
        .replace(/^0x/i, "")
        .toLowerCase();
    if (!/^41[0-9a-f]{40}$/.test(clean)) {
        return "";
    }
    const payload = Buffer.from(clean, "hex");
    const checksum = crypto_1.default
        .createHash("sha256")
        .update(crypto_1.default.createHash("sha256").update(payload).digest())
        .digest()
        .subarray(0, 4);
    return base58Encode(Buffer.concat([payload, checksum]));
}
/**
 * Decode a TRC20 `transfer` call from `contractData.data`. Returns null when the
 * payload is not a well-formed TRC20 transfer, so a malformed or unrelated
 * contract call can never be mistaken for a USDT payment.
 */
function decodeTrc20Transfer(data) {
    const clean = String(data || "")
        .trim()
        .replace(/^0x/i, "")
        .toLowerCase();
    if (clean.length < 8 + 64 + 64 || clean.slice(0, 8) !== exports.TRC20_TRANSFER_SELECTOR) {
        return null;
    }
    const toWord = clean.slice(8, 8 + 64);
    const amountWord = clean.slice(8 + 64, 8 + 128);
    // Most TRC20 contracts encode the 21-byte (`41…`) address inside the 32-byte
    // word; some follow the ERC20 convention and encode only the 20-byte form.
    let toHex = toWord.slice(-42);
    if (!/^41[0-9a-f]{40}$/.test(toHex)) {
        const twentyByte = toWord.slice(-40);
        if (/^[0-9a-f]{40}$/.test(twentyByte)) {
            toHex = "41" + twentyByte;
        }
        else {
            return null;
        }
    }
    const amountRaw = BigInt("0x" + (amountWord.replace(/^0+/, "") || "0"));
    return { toHex, toBase58: tronHexToBase58(toHex), amountRaw };
}
/** Convert a raw token amount (smallest unit) into whole units. */
function rawTokenAmountToNumber(amountRaw, decimals) {
    const safeDecimals = Number.isFinite(decimals) && decimals >= 0 ? Math.floor(decimals) : 0;
    return Number(amountRaw) / Math.pow(10, safeDecimals);
}
