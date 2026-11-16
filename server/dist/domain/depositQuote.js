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
 * Fixed decimal scale used for all money arithmetic. Values are lifted into
 * scaled integers before any division or multiplication so binary floating point
 * can never drift the credited amount (the classic `0.1 + 0.2` class of error).
 */
const DECIMAL_SCALE = 100000000; // 1e8, i.e. 8 decimal places
const DECIMAL_SCALE_BIGINT = 100000000n;
/** Lift a positive finite decimal into a scaled BigInt, or null when unusable. */
function toScaledInteger(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return null;
    }
    const scaled = Math.round(value * DECIMAL_SCALE);
    if (!Number.isFinite(scaled) || scaled <= 0) {
        return null;
    }
    return BigInt(scaled);
}
/**
 * Convert a USD value into an asset amount, truncated to the asset precision.
 * The division is performed on scaled integers so the truncation is exact for
 * the asset's precision.
 *
 * Returns null when the price is unusable or the amount rounds down to zero, so
 * callers never fabricate an amount.
 */
function usdToCryptoAmount(usd, usdPrice, decimals) {
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
        return null;
    }
    const usdScaled = toScaledInteger(usd);
    const priceScaled = toScaledInteger(usdPrice);
    if (usdScaled === null || priceScaled === null) {
        return null;
    }
    const amountScale = 10n ** BigInt(decimals);
    // usd / price, evaluated at the asset's decimal precision. BigInt division
    // truncates toward zero, which is the desired "floor" for positive amounts.
    const truncated = (usdScaled * amountScale) / priceScaled;
    if (truncated <= 0n) {
        return null;
    }
    // `truncated` is already scaled by 10^decimals, so divide by that same factor.
    return Number(truncated) / Number(amountScale);
}
/** Value in USD of an asset amount at the given rate, computed exactly. */
function cryptoToUsdAmount(amount, usdPrice) {
    const amountScaled = toScaledInteger(amount);
    const priceScaled = toScaledInteger(usdPrice);
    if (amountScaled === null || priceScaled === null) {
        return null;
    }
    const product = (amountScaled * priceScaled) / DECIMAL_SCALE_BIGINT;
    if (product <= 0n) {
        return null;
    }
    return Number(product) / DECIMAL_SCALE;
}
/** Whether an actual value is within the allowed relative tolerance of expected. */
function withinConversionTolerance(actual, expected, tolerance = exports.DEPOSIT_CONVERSION_TOLERANCE) {
    if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) {
        return false;
    }
    return Math.abs(actual - expected) / expected <= tolerance;
}
