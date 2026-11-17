import { randomInt } from "crypto";

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
export const DEPOSIT_REFERENCE_PREFIX = "NX";

/** Ambiguity-free alphabet: 8 digits + 23 letters = 31 symbols. */
export const DEPOSIT_REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const DEPOSIT_REFERENCE_BODY_LENGTH = 8;

export const DEPOSIT_REFERENCE_PATTERN = new RegExp(
  `^${DEPOSIT_REFERENCE_PREFIX}-[${DEPOSIT_REFERENCE_ALPHABET}]{${DEPOSIT_REFERENCE_BODY_LENGTH}}$`
);

/** Generate a fresh reference. Callers must persist it behind a unique index. */
export function generateDepositReference(): string {
  let body = "";
  for (let index = 0; index < DEPOSIT_REFERENCE_BODY_LENGTH; index += 1) {
    body += DEPOSIT_REFERENCE_ALPHABET[randomInt(0, DEPOSIT_REFERENCE_ALPHABET.length)];
  }
  return `${DEPOSIT_REFERENCE_PREFIX}-${body}`;
}

export function isDepositReference(value: unknown): value is string {
  return typeof value === "string" && DEPOSIT_REFERENCE_PATTERN.test(value.trim().toUpperCase());
}

export function normalizeDepositReference(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return DEPOSIT_REFERENCE_PATTERN.test(trimmed) ? trimmed : null;
}
