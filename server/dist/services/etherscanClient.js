"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtherscanProviderError = exports.ETHEREUM_MAINNET_CHAIN_ID = exports.ETHERSCAN_V2_BASE = void 0;
exports.resolveEtherscanConfig = resolveEtherscanConfig;
exports.etherscanRequest = etherscanRequest;
exports.etherscanProxy = etherscanProxy;
exports.etherscanAccountList = etherscanAccountList;
exports.etherscanLatestBlockNumber = etherscanLatestBlockNumber;
exports.etherscanTransactionReceipt = etherscanTransactionReceipt;
exports.etherscanTransactionByHash = etherscanTransactionByHash;
exports.confirmationsForBlock = confirmationsForBlock;
const axios_1 = __importDefault(require("axios"));
/**
 * Etherscan retired its V1 API; every call must go through V2 with an explicit
 * chain id. This module is the single place that resolves the endpoint so the
 * verifier and the chain monitor cannot drift apart, and so a stale
 * `ETHERSCAN_API_BASE` pointing at the dead V1 host cannot silently disable
 * Ethereum verification.
 */
exports.ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";
exports.ETHEREUM_MAINNET_CHAIN_ID = "1";
const DEPRECATED_V1_BASE_PATTERN = /^https?:\/\/api\.etherscan\.io\/api$/i;
/**
 * Raised when Etherscan answers with a transport-successful but logically failed
 * envelope. Account endpoints reply `{ status: "0", message: "NOTOK", result:
 * "<reason>" }` for rate limits, invalid keys and other request failures, and
 * proxy endpoints reply `{ error: { code, message } }` for JSON-RPC failures.
 * Both are provider faults, not "the transaction does not exist", so they must
 * throw rather than be flattened into an empty list — otherwise a transient
 * rate limit is reported to the depositor as `not_found`.
 */
class EtherscanProviderError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "EtherscanProviderError";
        this.code = code;
    }
}
exports.EtherscanProviderError = EtherscanProviderError;
function detectEtherscanError(payload) {
    const rpcError = payload.error;
    if (rpcError && typeof rpcError === "object") {
        const record = rpcError;
        const code = record.code !== undefined ? `JSONRPC_${String(record.code)}` : "JSONRPC_ERROR";
        const message = typeof record.message === "string" && record.message.length > 0
            ? record.message
            : "Etherscan returned a JSON-RPC error.";
        return { code, message };
    }
    // `status: "0"` alone is not an error — an address with no transfers answers
    // `message: "No transactions found"`. Only the explicit NOTOK envelope means
    // the request itself failed.
    if (String(payload.status ?? "").trim() === "0" && String(payload.message ?? "").trim().toUpperCase() === "NOTOK") {
        const detail = typeof payload.result === "string" && payload.result.length > 0
            ? payload.result
            : "Etherscan reported a request failure.";
        return { code: "NOTOK", message: detail };
    }
    return null;
}
function readOptionalEnv(name) {
    const raw = process.env[name];
    if (!raw) {
        return null;
    }
    const trimmed = String(raw).trim();
    return trimmed.length > 0 ? trimmed : null;
}
function resolveEtherscanConfig() {
    const configured = readOptionalEnv("ETHERSCAN_API_BASE");
    let base = (configured || exports.ETHERSCAN_V2_BASE).replace(/\/+$/, "");
    if (DEPRECATED_V1_BASE_PATTERN.test(base)) {
        base = exports.ETHERSCAN_V2_BASE;
    }
    return {
        apiKey: readOptionalEnv("ETHERSCAN_API_KEY"),
        base,
        chainId: readOptionalEnv("ETHEREUM_CHAIN_ID") || exports.ETHEREUM_MAINNET_CHAIN_ID
    };
}
/**
 * Perform a GET against Etherscan V2 with the chain id applied. The caller reads
 * the raw payload: V2 returns `{ jsonrpc, result }` for proxy calls and
 * `{ status, message, result }` for account calls, and the thin wrappers below
 * normalise those two shapes.
 *
 * A logically failed envelope is raised as an `EtherscanProviderError` so the
 * caller reports a provider fault instead of treating the missing data as an
 * absent transaction.
 */
async function etherscanRequest(params) {
    const { apiKey, base, chainId } = resolveEtherscanConfig();
    const response = await axios_1.default.get(base, {
        timeout: 15000,
        params: { chainid: chainId, ...params, apikey: apiKey ?? "" }
    });
    const payload = (response.data || {});
    const envelopeError = detectEtherscanError(payload);
    if (envelopeError) {
        throw new EtherscanProviderError(envelopeError.code, envelopeError.message);
    }
    return payload;
}
/** Reads `result` from a proxy (`eth_*`) response, returning null when absent. */
async function etherscanProxy(action, extra) {
    const payload = await etherscanRequest({ module: "proxy", action, ...extra });
    return payload.result ?? null;
}
/** Reads an array `result` from an account response, returning [] when absent. */
async function etherscanAccountList(action, extra) {
    const payload = await etherscanRequest({ module: "account", action, ...extra });
    return Array.isArray(payload.result) ? payload.result : [];
}
async function etherscanLatestBlockNumber() {
    const result = await etherscanProxy("eth_blockNumber", {});
    const parsed = Number.parseInt(String(result ?? "0"), 16);
    return Number.isFinite(parsed) ? parsed : 0;
}
function etherscanTransactionReceipt(txHash) {
    return etherscanProxy("eth_getTransactionReceipt", { txhash: txHash });
}
function etherscanTransactionByHash(txHash) {
    return etherscanProxy("eth_getTransactionByHash", { txhash: txHash });
}
/**
 * Confirmations for a mined block, inclusive of the block itself. Returns 0 when
 * the transaction is not yet mined or the tip is unknown so an unmined transfer
 * can never satisfy a confirmation threshold.
 */
function confirmationsForBlock(latestBlock, blockNumber) {
    if (!latestBlock || !blockNumber || latestBlock < blockNumber) {
        return 0;
    }
    return latestBlock - blockNumber + 1;
}
