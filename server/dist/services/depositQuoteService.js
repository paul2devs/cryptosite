"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPOSIT_FEE_NOTE = void 0;
exports.buildDepositQuote = buildDepositQuote;
exports.validateDepositConversion = validateDepositConversion;
const depositRules_1 = require("../domain/depositRules");
const depositQuote_1 = require("../domain/depositQuote");
const marketDataService_1 = require("./marketDataService");
/** Maps a deposit crypto type to the symbol the pricing service quotes in USD. */
const SYMBOL_BY_CRYPTO_TYPE = {
    BTC: "BTC",
    ETH: "ETH",
    SOL: "SOL",
    ERC20: "USDT",
    TRC20: "USDT"
};
const DISPLAY_SYMBOL_BY_CRYPTO_TYPE = {
    BTC: "BTC",
    ETH: "ETH",
    SOL: "SOL",
    ERC20: "USDT",
    TRC20: "USDT"
};
const SOURCE_LABELS = {
    coingecko: "CoinGecko",
    kraken: "Kraken",
    coinbase: "Coinbase",
    binance: "Binance"
};
const RATE_UNAVAILABLE_REASON = "Current conversion pricing is temporarily unavailable. Please try again shortly.";
const RATE_STALE_REASON = "The last exchange rate we received is out of date, so it cannot be used for a conversion. Refresh the rate and try again.";
exports.DEPOSIT_FEE_NOTE = "The platform does not charge a deposit fee. Network fees are set by the blockchain and are not collected by the platform.";
const NETWORK_FEE_NOTE = "Network fees are set by the blockchain and paid to miners or validators. They are not collected by the platform and cannot be estimated here.";
function trimTrailingZeros(value) {
    return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}
function formatCryptoLabel(amount, decimals, symbol) {
    return `${trimTrailingZeros(amount.toFixed(decimals))} ${symbol}`;
}
/**
 * Build a USD→crypto quote for a deposit. The rate always comes from the
 * configured pricing service; nothing is hardcoded.
 */
async function buildDepositQuote(input) {
    const { cryptoType } = input;
    const decimals = depositRules_1.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType];
    const symbol = DISPLAY_SYMBOL_BY_CRYPTO_TYPE[cryptoType];
    const network = (0, depositRules_1.resolveDepositNetwork)(cryptoType);
    const base = {
        available: false,
        reason: null,
        cryptoType,
        symbol,
        network,
        decimals,
        usdAmount: null,
        cryptoAmount: null,
        cryptoAmountLabel: null,
        rate: null,
        rateSource: null,
        rateUpdatedAt: null,
        stale: false,
        cached: false,
        minUsd: depositQuote_1.DEPOSIT_MIN_USD,
        maxUsd: depositQuote_1.DEPOSIT_MAX_USD,
        feeUsd: 0,
        feeNote: exports.DEPOSIT_FEE_NOTE,
        networkFeeNote: NETWORK_FEE_NOTE,
        estimatedReceivedLabel: null
    };
    const prices = await (0, marketDataService_1.getAllMarketPrices)();
    const point = prices[SYMBOL_BY_CRYPTO_TYPE[cryptoType]];
    if (!point || !Number.isFinite(point.price) || point.price <= 0) {
        return { ...base, reason: RATE_UNAVAILABLE_REASON };
    }
    const updatedAt = point.lastUpdated ? new Date(point.lastUpdated) : null;
    const updatedAtValid = updatedAt !== null && Number.isFinite(updatedAt.getTime());
    const ageMs = updatedAtValid ? Date.now() - updatedAt.getTime() : null;
    const freshness = updatedAtValid ? (0, marketDataService_1.classifyPriceFreshness)(ageMs) : "stale";
    const rateMeta = {
        rate: point.price,
        rateSource: point.source ? SOURCE_LABELS[point.source] : "Configured pricing service",
        rateUpdatedAt: updatedAtValid ? updatedAt.toISOString() : null
    };
    // A rate past the staleness threshold is disclosed with its timestamp so the
    // user knows how old it is, but it is never used to price a fresh conversion:
    // the amount stays unavailable until the rate is refreshed.
    if (freshness === "stale") {
        return { ...base, ...rateMeta, stale: true, reason: RATE_STALE_REASON };
    }
    // Inside the staleness window but past the live window: still usable, and
    // flagged so the UI can disclose that a cached rate is being shown rather than
    // presenting it as live.
    const quote = {
        ...base,
        ...rateMeta,
        available: true,
        stale: false,
        cached: freshness === "cached"
    };
    const usdAmount = typeof input.usdAmount === "number" && Number.isFinite(input.usdAmount) && input.usdAmount > 0
        ? input.usdAmount
        : null;
    if (usdAmount !== null) {
        const cryptoAmount = (0, depositQuote_1.usdToCryptoAmount)(usdAmount, point.price, decimals);
        quote.usdAmount = usdAmount;
        quote.cryptoAmount = cryptoAmount;
        if (cryptoAmount !== null) {
            const formatted = formatCryptoLabel(cryptoAmount, decimals, symbol);
            quote.cryptoAmountLabel = formatted;
            // No platform fee is deducted, so the amount to send equals the amount received.
            quote.estimatedReceivedLabel = formatted;
        }
    }
    return quote;
}
/**
 * Server-side validation of a USD-denominated deposit. The submitted crypto
 * amount must match the amount the backend derives from the current verified
 * rate, and the USD value must sit inside the platform min/max band.
 */
async function validateDepositConversion(input) {
    const quote = await buildDepositQuote({ cryptoType: input.cryptoType });
    const errors = [];
    if (!quote.available || quote.rate === null) {
        return {
            valid: false,
            errors: [quote.reason || RATE_UNAVAILABLE_REASON],
            quote
        };
    }
    const providedUsd = typeof input.usdAmount === "number" && Number.isFinite(input.usdAmount) && input.usdAmount > 0
        ? input.usdAmount
        : null;
    const derivedUsd = (0, depositQuote_1.cryptoToUsdAmount)(input.cryptoAmount, quote.rate);
    const usdValue = providedUsd ?? derivedUsd;
    if (usdValue === null) {
        return {
            valid: false,
            errors: ["Enter a valid deposit amount."],
            quote
        };
    }
    const usdValidation = (0, depositQuote_1.validateUsdAmountInput)(String(usdValue));
    if (!usdValidation.valid && usdValidation.message) {
        errors.push(usdValidation.message);
    }
    const expectedCrypto = (0, depositQuote_1.usdToCryptoAmount)(usdValue, quote.rate, quote.decimals);
    if (expectedCrypto === null) {
        errors.push("The deposit amount is too small to convert to the selected asset.");
    }
    else if (!(0, depositQuote_1.withinConversionTolerance)(input.cryptoAmount, expectedCrypto)) {
        errors.push("The submitted amount no longer matches the current exchange rate. Refresh the rate and try again.");
    }
    return {
        valid: errors.length === 0,
        errors,
        quote
    };
}
