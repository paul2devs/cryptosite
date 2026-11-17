"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPOSIT_AMOUNT_TOLERANCE = exports.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE = exports.SUPPORTED_DEPOSIT_CRYPTO_TYPES = void 0;
exports.isSupportedDepositCryptoType = isSupportedDepositCryptoType;
exports.resolvePlatformAsset = resolvePlatformAsset;
exports.resolveDepositNetwork = resolveDepositNetwork;
exports.normalizeTxHash = normalizeTxHash;
exports.exceedsDecimalPrecision = exceedsDecimalPrecision;
exports.validateDepositSubmission = validateDepositSubmission;
exports.amountsWithinDepositTolerance = amountsWithinDepositTolerance;
exports.describeDepositStatus = describeDepositStatus;
exports.validateDepositIntent = validateDepositIntent;
const depositStatus_1 = require("./depositStatus");
exports.SUPPORTED_DEPOSIT_CRYPTO_TYPES = [
    "BTC",
    "ETH",
    "SOL",
    "ERC20",
    "TRC20"
];
const PLATFORM_ASSET_BY_CRYPTO_TYPE = {
    BTC: "BTC",
    ETH: "ETH",
    SOL: "SOL",
    ERC20: "USDT_ERC20",
    TRC20: "USDT_TRC20"
};
const NETWORK_BY_CRYPTO_TYPE = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    SOL: "Solana",
    ERC20: "ERC20",
    TRC20: "TRC20"
};
exports.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE = {
    BTC: 8,
    ETH: 8,
    SOL: 8,
    ERC20: 6,
    TRC20: 6
};
function isSupportedDepositCryptoType(value) {
    return (typeof value === "string" &&
        exports.SUPPORTED_DEPOSIT_CRYPTO_TYPES.includes(value));
}
function resolvePlatformAsset(cryptoType) {
    const asset = PLATFORM_ASSET_BY_CRYPTO_TYPE[cryptoType];
    if (!asset) {
        throw new Error(`Unsupported deposit crypto type: ${cryptoType}`);
    }
    return asset;
}
function resolveDepositNetwork(cryptoType) {
    const network = NETWORK_BY_CRYPTO_TYPE[cryptoType];
    if (!network) {
        throw new Error(`Unsupported deposit crypto type: ${cryptoType}`);
    }
    return network;
}
function normalizeTxHash(hash) {
    return typeof hash === "string" ? hash.trim() : "";
}
function exceedsDecimalPrecision(value, decimals) {
    if (!Number.isFinite(value)) {
        return false;
    }
    const scaled = value * Math.pow(10, decimals);
    return Math.abs(scaled - Math.round(scaled)) > 1e-6;
}
function validateDepositSubmission(input) {
    const errors = [];
    const normalizedTxHash = normalizeTxHash(input.txHash);
    const numericAmount = Number(input.amount);
    const cryptoType = input.cryptoType;
    if (normalizedTxHash.length < 8 || normalizedTxHash.length > 200) {
        errors.push("A valid blockchain transaction hash is required to submit a deposit.");
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        errors.push("Deposit amount must be a positive number.");
    }
    if (!isSupportedDepositCryptoType(cryptoType)) {
        errors.push("Select a supported asset and network before submitting a deposit.");
    }
    else if (Number.isFinite(numericAmount) &&
        numericAmount > 0 &&
        exceedsDecimalPrecision(numericAmount, exports.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType])) {
        errors.push(`Amount supports at most ${exports.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType]} decimal places for this asset.`);
    }
    return {
        valid: errors.length === 0,
        errors,
        normalizedTxHash,
        numericAmount
    };
}
/**
 * Relative tolerance used when matching an on-chain amount to the expected
 * deposit amount. Shared by the blockchain verifier and the deposit monitor so
 * detection and verification always agree on what "the same amount" means.
 */
exports.DEPOSIT_AMOUNT_TOLERANCE = 0.005;
function amountsWithinDepositTolerance(actual, expected) {
    if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) {
        return false;
    }
    return Math.abs(actual - expected) <= Math.max(expected * exports.DEPOSIT_AMOUNT_TOLERANCE, 1e-8);
}
function describeDepositStatus(status) {
    return (0, depositStatus_1.describeDepositStatus)(status);
}
/**
 * Validate a deposit *intent*: the asset/network, the amount the user intends to
 * send, and the optional USD value. No transaction hash is required here — a
 * pending deposit is created first and the on-chain transfer is matched later,
 * so this validation never depends on a blockchain provider.
 */
function validateDepositIntent(input) {
    const errors = [];
    const cryptoType = input.cryptoType;
    if (!isSupportedDepositCryptoType(cryptoType)) {
        return {
            valid: false,
            errors: ["Select a supported asset and network before creating a deposit."],
            numericCryptoAmount: null,
            numericUsdAmount: null
        };
    }
    const hasCryptoAmount = input.cryptoAmount !== undefined && input.cryptoAmount !== null && input.cryptoAmount !== "";
    const hasUsdAmount = input.usdAmount !== undefined && input.usdAmount !== null && input.usdAmount !== "";
    const numericCryptoAmount = hasCryptoAmount ? Number(input.cryptoAmount) : null;
    const numericUsdAmount = hasUsdAmount ? Number(input.usdAmount) : null;
    if (!hasCryptoAmount && !hasUsdAmount) {
        errors.push("Enter a deposit amount.");
    }
    if (hasCryptoAmount) {
        if (!Number.isFinite(numericCryptoAmount) || numericCryptoAmount <= 0) {
            errors.push("Deposit amount must be a positive number.");
        }
        else if (exceedsDecimalPrecision(numericCryptoAmount, exports.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType])) {
            errors.push(`Amount supports at most ${exports.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType]} decimal places for this asset.`);
        }
    }
    if (hasUsdAmount && (!Number.isFinite(numericUsdAmount) || numericUsdAmount <= 0)) {
        errors.push("The deposit value must be a positive number.");
    }
    return {
        valid: errors.length === 0,
        errors,
        numericCryptoAmount: Number.isFinite(numericCryptoAmount)
            ? numericCryptoAmount
            : null,
        numericUsdAmount: Number.isFinite(numericUsdAmount)
            ? numericUsdAmount
            : null
    };
}
