"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPOSIT_REFERENCE_PATTERN = exports.DEPOSIT_REFERENCE_BODY_LENGTH = exports.DEPOSIT_REFERENCE_ALPHABET = exports.DEPOSIT_REFERENCE_PREFIX = void 0;
exports.generateDepositReference = generateDepositReference;
exports.isDepositReference = isDepositReference;
exports.normalizeDepositReference = normalizeDepositReference;
const crypto_1 = require("crypto");
/**
 * Unique, securely generated deposit reference.
 *
 * Format: `NX-XXXXXXXX` (for example `NX-7K29P4Q8`). The body uses an alphabet
 * with the visually ambiguous characters removed (0/O, 1/I/L) so a user can read
 * it back to support without transcription errors.
 *
 * The body is drawn with `crypto.randomInt`, which is uniform and
 * cryptographically secure: there is no modulo bias and no predictable sequence
 * a client could guess or replay.
 */
exports.DEPOSIT_REFERENCE_PREFIX = "NX";
/** Ambiguity-free alphabet: 8 digits + 23 letters = 31 symbols. */
exports.DEPOSIT_REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
exports.DEPOSIT_REFERENCE_BODY_LENGTH = 8;
exports.DEPOSIT_REFERENCE_PATTERN = new RegExp(`^${exports.DEPOSIT_REFERENCE_PREFIX}-[${exports.DEPOSIT_REFERENCE_ALPHABET}]{${exports.DEPOSIT_REFERENCE_BODY_LENGTH}}$`);
/** Generate a fresh reference. Callers must persist it behind a unique index. */
function generateDepositReference() {
    let body = "";
    for (let index = 0; index < exports.DEPOSIT_REFERENCE_BODY_LENGTH; index += 1) {
        body += exports.DEPOSIT_REFERENCE_ALPHABET[(0, crypto_1.randomInt)(0, exports.DEPOSIT_REFERENCE_ALPHABET.length)];
    }
    return `${exports.DEPOSIT_REFERENCE_PREFIX}-${body}`;
}
function isDepositReference(value) {
    return typeof value === "string" && exports.DEPOSIT_REFERENCE_PATTERN.test(value.trim().toUpperCase());
}
function normalizeDepositReference(value) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim().toUpperCase();
    return exports.DEPOSIT_REFERENCE_PATTERN.test(trimmed) ? trimmed : null;
}
