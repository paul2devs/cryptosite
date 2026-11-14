"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECIMAL_SCALE = exports.WITHDRAWAL_SYMBOLS = exports.WITHDRAWAL_NETWORK_DEFINITIONS = exports.WITHDRAWAL_CRYPTO_TYPES = void 0;
exports.deriveWithdrawalStatus = deriveWithdrawalStatus;
exports.assertWithdrawalTransition = assertWithdrawalTransition;
exports.isTerminalWithdrawalState = isTerminalWithdrawalState;
exports.coarseStatusForDetailed = coarseStatusForDetailed;
exports.isWithdrawalCryptoType = isWithdrawalCryptoType;
exports.resolveWithdrawalDefinition = resolveWithdrawalDefinition;
exports.findWithdrawalCryptoTypeByPlatformAsset = findWithdrawalCryptoTypeByPlatformAsset;
exports.normalizeWalletAddress = normalizeWalletAddress;
exports.isValidWalletAddress = isValidWalletAddress;
exports.validateWithdrawalSubmission = validateWithdrawalSubmission;
exports.computeWithdrawalFees = computeWithdrawalFees;
const TRANSITIONS = {
    requested: ["under_review", "approved", "rejected", "cancelled"],
    under_review: ["approved", "rejected", "cancelled"],
    approved: ["processing", "rejected"],
    processing: ["broadcast", "completed", "failed"],
    broadcast: ["completed", "failed"],
    completed: [],
    rejected: [],
    failed: [],
    cancelled: []
};
function deriveWithdrawalStatus(status, detailed) {
    if (detailed && TRANSITIONS[detailed])
        return detailed;
    if (status === "Approved")
        return "approved";
    if (status === "Rejected")
        return "rejected";
    return "requested";
}
function assertWithdrawalTransition(current, next) {
    const allowed = TRANSITIONS[current] || [];
    if (!allowed.includes(next)) {
        throw new Error(`Cannot move a withdrawal from ${current} to ${next}.`);
    }
    return next;
}
function isTerminalWithdrawalState(state) {
    return (TRANSITIONS[state] || []).length === 0;
}
function coarseStatusForDetailed(detailed) {
    if (detailed === "approved" || detailed === "processing" || detailed === "broadcast" || detailed === "completed") {
        return "Approved";
    }
    if (detailed === "rejected" || detailed === "failed" || detailed === "cancelled") {
        return "Rejected";
    }
    return "Pending";
}
exports.WITHDRAWAL_CRYPTO_TYPES = [
    "BTC",
    "ETH",
    "SOL",
    "ERC20",
    "TRC20"
];
exports.WITHDRAWAL_NETWORK_DEFINITIONS = {
    BTC: {
        cryptoType: "BTC",
        platformAsset: "BTC",
        symbol: "BTC",
        symbolLabel: "BTC",
        networkLabel: "Bitcoin",
        networkType: "BTC",
        decimals: 8
    },
    ETH: {
        cryptoType: "ETH",
        platformAsset: "ETH",
        symbol: "ETH",
        symbolLabel: "ETH",
        networkLabel: "Ethereum",
        networkType: "ERC20",
        decimals: 8
    },
    SOL: {
        cryptoType: "SOL",
        platformAsset: "SOL",
        symbol: "SOL",
        symbolLabel: "SOL",
        networkLabel: "Solana",
        networkType: "SOL",
        decimals: 8
    },
    ERC20: {
        cryptoType: "ERC20",
        platformAsset: "USDT_ERC20",
        symbol: "USDT",
        symbolLabel: "USDT",
        networkLabel: "Ethereum (ERC20)",
        networkType: "ERC20",
        decimals: 6
    },
    TRC20: {
        cryptoType: "TRC20",
        platformAsset: "USDT_TRC20",
        symbol: "USDT",
        symbolLabel: "USDT",
        networkLabel: "Tron (TRC20)",
        networkType: "TRC20",
        decimals: 6
    }
};
exports.WITHDRAWAL_SYMBOLS = [
    { symbol: "BTC", name: "Bitcoin", networks: ["BTC"] },
    { symbol: "ETH", name: "Ethereum", networks: ["ETH"] },
    { symbol: "SOL", name: "Solana", networks: ["SOL"] },
    { symbol: "USDT", name: "Tether", networks: ["TRC20", "ERC20"] }
];
function isWithdrawalCryptoType(value) {
    return (typeof value === "string" &&
        Object.prototype.hasOwnProperty.call(exports.WITHDRAWAL_NETWORK_DEFINITIONS, value));
}
function resolveWithdrawalDefinition(cryptoType) {
    return exports.WITHDRAWAL_NETWORK_DEFINITIONS[cryptoType];
}
function findWithdrawalCryptoTypeByPlatformAsset(platformAsset) {
    const match = Object.values(exports.WITHDRAWAL_NETWORK_DEFINITIONS).find((definition) => definition.platformAsset === platformAsset);
    return match ? match.cryptoType : null;
}
const ADDRESS_PATTERNS = {
    BTC: [/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, /^bc1[02-9ac-hj-np-z]{11,71}$/],
    ERC20: [/^0x[a-fA-F0-9]{40}$/],
    SOL: [/^[1-9A-HJ-NP-Za-km-z]{32,44}$/],
    TRC20: [/^T[1-9A-HJ-NP-Za-km-z]{33}$/]
};
function normalizeWalletAddress(value) {
    return typeof value === "string" ? value.trim() : "";
}
function isValidWalletAddress(networkType, address) {
    const patterns = ADDRESS_PATTERNS[networkType];
    if (!patterns) {
        return false;
    }
    return patterns.some((pattern) => pattern.test(address));
}
function validateWithdrawalSubmission(input) {
    const errors = [];
    const normalizedAddress = normalizeWalletAddress(input.address);
    const numericAmount = Number(input.amount);
    const cryptoType = isWithdrawalCryptoType(input.asset) ? input.asset : null;
    if (!cryptoType) {
        errors.push("Select a supported asset and network before requesting a withdrawal.");
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        errors.push("Withdrawal amount must be a positive number.");
    }
    const definition = cryptoType ? resolveWithdrawalDefinition(cryptoType) : null;
    if (cryptoType && definition) {
        const requestedNetwork = normalizeWalletAddress(input.network).toUpperCase();
        if (requestedNetwork.length > 0 && requestedNetwork !== definition.networkType.toUpperCase()) {
            errors.push(`The destination network does not match ${definition.symbolLabel}. Use the ${definition.networkLabel} network.`);
        }
        if (normalizedAddress.length === 0) {
            errors.push("Enter the destination wallet address.");
        }
        else if (!isValidWalletAddress(definition.networkType, normalizedAddress)) {
            errors.push(`That address is not a valid ${definition.networkLabel} address for ${definition.symbolLabel}.`);
        }
        if (Number.isFinite(numericAmount) && numericAmount > 0) {
            const scaled = numericAmount * Math.pow(10, definition.decimals);
            if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
                errors.push(`Amount supports at most ${definition.decimals} decimal places for ${definition.symbolLabel}.`);
            }
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        cryptoType,
        platformAsset: definition ? definition.platformAsset : null,
        networkType: definition ? definition.networkType : null,
        normalizedAddress,
        numericAmount
    };
}
function toFixed8(value) {
    return Number.isFinite(value) ? value.toFixed(8) : "0.00000000";
}
function computeWithdrawalFees(input) {
    const amount = Number.isFinite(input.amount) && input.amount > 0 ? input.amount : 0;
    const networkFee = Number.isFinite(input.networkFee) && input.networkFee > 0 ? input.networkFee : 0;
    const percent = Number.isFinite(input.platformFeePercent) && input.platformFeePercent > 0
        ? input.platformFeePercent
        : 0;
    const platformFeeValue = (amount * percent) / 100;
    const totalFee = networkFee + platformFeeValue;
    const netAmount = Math.max(0, amount - totalFee);
    return {
        amount: toFixed8(amount),
        networkFee: toFixed8(networkFee),
        platformFee: toFixed8(platformFeeValue),
        totalFee: toFixed8(totalFee),
        netAmount: toFixed8(netAmount)
    };
}
exports.DECIMAL_SCALE = 8;
