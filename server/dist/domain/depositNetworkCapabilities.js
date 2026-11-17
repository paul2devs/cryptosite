"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEPOSIT_MEMO_GUIDANCE = void 0;
exports.resolveDepositCapability = resolveDepositCapability;
exports.listDepositCapabilities = listDepositCapabilities;
exports.validateDepositMemo = validateDepositMemo;
exports.memoSupportSummary = memoSupportSummary;
exports.resolveDepositNetworkLabel = resolveDepositNetworkLabel;
const depositRules_1 = require("./depositRules");
const MEMO_UNSUPPORTED = {
    supported: false,
    required: false,
    label: null,
    pattern: null,
    guidance: null
};
const MEMO_GUIDANCE = "Include the exact memo or destination tag when sending. Missing or incorrect identifiers may prevent automatic deposit matching.";
function confirmationsFromEnv(name, fallback) {
    const raw = process.env[name];
    if (!raw || String(raw).trim().length === 0) {
        return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        return fallback;
    }
    return parsed;
}
const BASE_CAPABILITIES = {
    BTC: {
        symbol: "BTC",
        networkLabel: "Bitcoin",
        networkType: "Bitcoin",
        confirmationsEnv: "BTC_MIN_CONFIRMATIONS",
        confirmationsDefault: 1,
        sendingInstruction: "Send your BTC to the receiving address shown above. Make sure you select the Bitcoin network.",
        networkWarning: "Send BTC on the Bitcoin network only. Bitcoin sent on any other network cannot be recovered.",
        memo: MEMO_UNSUPPORTED
    },
    ETH: {
        symbol: "ETH",
        networkLabel: "Ethereum",
        networkType: "Ethereum",
        confirmationsEnv: "ETH_MIN_CONFIRMATIONS",
        confirmationsDefault: 6,
        sendingInstruction: "Send your ETH to the receiving address shown above. Make sure you select the Ethereum (ERC20) network.",
        networkWarning: "Send ETH on the Ethereum network only. ETH sent on any other network cannot be recovered. Do not send USDT to this address.",
        memo: MEMO_UNSUPPORTED
    },
    SOL: {
        symbol: "SOL",
        networkLabel: "Solana",
        networkType: "SOL",
        confirmationsEnv: "SOL_MIN_CONFIRMATIONS",
        confirmationsDefault: 10,
        sendingInstruction: "Send your SOL to the receiving address shown above. Make sure you select the Solana network.",
        networkWarning: "Send SOL on the Solana network only. SOL sent on any other network cannot be recovered. Do not send SPL tokens to this address.",
        memo: MEMO_UNSUPPORTED
    },
    ERC20: {
        symbol: "USDT",
        networkLabel: "Ethereum (ERC20)",
        networkType: "ERC20",
        confirmationsEnv: "ERC20_MIN_CONFIRMATIONS",
        confirmationsDefault: 6,
        sendingInstruction: "Send your USDT to the receiving address shown above. Make sure you select the Ethereum (ERC20) network.",
        networkWarning: "Send USDT on the Ethereum (ERC20) network only. USDT sent on any other network cannot be recovered. Do not send ETH to this address.",
        memo: MEMO_UNSUPPORTED
    },
    TRC20: {
        symbol: "USDT",
        networkLabel: "Tron (TRC20)",
        networkType: "TRC20",
        confirmationsEnv: "TRC20_MIN_CONFIRMATIONS",
        confirmationsDefault: 20,
        sendingInstruction: "Send your USDT to the receiving address shown above. Make sure you select the Tron (TRC20) network.",
        networkWarning: "Send USDT on the Tron (TRC20) network only. USDT sent on any other network cannot be recovered. Do not send TRX to this address.",
        memo: MEMO_UNSUPPORTED
    }
};
function resolveDepositCapability(cryptoType) {
    const base = BASE_CAPABILITIES[cryptoType];
    if (!base) {
        throw new Error(`Unsupported deposit crypto type: ${cryptoType}`);
    }
    return {
        cryptoType,
        platformAsset: (0, depositRules_1.resolvePlatformAsset)(cryptoType),
        symbol: base.symbol,
        networkLabel: base.networkLabel,
        networkType: base.networkType,
        decimals: depositRules_1.DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType],
        minConfirmations: confirmationsFromEnv(base.confirmationsEnv, base.confirmationsDefault),
        memo: { ...base.memo },
        sendingInstruction: base.sendingInstruction,
        networkWarning: base.networkWarning
    };
}
function listDepositCapabilities() {
    return Object.keys(BASE_CAPABILITIES).map((cryptoType) => resolveDepositCapability(cryptoType));
}
/**
 * Validate an optional user-supplied memo against the network capability. When
 * the network has no memo concept the value is discarded rather than stored, so
 * the platform never pretends a memo will be transmitted on a network that
 * cannot carry one.
 */
function validateDepositMemo(capability, rawMemo) {
    const trimmed = typeof rawMemo === "string" ? rawMemo.trim() : "";
    if (!capability.memo.supported) {
        return { valid: true, memo: null, error: null };
    }
    if (trimmed.length === 0) {
        if (capability.memo.required) {
            return {
                valid: false,
                memo: null,
                error: `${capability.memo.label || "Memo"} is required for ${capability.networkLabel} deposits.`
            };
        }
        return { valid: true, memo: null, error: null };
    }
    if (capability.memo.pattern && !capability.memo.pattern.test(trimmed)) {
        return {
            valid: false,
            memo: null,
            error: `Enter a valid ${capability.memo.label || "memo"} for ${capability.networkLabel}.`
        };
    }
    return { valid: true, memo: trimmed, error: null };
}
exports.DEPOSIT_MEMO_GUIDANCE = MEMO_GUIDANCE;
/**
 * The network that would carry a memo for each supported asset, if any. Used by
 * the completion report / diagnostics endpoint so operators can see at a glance
 * which assets require an identifier.
 */
function memoSupportSummary() {
    return listDepositCapabilities().map((capability) => ({
        cryptoType: capability.cryptoType,
        networkLabel: capability.networkLabel,
        memoSupported: capability.memo.supported,
        memoRequired: capability.memo.required,
        memoLabel: capability.memo.label
    }));
}
function resolveDepositNetworkLabel(cryptoType) {
    return BASE_CAPABILITIES[cryptoType].networkLabel;
}
