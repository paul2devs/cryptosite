"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDecimal = parseDecimal;
exports.formatDecimal = formatDecimal;
exports.multiplyDecimal = multiplyDecimal;
exports.percentFromChange = percentFromChange;
exports.addDecimal = addDecimal;
exports.subtractDecimal = subtractDecimal;
exports.minDecimal = minDecimal;
exports.maxDecimal = maxDecimal;
exports.isNegativeDecimal = isNegativeDecimal;
exports.percentOf = percentOf;
function parseDecimal(value, scale) {
    const raw = typeof value === "number" ? value.toFixed(scale) : String(value).trim();
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        throw new Error("Invalid decimal amount");
    }
    const negative = raw.startsWith("-");
    const unsigned = negative ? raw.slice(1) : raw;
    const [whole, fraction = ""] = unsigned.split(".");
    if (fraction.length > scale) {
        throw new Error("Decimal scale exceeds allowed precision");
    }
    const padded = (fraction + "0".repeat(scale)).slice(0, scale);
    const units = BigInt(whole || "0") * 10n ** BigInt(scale) + BigInt(padded || "0");
    return negative ? -units : units;
}
function formatDecimal(units, scale) {
    const negative = units < 0n;
    const absolute = negative ? -units : units;
    const base = 10n ** BigInt(scale);
    const whole = absolute / base;
    const fraction = (absolute % base).toString().padStart(scale, "0");
    return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}
function multiplyDecimal(left, right, leftScale, rightScale, resultScale) {
    const leftUnits = parseDecimal(left, leftScale);
    const rightUnits = parseDecimal(right, rightScale);
    const productScale = leftScale + rightScale;
    const product = leftUnits * rightUnits;
    const shift = productScale - resultScale;
    if (shift < 0) {
        return product * 10n ** BigInt(-shift);
    }
    const divisor = 10n ** BigInt(shift);
    const half = divisor / 2n;
    const negative = product < 0n;
    const absolute = negative ? -product : product;
    const rounded = (absolute + half) / divisor;
    return negative ? -rounded : rounded;
}
function percentFromChange(change, base) {
    if (base === 0n) {
        return null;
    }
    const scaled = (change * 100000000n) / base;
    return formatDecimal(scaled, 6);
}
function addDecimal(left, right) {
    return left + right;
}
function subtractDecimal(left, right) {
    return left - right;
}
function minDecimal(left, right) {
    return left < right ? left : right;
}
function maxDecimal(left, right) {
    return left > right ? left : right;
}
function isNegativeDecimal(value) {
    return value < 0n;
}
// Applies a percentage to an amount using integer math with half-up rounding.
// percent is expressed as a percentage number (e.g. "5.000000" means five percent).
function percentOf(amount, percent, amountScale, percentScale) {
    const amountUnits = parseDecimal(amount, amountScale);
    const percentUnits = parseDecimal(percent, percentScale);
    const numerator = amountUnits * percentUnits;
    const denominator = 100n * 10n ** BigInt(percentScale);
    const negative = numerator < 0n;
    const absolute = negative ? -numerator : numerator;
    const rounded = (absolute + denominator / 2n) / denominator;
    return formatDecimal(negative ? -rounded : rounded, amountScale);
}
