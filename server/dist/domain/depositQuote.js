"use strict";
/**
 * Deposit conversion rules.
 *
 * Users enter a deposit value in USD; the platform converts it to the selected
 * cryptocurrency amount using the rate returned by the configured pricing
 * service. These helpers are pure so both the quote endpoint and the deposit
 * submission can apply exactly the same arithmetic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPOSIT_CONVERSION_TOLERANCE = exports.DEPOSIT_MAX_USD = exports.DEPOSIT_MIN_USD = void 0;
exports.countDecimalPlaces = countDecimalPlaces;
exports.validateUsdAmountInput = validateUsdAmountInput;
exports.usdToCryptoAmount = usdToCryptoAmount;
exports.cryptoToUsdAmount = cryptoToUsdAmount;
exports.withinConversionTolerance = withinConversionTolerance;
/** Platform deposit bounds expressed in USD value. */
exports.DEPOSIT_MIN_USD = 100;
exports.DEPOSIT_MAX_USD = 100000;
/**
 * Maximum relative difference tolerated between the crypto amount a user
 * submits and the amount the backend derives from the current verified rate.
 */
exports.DEPOSIT_CONVERSION_TOLERANCE = 0.02;
function countDecimalPlaces(value) {
    const separator = value.indexOf(".");
    if (separator === -1) {
        return 0;
    }
    return value.length - separator - 1;
}
/** Validate a USD amount string against format and the platform min/max band. */
function validateUsdAmountInput(value) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return { valid: false, empty: true, message: null };
    }
    if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === ".") {
        return { valid: false, empty: false, message: "Enter a valid amount." };
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
        return { valid: false, empty: false, message: "Enter a valid amount." };
    }
    if (parsed <= 0) {
        return { valid: false, empty: false, message: "Enter an amount greater than zero." };
    }
    if (countDecimalPlaces(trimmed) > 2) {
        return { valid: false, empty: false, message: "Enter an amount with at most 2 decimal places." };
    }
    if (parsed < exports.DEPOSIT_MIN_USD) {
        return {
            valid: false,
            empty: false,
            message: `The minimum deposit is $${exports.DEPOSIT_MIN_USD.toLocaleString("en-US")}.`
        };
    }
    if (parsed > exports.DEPOSIT_MAX_USD) {
        return {
            valid: false,
            empty: false,
            message: `The maximum deposit is $${exports.DEPOSIT_MAX_USD.toLocaleString("en-US")}.`
        };
    }
    return { valid: true, empty: false, message: null };
}
/**
 * Convert a USD value into an asset amount, truncated to the asset precision.
 * Returns null when the price is unusable so callers never fabricate an amount.
 */
function usdToCryptoAmount(usd, usdPrice, decimals) {
    if (!Number.isFinite(usd) || usd <= 0) {
        return null;
    }
    if (!Number.isFinite(usdPrice) || usdPrice <= 0) {
        return null;
    }
    const factor = Math.pow(10, decimals);
    const floored = Math.floor((usd / usdPrice) * factor) / factor;
    if (!Number.isFinite(floored) || floored <= 0) {
        return null;
    }
    return floored;
}
/** Value in USD of an asset amount at the given rate. */
function cryptoToUsdAmount(amount, usdPrice) {
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }
    if (!Number.isFinite(usdPrice) || usdPrice <= 0) {
        return null;
    }
    return amount * usdPrice;
}
/** Whether an actual value is within the allowed relative tolerance of expected. */
function withinConversionTolerance(actual, expected, tolerance = exports.DEPOSIT_CONVERSION_TOLERANCE) {
    if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) {
        return false;
    }
    return Math.abs(actual - expected) / expected <= tolerance;
}
