"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE = exports.SUPPORTED_DEPOSIT_CRYPTO_TYPES = void 0;
exports.isSupportedDepositCryptoType = isSupportedDepositCryptoType;
exports.resolvePlatformAsset = resolvePlatformAsset;
exports.resolveDepositNetwork = resolveDepositNetwork;
exports.normalizeTxHash = normalizeTxHash;
exports.exceedsDecimalPrecision = exceedsDecimalPrecision;
exports.validateDepositSubmission = validateDepositSubmission;
exports.describeDepositStatus = describeDepositStatus;
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
function describeDepositStatus(status) {
    if (status === "Approved") {
        return { label: "Confirmed", tone: "positive" };
    }
    if (status === "Rejected") {
        return { label: "Rejected", tone: "negative" };
    }
    return { label: "Pending", tone: "gold" };
}
