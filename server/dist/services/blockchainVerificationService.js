"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SOLANA_RPC_URL = void 0;
exports.platformAddressForCryptoType = platformAddressForCryptoType;
exports.symbolForCryptoType = symbolForCryptoType;
exports.isBlockchainVerificationEnabled = isBlockchainVerificationEnabled;
exports.describeProviderError = describeProviderError;
exports.verifyDepositOnChain = verifyDepositOnChain;
const axios_1 = __importDefault(require("axios"));
const depositRules_1 = require("../domain/depositRules");
const depositNetworkCapabilities_1 = require("../domain/depositNetworkCapabilities");
const tronTrc20_1 = require("../domain/tronTrc20");
const walletService_1 = require("./walletService");
const etherscanClient_1 = require("./etherscanClient");
/** Public Solana mainnet RPC, used only when SOLANA_RPC_URL is not configured. */
exports.DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
function normalizeAddress(address) {
    return address.trim().toLowerCase();
}
/** Base58 is case sensitive, so TRON addresses are compared verbatim. */
function sameBase58Address(a, b) {
    return String(a || "").trim() === String(b || "").trim();
}
function readOptionalEnv(name) {
    const raw = process.env[name];
    if (!raw) {
        return null;
    }
    const trimmed = String(raw).trim();
    return trimmed.length > 0 ? trimmed : null;
}
function hexToNumber(value) {
    const raw = String(value ?? "0");
    if (raw.length === 0) {
        return 0;
    }
    try {
        return Number(BigInt(raw.startsWith("0x") ? raw : `0x${raw}`));
    }
    catch {
        const parsed = Number.parseInt(raw, 16);
        return Number.isFinite(parsed) ? parsed : 0;
    }
}
/** The platform receiving address and network for a crypto type, or null when unconfigured. */
function platformAddressForCryptoType(cryptoType) {
    if (!(0, depositRules_1.isSupportedDepositCryptoType)(cryptoType)) {
        return null;
    }
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)(cryptoType);
    const wallet = (0, walletService_1.getPlatformWallet)(capability.platformAsset);
    if (!wallet) {
        return null;
    }
    return { asset: wallet.asset, address: wallet.address, network: wallet.network };
}
function symbolForCryptoType(cryptoType) {
    return (0, depositRules_1.isSupportedDepositCryptoType)(cryptoType)
        ? (0, depositNetworkCapabilities_1.resolveDepositCapability)(cryptoType).symbol
        : String(cryptoType);
}
/**
 * The verification kill-switch. When it is off the platform does not claim a
 * transfer is valid — it reports the provider as unavailable so the deposit
 * stays pending for administrator reconciliation instead of being auto-advanced.
 */
function isBlockchainVerificationEnabled() {
    return String(process.env.BLOCKCHAIN_VERIFICATION_ENABLED || "true").trim().toLowerCase() !== "false";
}
function buildResult(cryptoType, txHash, stage, overrides = {}) {
    const capability = (0, depositRules_1.isSupportedDepositCryptoType)(cryptoType)
        ? (0, depositNetworkCapabilities_1.resolveDepositCapability)(cryptoType)
        : null;
    return {
        success: stage === "verified",
        stage,
        assetSymbol: capability?.symbol ?? String(cryptoType),
        network: capability?.networkType ?? String(cryptoType),
        txHash,
        amount: 0,
        toAddress: "",
        confirmations: 0,
        minConfirmations: capability?.minConfirmations ?? 0,
        ...overrides
    };
}
function unconfigured(cryptoType, txHash, reason) {
    return buildResult(cryptoType, txHash, "provider_unavailable", { failureReason: reason });
}
/**
 * Strip anything sensitive (API keys, tokens embedded in URLs) out of a provider
 * error before it can reach a log line or a user-facing message. Only the scheme
 * + host + path of any URL survives, so a query-string credential cannot leak.
 */
function sanitizeProviderText(text) {
    let output = String(text || "");
    const secrets = [
        process.env.ETHERSCAN_API_KEY,
        process.env.SOLANA_RPC_URL
    ].filter((value) => Boolean(value && value.trim().length > 0));
    for (const secret of secrets) {
        output = output.split(secret).join("***");
    }
    output = output.replace(/(apikey|api_key|token|secret)=[^&\s"']+/gi, "$1=***");
    output = output.replace(/https?:\/\/[^\s"']+/gi, (url) => {
        try {
            const parsed = new URL(url);
            return `${parsed.origin}${parsed.pathname}`;
        }
        catch {
            return "***";
        }
    });
    return output.length > 300 ? `${output.slice(0, 300)}…` : output;
}
/**
 * Turn any thrown value into a short, secret-free description. Axios failures
 * carry a code (`ETIMEDOUT`, `ENOTFOUND`, …) and an HTTP status; Node surfaces
 * DNS/connect failures as an `AggregateError` whose `message` is empty, so its
 * inner errors are read explicitly rather than logged as a blank string.
 */
function describeProviderError(error) {
    const parts = [];
    if (axios_1.default.isAxiosError(error)) {
        if (error.code) {
            parts.push(String(error.code));
        }
        if (error.response?.status) {
            parts.push(`HTTP ${error.response.status}`);
        }
        const data = error.response?.data;
        if (typeof data === "string") {
            parts.push(data);
        }
        else if (data && typeof data === "object") {
            const record = data;
            const message = record.message ?? record.error ?? record.result;
            if (typeof message === "string") {
                parts.push(message);
            }
        }
        if (parts.length === 0 && error.message) {
            parts.push(error.message);
        }
    }
    else if (Array.isArray(error?.errors)) {
        // Duck-typed because the ES2020 lib target has no global AggregateError.
        parts.push(error.name || "AggregateError");
        const inner = error.errors || [];
        for (const item of inner) {
            const record = item;
            const detail = [record?.code, record?.syscall, record?.message].filter(Boolean).join(" ");
            if (detail) {
                parts.push(detail);
            }
        }
    }
    else if (error instanceof Error) {
        parts.push(error.name);
        if (error.message) {
            parts.push(error.message);
        }
        const code = error.code;
        if (code) {
            parts.push(String(code));
        }
    }
    else {
        parts.push(String(error));
    }
    const joined = parts
        .map((part) => String(part).trim())
        .filter((part) => part.length > 0)
        .join(" | ");
    return sanitizeProviderText(joined) || "unknown provider failure";
}
function providerError(cryptoType, txHash, error, context) {
    const detail = describeProviderError(error);
    // Log the full (sanitised) detail server-side; keep the user-facing sentence generic.
    // eslint-disable-next-line no-console
    console.error(`[blockchain-verification] ${cryptoType} ${context} failed: ${detail}`);
    return buildResult(cryptoType, txHash, "provider_error", {
        failureReason: "We could not reach the blockchain provider to verify this transaction right now. Your deposit stays pending and will be reconciled by an administrator."
    });
}
function stageForHttpError(error) {
    if (axios_1.default.isAxiosError(error) && error.response?.status === 404) {
        return "not_found";
    }
    return "provider_error";
}
async function verifyBitcoinDeposit(params) {
    const { txHash, expectedAmount } = params;
    const platform = platformAddressForCryptoType("BTC");
    if (!platform) {
        return unconfigured("BTC", txHash, "No receiving Bitcoin address is configured.");
    }
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)("BTC");
    try {
        const base = (readOptionalEnv("BTC_BLOCKCHAIN_API_BASE") || "https://blockstream.info/api").replace(/\/+$/, "");
        // Fetch the transaction and the tip height together: Blockstream's `/tx`
        // endpoint does not return a confirmation count, so it must be derived from
        // the height difference. If the tip cannot be read the verification fails
        // closed rather than reporting confirmations of 0 as if it were mined.
        const [txResponse, tipResponse] = await Promise.all([
            axios_1.default.get(`${base}/tx/${encodeURIComponent(txHash)}`, { timeout: 15000 }),
            axios_1.default.get(`${base}/blocks/tip/height`, { timeout: 15000 })
        ]);
        const tx = txResponse.data;
        if (!tx || !Array.isArray(tx.vout)) {
            return buildResult("BTC", txHash, "not_found", {
                failureReason: "We could not find this transaction on the Bitcoin network yet."
            });
        }
        let valueSats = 0;
        let destinationFound = false;
        for (const vout of tx.vout) {
            if (normalizeAddress(String(vout.scriptpubkey_address || "")) === normalizeAddress(platform.address)) {
                destinationFound = true;
                valueSats += Number(vout.value || 0);
            }
        }
        const tipHeight = Number(tipResponse.data) || 0;
        const status = (tx.status || {});
        const blockHeight = Number(status.block_height || 0);
        const confirmed = status.confirmed === true;
        const confirmations = confirmed && tipHeight > 0 && blockHeight > 0 ? (0, etherscanClient_1.confirmationsForBlock)(tipHeight, blockHeight) : 0;
        const amount = valueSats / 1e8;
        if (!destinationFound) {
            return buildResult("BTC", txHash, "mismatch", {
                amount,
                confirmations,
                failureReason: `This transaction does not pay to the platform Bitcoin address.`
            });
        }
        if (!(0, depositRules_1.amountsWithinDepositTolerance)(amount, expectedAmount)) {
            return buildResult("BTC", txHash, "mismatch", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "The on-chain BTC amount does not match the amount for this deposit."
            });
        }
        if (confirmations < capability.minConfirmations) {
            return buildResult("BTC", txHash, "insufficient_confirmations", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "The Bitcoin transaction does not have enough confirmations yet."
            });
        }
        return buildResult("BTC", txHash, "verified", {
            amount,
            toAddress: platform.address,
            confirmations
        });
    }
    catch (error) {
        const stage = stageForHttpError(error);
        if (stage === "not_found") {
            return buildResult("BTC", txHash, "not_found", {
                failureReason: "We could not find this transaction on the Bitcoin network yet."
            });
        }
        return providerError("BTC", txHash, error, "transaction lookup");
    }
}
async function verifyEthereumNativeDeposit(params) {
    const { txHash, expectedAmount } = params;
    const platform = platformAddressForCryptoType("ETH");
    if (!platform) {
        return unconfigured("ETH", txHash, "No receiving Ethereum address is configured.");
    }
    if (!(0, etherscanClient_1.resolveEtherscanConfig)().apiKey) {
        return unconfigured("ETH", txHash, "ETHERSCAN_API_KEY is not configured for Ethereum verification.");
    }
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)("ETH");
    try {
        const tx = (await (0, etherscanClient_1.etherscanTransactionByHash)(txHash));
        if (!tx || typeof tx !== "object") {
            return buildResult("ETH", txHash, "not_found", {
                failureReason: "We could not find this transaction on the Ethereum network yet."
            });
        }
        const toAddress = String(tx.to || "").trim();
        const amount = hexToNumber(tx.value) / 1e18;
        const receipt = (await (0, etherscanClient_1.etherscanTransactionReceipt)(txHash));
        const latestBlock = await (0, etherscanClient_1.etherscanLatestBlockNumber)();
        const txBlock = tx.blockNumber ? hexToNumber(tx.blockNumber) : 0;
        const confirmations = (0, etherscanClient_1.confirmationsForBlock)(latestBlock, txBlock);
        if (normalizeAddress(toAddress) !== normalizeAddress(platform.address)) {
            return buildResult("ETH", txHash, "mismatch", {
                amount,
                toAddress,
                confirmations,
                failureReason: "The Ethereum transaction receiver does not match the platform receiving address."
            });
        }
        if (receipt && String(receipt.status) === "0x0") {
            return buildResult("ETH", txHash, "mismatch", {
                amount,
                toAddress,
                confirmations,
                failureReason: "This Ethereum transaction failed on-chain and did not transfer any value."
            });
        }
        if (!(0, depositRules_1.amountsWithinDepositTolerance)(amount, expectedAmount)) {
            return buildResult("ETH", txHash, "mismatch", {
                amount,
                toAddress,
                confirmations,
                failureReason: "The on-chain ETH amount does not match the amount for this deposit."
            });
        }
        if (confirmations < capability.minConfirmations) {
            return buildResult("ETH", txHash, "insufficient_confirmations", {
                amount,
                toAddress,
                confirmations,
                failureReason: "The Ethereum transaction does not have enough confirmations yet."
            });
        }
        return buildResult("ETH", txHash, "verified", { amount, toAddress, confirmations });
    }
    catch (error) {
        return providerError("ETH", txHash, error, "transaction lookup");
    }
}
async function verifyEthereumUsdtErc20Deposit(params) {
    const { txHash, expectedAmount } = params;
    const platform = platformAddressForCryptoType("ERC20");
    if (!platform) {
        return unconfigured("ERC20", txHash, "No receiving ERC20 address is configured.");
    }
    const contract = readOptionalEnv("USDT_ERC20_CONTRACT_ADDRESS");
    if (!(0, etherscanClient_1.resolveEtherscanConfig)().apiKey) {
        return unconfigured("ERC20", txHash, "ETHERSCAN_API_KEY is not configured for ERC20 verification.");
    }
    if (!contract) {
        return unconfigured("ERC20", txHash, "USDT_ERC20_CONTRACT_ADDRESS is not configured, so ERC20 transfers cannot be verified.");
    }
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)("ERC20");
    try {
        const tx = (await (0, etherscanClient_1.etherscanTransactionByHash)(txHash));
        if (!tx || typeof tx !== "object" || !tx.blockNumber) {
            return buildResult("ERC20", txHash, "not_found", {
                failureReason: "We could not find this USDT (ERC20) transfer on the Ethereum network yet."
            });
        }
        const txBlock = hexToNumber(tx.blockNumber);
        // Etherscan V2 silently ignores `txhash` on `tokentx` unless `address` is
        // supplied, and even then it does not filter by hash — an unfiltered result
        // would validate the wrong transfer. Scope the lookup to the platform
        // address and to the single block the transaction was mined in, then match
        // the hash locally. That keeps the candidate set bounded and precise.
        const events = await (0, etherscanClient_1.etherscanAccountList)("tokentx", {
            address: platform.address,
            contractaddress: contract,
            startblock: txBlock,
            endblock: txBlock,
            sort: "asc"
        });
        const forThisTransaction = events.filter((event) => String(event.hash || "").toLowerCase() === txHash.toLowerCase());
        if (forThisTransaction.length === 0) {
            return buildResult("ERC20", txHash, "not_found", {
                failureReason: "We could not find this USDT (ERC20) transfer yet."
            });
        }
        const contractMatches = forThisTransaction.filter((event) => normalizeAddress(String(event.contractAddress || "")) === normalizeAddress(contract));
        if (contractMatches.length === 0) {
            return buildResult("ERC20", txHash, "mismatch", {
                failureReason: "This transaction does not transfer the supported USDT (ERC20) token."
            });
        }
        const match = contractMatches.find((event) => normalizeAddress(String(event.to || "")) === normalizeAddress(platform.address));
        if (!match) {
            return buildResult("ERC20", txHash, "mismatch", {
                failureReason: "No matching USDT (ERC20) transfer to the platform receiving address was found in this transaction."
            });
        }
        const decimals = Number(match.tokenDecimal || capability.decimals);
        const amount = Number(match.value || 0) / Math.pow(10, decimals);
        const receipt = (await (0, etherscanClient_1.etherscanTransactionReceipt)(txHash));
        const latestBlock = await (0, etherscanClient_1.etherscanLatestBlockNumber)();
        const confirmations = (0, etherscanClient_1.confirmationsForBlock)(latestBlock, Number(match.blockNumber || 0));
        if (receipt && String(receipt.status) === "0x0") {
            return buildResult("ERC20", txHash, "mismatch", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "This Ethereum transaction failed on-chain and did not transfer any USDT."
            });
        }
        if (!(0, depositRules_1.amountsWithinDepositTolerance)(amount, expectedAmount)) {
            return buildResult("ERC20", txHash, "mismatch", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "The on-chain USDT (ERC20) amount does not match the amount for this deposit."
            });
        }
        if (confirmations < capability.minConfirmations) {
            return buildResult("ERC20", txHash, "insufficient_confirmations", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "The USDT (ERC20) transfer does not have enough confirmations yet."
            });
        }
        return buildResult("ERC20", txHash, "verified", {
            amount,
            toAddress: platform.address,
            confirmations
        });
    }
    catch (error) {
        return providerError("ERC20", txHash, error, "token transfer lookup");
    }
}
async function verifyTronUsdtTrc20Deposit(params) {
    const { txHash, expectedAmount } = params;
    const platform = platformAddressForCryptoType("TRC20");
    if (!platform) {
        return unconfigured("TRC20", txHash, "No receiving TRC20 address is configured.");
    }
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)("TRC20");
    const base = (readOptionalEnv("TRONSCAN_API_BASE") || "https://apilist.tronscanapi.com/api").replace(/\/+$/, "");
    const contract = readOptionalEnv("USDT_TRC20_CONTRACT_ADDRESS");
    try {
        const response = await axios_1.default.get(`${base}/transaction-info`, {
            timeout: 15000,
            params: { hash: txHash }
        });
        const tx = response.data;
        if (!tx || typeof tx !== "object" || Object.keys(tx).length === 0) {
            return buildResult("TRC20", txHash, "not_found", {
                failureReason: "We could not find this transaction on the Tron network yet."
            });
        }
        const contractData = (tx.contractData || {});
        // Tronscan encodes the recipient and amount inside the ABI `data` blob; the
        // friendly `to_address` / `amount` fields are not returned.
        const decoded = (0, tronTrc20_1.decodeTrc20Transfer)(String(contractData.data || ""));
        if (!decoded) {
            return buildResult("TRC20", txHash, "mismatch", {
                failureReason: "This transaction is not a TRC20 token transfer."
            });
        }
        const tokenContract = String(contractData.contract_address || tx.contract_address || "").trim();
        const amount = (0, tronTrc20_1.rawTokenAmountToNumber)(decoded.amountRaw, capability.decimals);
        const confirmations = Number(tx.confirmations || 0);
        const contractRet = String(tx.contractRet || "").trim().toUpperCase();
        if (contract && tokenContract && !sameBase58Address(tokenContract, contract)) {
            return buildResult("TRC20", txHash, "mismatch", {
                amount,
                toAddress: decoded.toBase58,
                confirmations,
                failureReason: "This transaction does not transfer the supported USDT (TRC20) token."
            });
        }
        if (!sameBase58Address(decoded.toBase58, platform.address)) {
            return buildResult("TRC20", txHash, "mismatch", {
                amount,
                toAddress: decoded.toBase58,
                confirmations,
                failureReason: "The TRC20 receiver address does not match the platform receiving address."
            });
        }
        if (contractRet && contractRet !== "SUCCESS") {
            return buildResult("TRC20", txHash, "mismatch", {
                amount,
                toAddress: decoded.toBase58,
                confirmations,
                failureReason: "This TRC20 transaction failed on-chain and did not transfer any USDT."
            });
        }
        if (!(0, depositRules_1.amountsWithinDepositTolerance)(amount, expectedAmount)) {
            return buildResult("TRC20", txHash, "mismatch", {
                amount,
                toAddress: decoded.toBase58,
                confirmations,
                failureReason: "The on-chain USDT (TRC20) amount does not match the amount for this deposit."
            });
        }
        if (confirmations < capability.minConfirmations) {
            return buildResult("TRC20", txHash, "insufficient_confirmations", {
                amount,
                toAddress: decoded.toBase58,
                confirmations,
                failureReason: "The USDT (TRC20) transfer does not have enough confirmations yet."
            });
        }
        return buildResult("TRC20", txHash, "verified", {
            amount,
            toAddress: decoded.toBase58,
            confirmations
        });
    }
    catch (error) {
        const stage = stageForHttpError(error);
        if (stage === "not_found") {
            return buildResult("TRC20", txHash, "not_found", {
                failureReason: "We could not find this transaction on the Tron network yet."
            });
        }
        return providerError("TRC20", txHash, error, "transaction lookup");
    }
}
async function solanaRpc(rpcUrl, method, params) {
    const response = await axios_1.default.post(rpcUrl, { jsonrpc: "2.0", id: 1, method, params }, { timeout: 15000 });
    if (response.data?.error) {
        throw new Error(response.data.error.message || `Solana RPC ${method} failed`);
    }
    return response.data?.result;
}
async function verifySolanaDeposit(params) {
    const { txHash, expectedAmount } = params;
    const platform = platformAddressForCryptoType("SOL");
    if (!platform) {
        return unconfigured("SOL", txHash, "No receiving Solana address is configured.");
    }
    // The platform only accepts native SOL transfers (no SPL tokens), so a token
    // mint check is not applicable: the verified amount is the lamport balance
    // delta of the receiving account itself.
    const rpcUrl = readOptionalEnv("SOLANA_RPC_URL") || exports.DEFAULT_SOLANA_RPC_URL;
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)("SOL");
    try {
        const result = (await solanaRpc(rpcUrl, "getTransaction", [
            txHash,
            { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }
        ]));
        if (!result) {
            return buildResult("SOL", txHash, "not_found", {
                failureReason: "We could not find this transaction on the Solana network yet."
            });
        }
        const transaction = (result.transaction || {});
        const message = (transaction.message || {});
        const meta = (result.meta || {});
        const accountKeys = Array.isArray(message.accountKeys)
            ? message.accountKeys
            : [];
        const preBalances = Array.isArray(meta.preBalances) ? meta.preBalances : [];
        const postBalances = Array.isArray(meta.postBalances) ? meta.postBalances : [];
        const index = accountKeys.findIndex((key) => normalizeAddress(String(key.pubkey || "")) === normalizeAddress(platform.address));
        if (index === -1) {
            return buildResult("SOL", txHash, "mismatch", {
                failureReason: "This transaction does not involve the platform receiving address."
            });
        }
        const amount = (Number(postBalances[index] || 0) - Number(preBalances[index] || 0)) / 1e9;
        const statusResp = (await solanaRpc(rpcUrl, "getSignatureStatuses", [
            [txHash],
            { searchTransactionHistory: true }
        ]));
        const status = statusResp?.value?.[0];
        const confirmations = typeof status?.confirmations === "number"
            ? status.confirmations
            : status?.confirmationStatus === "finalized"
                ? capability.minConfirmations
                : 0;
        if (meta.err) {
            return buildResult("SOL", txHash, "mismatch", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "This Solana transaction failed on-chain and did not transfer any SOL."
            });
        }
        if (amount <= 0) {
            return buildResult("SOL", txHash, "mismatch", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "This transaction does not transfer SOL to the platform receiving address."
            });
        }
        if (!(0, depositRules_1.amountsWithinDepositTolerance)(amount, expectedAmount)) {
            return buildResult("SOL", txHash, "mismatch", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "The on-chain SOL amount does not match the amount for this deposit."
            });
        }
        if (confirmations < capability.minConfirmations) {
            return buildResult("SOL", txHash, "insufficient_confirmations", {
                amount,
                toAddress: platform.address,
                confirmations,
                failureReason: "The Solana transaction does not have enough confirmations yet."
            });
        }
        return buildResult("SOL", txHash, "verified", {
            amount,
            toAddress: platform.address,
            confirmations
        });
    }
    catch (error) {
        return providerError("SOL", txHash, error, "RPC lookup");
    }
}
/**
 * Independently verify a transaction against the correct chain.
 *
 * Only the transaction hash and the expected amount come from the caller; the
 * receiving address, asset, network and confirmation threshold are all read
 * from platform configuration, so a client can never influence what counts as a
 * valid payment. Every failure mode is reported as a stage rather than thrown,
 * and a missing provider is reported as `provider_unavailable` — never as a
 * success.
 */
async function verifyDepositOnChain(params) {
    if (!(0, depositRules_1.isSupportedDepositCryptoType)(params.cryptoType)) {
        return buildResult(params.cryptoType, params.txHash, "provider_unavailable", {
            failureReason: `Verification is not implemented for ${String(params.cryptoType)}.`
        });
    }
    if (!isBlockchainVerificationEnabled()) {
        return unconfigured(params.cryptoType, params.txHash, "On-chain verification is disabled by configuration, so deposits must be reconciled by an administrator.");
    }
    switch (params.cryptoType) {
        case "BTC":
            return verifyBitcoinDeposit(params);
        case "ETH":
            return verifyEthereumNativeDeposit(params);
        case "SOL":
            return verifySolanaDeposit(params);
        case "ERC20":
            return verifyEthereumUsdtErc20Deposit(params);
        case "TRC20":
            return verifyTronUsdtTrc20Deposit(params);
        default:
            return buildResult(params.cryptoType, params.txHash, "provider_unavailable", {
                failureReason: `Verification is not implemented for ${String(params.cryptoType)}.`
            });
    }
}
