"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPOSIT_STABLECOIN_TYPES = exports.USD_SCALE = void 0;
exports.depositAssetSymbol = depositAssetSymbol;
exports.isStablecoinDeposit = isStablecoinDeposit;
exports.valueDepositInUsd = valueDepositInUsd;
exports.usdRatioUnits = usdRatioUnits;
exports.applyUsdRatio = applyUsdRatio;
const money_1 = require("./money");
exports.USD_SCALE = 8;
/**
 * Crypto types that the platform treats as dollar-pegged. A stablecoin deposit is
 * valued at par: the quantity received is the USD amount, with no market
 * conversion applied. This is what makes "100 USDT deposited = 100 USDT credited".
 */
exports.DEPOSIT_STABLECOIN_TYPES = [
    "ERC20",
    "TRC20",
    "USDT",
    "USDT_ERC20",
    "USDT_TRC20"
];
/** Map a stored crypto type onto the market-data symbol used for pricing. */
function depositAssetSymbol(cryptoType) {
    if (cryptoType === "BTC" || cryptoType === "ETH" || cryptoType === "SOL") {
        return cryptoType;
    }
    if (exports.DEPOSIT_STABLECOIN_TYPES.includes(cryptoType)) {
        return "USDT";
    }
    return null;
}
function isStablecoinDeposit(cryptoType) {
    return exports.DEPOSIT_STABLECOIN_TYPES.includes(cryptoType);
}
function normaliseQuantity(quantity) {
    try {
        const fixed = typeof quantity === "number" ? quantity.toFixed(exports.USD_SCALE) : String(quantity);
        return (0, money_1.formatDecimal)((0, money_1.parseDecimal)(fixed, exports.USD_SCALE), exports.USD_SCALE);
    }
    catch {
        return null;
    }
}
/**
 * Value a received quantity in USD under the platform's accounting policy.
 *
 * - Stablecoins are valued at par (1 unit = 1 USD) with no market conversion.
 * - Volatile assets keep their received quantity and are valued with a market
 *   price when one is available; the quantity is never replaced.
 * - When no price is available the USD value is `unavailable` (null) rather than
 *   zero, so the original quantity is preserved and approval is never blocked.
 */
function valueDepositInUsd(input) {
    const quantity = normaliseQuantity(input.quantity);
    if (quantity === null) {
        return { usd: null, basis: "unavailable", price: null };
    }
    if (isStablecoinDeposit(input.cryptoType)) {
        return { usd: quantity, basis: "stablecoin_par", price: null };
    }
    const price = input.price;
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
        const usdUnits = (0, money_1.multiplyDecimal)(quantity, price.toFixed(exports.USD_SCALE), exports.USD_SCALE, exports.USD_SCALE, exports.USD_SCALE);
        return { usd: (0, money_1.formatDecimal)(usdUnits, exports.USD_SCALE), basis: "market_price", price: price.toFixed(exports.USD_SCALE) };
    }
    return { usd: null, basis: "unavailable", price: null };
}
/**
 * USD value of one whole asset unit, scaled by 10^8. Stablecoins are exactly
 * 1:1; volatile assets use the supplied market price; when no price is known the
 * ratio is reported as unavailable with a neutral 1:1 fallback so downstream
 * arithmetic stays deterministic while the caller flags the gap.
 */
function usdRatioUnits(cryptoType, price) {
    if (isStablecoinDeposit(cryptoType)) {
        return { ratioUnits: 10n ** BigInt(exports.USD_SCALE), basis: "stablecoin_par" };
    }
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
        return { ratioUnits: (0, money_1.parseDecimal)(price.toFixed(exports.USD_SCALE), exports.USD_SCALE), basis: "market_price" };
    }
    return { ratioUnits: 10n ** BigInt(exports.USD_SCALE), basis: "unavailable" };
}
/** Convert an asset-unit amount into its USD equivalent, half-up rounded. */
function applyUsdRatio(assetUnits, ratioUnits) {
    const product = assetUnits * ratioUnits;
    const divisor = 10n ** BigInt(exports.USD_SCALE);
    const half = divisor / 2n;
    const negative = product < 0n;
    const absolute = negative ? -product : product;
    const rounded = (absolute + half) / divisor;
    return negative ? -rounded : rounded;
}
