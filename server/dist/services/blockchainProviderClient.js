"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SOLANA_MAX_TX_VERSION = exports.DEFAULT_BTC_FALLBACK_API_BASE = exports.DEFAULT_BTC_PRIMARY_API_BASE = exports.PROVIDER_TIMEOUT_MS = void 0;
exports.readOptionalEnv = readOptionalEnv;
exports.providerRequestConfig = providerRequestConfig;
exports.providerGet = providerGet;
exports.providerPost = providerPost;
exports.isNotFoundError = isNotFoundError;
exports.solanaRpcCall = solanaRpcCall;
exports.fetchSolanaTransaction = fetchSolanaTransaction;
exports.bitcoinProviderBases = bitcoinProviderBases;
exports.fetchBitcoinTransaction = fetchBitcoinTransaction;
exports.fetchBitcoinTipHeight = fetchBitcoinTipHeight;
exports.fetchBitcoinAddressTransactions = fetchBitcoinAddressTransactions;
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const axios_1 = __importDefault(require("axios"));
/**
 * Everything that talks to a public blockchain explorer goes through here.
 *
 * Two problems are solved in one place rather than in each verifier:
 *
 * 1. Address family. These providers publish public A/AAAA records, and Node's
 *    default address selection can attempt a host's IPv6 (AAAA) address first.
 *    Several of them advertise an AAAA record whose IPv6 path is not routable
 *    from ordinary hosting egress; a black-holed connect does not fail fast — it
 *    ends when the request times out, so a perfectly healthy provider is
 *    reported as "unreachable". Every provider used here serves IPv4, so the
 *    socket family is pinned to IPv4 and that failure mode disappears instead of
 *    being retried around.
 *
 * 2. Single point of failure. Bitcoin has several interchangeable Esplora
 *    instances; a dead, rate-limited or geo-blocked endpoint must not be able to
 *    turn a valid deposit into a verification error. The Bitcoin helpers below
 *    walk a list of endpoints and only report a fault once every one of them has
 *    failed — and a definitive "not found" from any endpoint wins, so failover
 *    can never invent a payment that does not exist.
 */
const ipv4AgentOptions = { family: 4, keepAlive: true, maxSockets: 32 };
const sharedHttpAgent = new node_http_1.default.Agent({ ...ipv4AgentOptions });
const sharedHttpsAgent = new node_https_1.default.Agent({ ...ipv4AgentOptions });
exports.PROVIDER_TIMEOUT_MS = 15000;
const PROVIDER_USER_AGENT = "NexaCrypto-DepositVerifier/1.0";
/** Esplora endpoint used when `BTC_BLOCKCHAIN_API_BASE` is not configured. */
exports.DEFAULT_BTC_PRIMARY_API_BASE = "https://blockstream.info/api";
/** Second, independent Esplora instance used when the primary cannot answer. */
exports.DEFAULT_BTC_FALLBACK_API_BASE = "https://mempool.space/api";
function readOptionalEnv(name) {
    const raw = process.env[name];
    if (!raw) {
        return null;
    }
    const trimmed = String(raw).trim();
    return trimmed.length > 0 ? trimmed : null;
}
/**
 * Build the request options used for every provider call. Caller options are
 * merged first so a specific request (params, timeout) still wins, but the
 * agents, timeout ceiling and user agent are always applied.
 */
function providerRequestConfig(config = {}) {
    return {
        timeout: exports.PROVIDER_TIMEOUT_MS,
        maxRedirects: 5,
        ...config,
        httpAgent: sharedHttpAgent,
        httpsAgent: sharedHttpsAgent,
        headers: {
            "User-Agent": PROVIDER_USER_AGENT,
            ...config.headers
        }
    };
}
function providerGet(url, config) {
    return axios_1.default.get(url, providerRequestConfig(config));
}
function providerPost(url, data, config) {
    return axios_1.default.post(url, data, providerRequestConfig(config));
}
/** True when the provider answered "this resource does not exist". */
function isNotFoundError(error) {
    return axios_1.default.isAxiosError(error) && error.response?.status === 404;
}
/**
 * Solana transaction versions are not frozen: mainnet carries versioned
 * transactions beyond the original v0, and an RPC rejects `getTransaction` for
 * any version above `maxSupportedTransactionVersion` instead of returning the
 * transaction. The value below is therefore a floor, not a cap — when the RPC
 * names a newer version, `fetchSolanaTransaction` honours it.
 */
exports.DEFAULT_SOLANA_MAX_TX_VERSION = 0;
const SOLANA_UNSUPPORTED_VERSION_PATTERN = /transaction version \((\d+)\) is not supported/i;
/** A JSON-RPC call to a Solana node, surfacing a JSON-RPC error as a throw. */
async function solanaRpcCall(rpcUrl, method, params) {
    const response = await providerPost(rpcUrl, {
        jsonrpc: "2.0",
        id: 1,
        method,
        params
    });
    if (response.data?.error) {
        throw new Error(response.data.error.message || `Solana RPC ${method} failed`);
    }
    return response.data?.result;
}
/**
 * Fetch a Solana transaction, widening the supported version only when the node
 * says the transaction is newer than the version we asked for. Without this, a
 * perfectly valid versioned transfer is returned as an RPC error and reported to
 * the depositor as a provider fault.
 */
async function fetchSolanaTransaction(rpcUrl, signature) {
    const configured = Number(readOptionalEnv("SOLANA_MAX_SUPPORTED_TRANSACTION_VERSION") ?? exports.DEFAULT_SOLANA_MAX_TX_VERSION);
    const baseVersion = Number.isFinite(configured) && configured >= 0
        ? Math.floor(configured)
        : exports.DEFAULT_SOLANA_MAX_TX_VERSION;
    const attempt = (maxSupportedTransactionVersion) => solanaRpcCall(rpcUrl, "getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion }
    ]);
    try {
        return await attempt(baseVersion);
    }
    catch (error) {
        const match = SOLANA_UNSUPPORTED_VERSION_PATTERN.exec(String(error?.message || ""));
        const requiredVersion = match ? Number(match[1]) : Number.NaN;
        if (!Number.isFinite(requiredVersion) || requiredVersion <= baseVersion) {
            throw error;
        }
        return attempt(requiredVersion);
    }
}
/**
 * The ordered list of Esplora endpoints to try for Bitcoin. The configured base
 * comes first so an operator override is always honoured, and duplicates are
 * removed so a misconfiguration cannot make the same dead endpoint be retried.
 */
function bitcoinProviderBases() {
    const configured = readOptionalEnv("BTC_BLOCKCHAIN_API_BASE");
    const fallback = readOptionalEnv("BTC_BLOCKCHAIN_FALLBACK_API_BASE") || exports.DEFAULT_BTC_FALLBACK_API_BASE;
    const candidates = [
        configured || exports.DEFAULT_BTC_PRIMARY_API_BASE,
        fallback,
        exports.DEFAULT_BTC_PRIMARY_API_BASE
    ];
    const seen = new Set();
    const bases = [];
    for (const candidate of candidates) {
        const base = String(candidate || "").replace(/\/+$/, "");
        if (!/^https?:\/\/.+/i.test(base)) {
            continue;
        }
        const key = base.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        bases.push(base);
    }
    return bases;
}
/**
 * Fetch a Bitcoin transaction by hash, trying every configured Esplora endpoint.
 *
 * A `not_found` answer from any endpoint is authoritative: the transaction
 * genuinely does not exist yet, so there is no point asking the others. Any
 * other failure only moves on to the next endpoint; if every endpoint fails the
 * first error is returned so the caller can classify it (and so the configured
 * provider's error is the one that gets logged).
 */
async function fetchBitcoinTransaction(txHash) {
    const encoded = encodeURIComponent(txHash);
    let sawNotFound = false;
    let firstError = null;
    for (const base of bitcoinProviderBases()) {
        try {
            const [txResponse, tipResponse] = await Promise.all([
                providerGet(`${base}/tx/${encoded}`),
                providerGet(`${base}/blocks/tip/height`)
            ]);
            const tx = txResponse.data;
            if (!tx || typeof tx !== "object" || !Array.isArray(tx.vout)) {
                // An Esplora instance that answers 200 without a transaction body is
                // reporting the same thing as a 404.
                sawNotFound = true;
                continue;
            }
            const tipHeight = Number(tipResponse.data) || 0;
            if (tipHeight <= 0) {
                // The transaction is known but confirmations cannot be established, so
                // treat this endpoint as unusable rather than reporting 0 confirmations.
                firstError = firstError ?? new Error(`${base} did not report a usable chain tip`);
                continue;
            }
            return { kind: "found", tx, tipHeight };
        }
        catch (error) {
            if (isNotFoundError(error)) {
                sawNotFound = true;
                continue;
            }
            firstError = firstError ?? error;
        }
    }
    if (sawNotFound) {
        return { kind: "not_found" };
    }
    return {
        kind: "unavailable",
        error: firstError ?? new Error("No Bitcoin explorer could be reached.")
    };
}
/** Current Bitcoin chain tip, or null when no endpoint could report it. */
async function fetchBitcoinTipHeight() {
    for (const base of bitcoinProviderBases()) {
        try {
            const response = await providerGet(`${base}/blocks/tip/height`);
            const height = Number(response.data);
            if (Number.isFinite(height) && height > 0) {
                return height;
            }
        }
        catch {
            // Try the next endpoint.
        }
    }
    return null;
}
/** Recent transactions touching an address, plus the chain tip when available. */
async function fetchBitcoinAddressTransactions(address) {
    const encoded = encodeURIComponent(address);
    const tipHeight = await fetchBitcoinTipHeight();
    for (const base of bitcoinProviderBases()) {
        try {
            const response = await providerGet(`${base}/address/${encoded}/txs`);
            return {
                rows: Array.isArray(response.data)
                    ? response.data
                    : [],
                tipHeight
            };
        }
        catch (error) {
            if (isNotFoundError(error)) {
                // The address has no history on this endpoint; that is a real answer.
                return { rows: [], tipHeight };
            }
        }
    }
    throw new Error("No Bitcoin explorer could be reached to scan the receiving address.");
}
