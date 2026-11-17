"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverIncomingTransactions = discoverIncomingTransactions;
exports.runDepositMonitor = runDepositMonitor;
exports.rescanDeposit = rescanDeposit;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const depositRules_1 = require("../domain/depositRules");
const depositNetworkCapabilities_1 = require("../domain/depositNetworkCapabilities");
const depositLifecycleService_1 = require("./depositLifecycleService");
const walletService_1 = require("./walletService");
const blockchainVerificationService_1 = require("./blockchainVerificationService");
const etherscanClient_1 = require("./etherscanClient");
const blockchainProviderClient_1 = require("./blockchainProviderClient");
const LOOKBACK_SECONDS_DEFAULT = 48 * 60 * 60;
const DISCOVERY_LIMIT = 50;
function normalizeAddress(address) {
    return address.trim().toLowerCase();
}
/**
 * A duplicate hash is rejected by the database's unique index as a side effect
 * of the concurrent write, so it surfaces as a constraint error rather than the
 * friendly reuse check. Report it in plain language; anything else keeps its
 * own message.
 */
function describeMatchError(error) {
    if (error instanceof sequelize_1.UniqueConstraintError) {
        return "this transaction is already attached to another deposit";
    }
    return error instanceof Error ? error.message : String(error);
}
function readPositiveInt(name, fallback) {
    const raw = process.env[name];
    if (!raw || String(raw).trim().length === 0) {
        return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
function unconfigured(reason) {
    return { configured: false, reason, transactions: [] };
}
function failed(reason) {
    return { configured: true, reason, transactions: [] };
}
async function discoverBitcoin(address, sinceUnixSeconds) {
    // Shares the verifier's Esplora failover and IPv4 pinning, so scanning the
    // receiving address keeps working when the primary explorer is unreachable.
    const { rows, tipHeight: reportedTip } = await (0, blockchainProviderClient_1.fetchBitcoinAddressTransactions)(address);
    const tipHeight = reportedTip ?? 0;
    const transactions = [];
    for (const row of rows) {
        const status = (row.status || {});
        const blockTime = Number(status.block_time || 0);
        if (blockTime > 0 && blockTime < sinceUnixSeconds) {
            continue;
        }
        const vout = Array.isArray(row.vout)
            ? row.vout
            : [];
        let sats = 0;
        for (const output of vout) {
            if (normalizeAddress(String(output.scriptpubkey_address || "")) === normalizeAddress(address)) {
                sats += Number(output.value || 0);
            }
        }
        if (sats <= 0) {
            continue;
        }
        const blockHeight = Number(status.block_height || 0);
        const confirmations = status.confirmed === true && tipHeight > 0 && blockHeight > 0
            ? tipHeight - blockHeight + 1
            : 0;
        transactions.push({
            txHash: String(row.txid || ""),
            amount: sats / 1e8,
            toAddress: address,
            confirmations,
            memo: null,
            occurredAt: blockTime > 0 ? new Date(blockTime * 1000).toISOString() : null
        });
    }
    return { configured: true, reason: null, transactions };
}
async function discoverEthereumNative(address, sinceUnixSeconds) {
    const apiKey = (0, etherscanClient_1.resolveEtherscanConfig)().apiKey;
    if (!apiKey) {
        return unconfigured("ETHERSCAN_API_KEY is not configured, so incoming ETH transfers cannot be discovered automatically.");
    }
    // Etherscan V2 only: the chain id is applied by the shared client.
    const rows = await (0, etherscanClient_1.etherscanAccountList)("txlist", {
        address,
        sort: "desc",
        page: 1,
        offset: DISCOVERY_LIMIT
    });
    const transactions = [];
    for (const row of rows) {
        if (normalizeAddress(String(row.to || "")) !== normalizeAddress(address)) {
            continue;
        }
        const time = Number(row.timeStamp || 0);
        if (time > 0 && time < sinceUnixSeconds) {
            continue;
        }
        const amount = Number(row.value || 0) / 1e18;
        if (amount <= 0) {
            continue;
        }
        transactions.push({
            txHash: String(row.hash || ""),
            amount,
            toAddress: String(row.to || ""),
            confirmations: Number(row.confirmations || 0),
            memo: null,
            occurredAt: time > 0 ? new Date(time * 1000).toISOString() : null
        });
    }
    return { configured: true, reason: null, transactions };
}
async function discoverEthereumUsdt(address, sinceUnixSeconds) {
    const apiKey = (0, etherscanClient_1.resolveEtherscanConfig)().apiKey;
    const contract = (0, blockchainProviderClient_1.readOptionalEnv)("USDT_ERC20_CONTRACT_ADDRESS");
    if (!apiKey || !contract) {
        return unconfigured(!apiKey
            ? "ETHERSCAN_API_KEY is not configured, so incoming USDT (ERC20) transfers cannot be discovered automatically."
            : "USDT_ERC20_CONTRACT_ADDRESS is not configured, so incoming USDT (ERC20) transfers cannot be discovered automatically.");
    }
    // Etherscan V2 only: the address scopes the lookup and the chain id is applied
    // by the shared client.
    const rows = await (0, etherscanClient_1.etherscanAccountList)("tokentx", {
        address,
        contractaddress: contract,
        sort: "desc",
        page: 1,
        offset: DISCOVERY_LIMIT
    });
    const transactions = [];
    for (const row of rows) {
        if (normalizeAddress(String(row.contractAddress || "")) !== normalizeAddress(contract)) {
            continue;
        }
        if (normalizeAddress(String(row.to || "")) !== normalizeAddress(address)) {
            continue;
        }
        const time = Number(row.timeStamp || 0);
        if (time > 0 && time < sinceUnixSeconds) {
            continue;
        }
        const decimals = Number(row.tokenDecimal || 6);
        const amount = Number(row.value || 0) / Math.pow(10, decimals);
        if (amount <= 0) {
            continue;
        }
        transactions.push({
            txHash: String(row.hash || ""),
            amount,
            toAddress: String(row.to || ""),
            confirmations: Number(row.confirmations || 0),
            memo: null,
            occurredAt: time > 0 ? new Date(time * 1000).toISOString() : null
        });
    }
    return { configured: true, reason: null, transactions };
}
async function discoverTronUsdt(address, sinceUnixSeconds) {
    const base = (0, blockchainProviderClient_1.readOptionalEnv)("TRONSCAN_API_BASE") || "https://apilist.tronscanapi.com/api";
    const token = (0, blockchainProviderClient_1.readOptionalEnv)("USDT_TRC20_CONTRACT_ADDRESS");
    const response = await (0, blockchainProviderClient_1.providerGet)(`${base.replace(/\/+$/, "")}/filter/trc20/transfers`, {
        params: { relatedAddress: address, limit: DISCOVERY_LIMIT, start: 0 }
    });
    const rows = Array.isArray(response.data?.data)
        ? response.data.data
        : [];
    const transactions = [];
    for (const row of rows) {
        if (normalizeAddress(String(row.to || "")) !== normalizeAddress(address)) {
            continue;
        }
        if (token) {
            const contract = String(row.contract_address || row.tokenAddress || "");
            if (contract && normalizeAddress(contract) !== normalizeAddress(token)) {
                continue;
            }
        }
        const timeMs = Number(row.timestamp || 0);
        if (timeMs > 0 && timeMs / 1000 < sinceUnixSeconds) {
            continue;
        }
        const decimals = Number(row.tokenInfo?.tokenDecimal || 6);
        const amount = Number(row.quant || 0) / Math.pow(10, decimals);
        if (amount <= 0) {
            continue;
        }
        transactions.push({
            txHash: String(row.transaction_id || ""),
            amount,
            toAddress: String(row.to || ""),
            confirmations: row.confirmed === true ? readPositiveInt("TRC20_MIN_CONFIRMATIONS", 20) : 0,
            memo: null,
            occurredAt: timeMs > 0 ? new Date(timeMs).toISOString() : null
        });
    }
    return { configured: true, reason: null, transactions };
}
async function discoverSolana(address, sinceUnixSeconds) {
    const rpcUrl = (0, blockchainProviderClient_1.readOptionalEnv)("SOLANA_RPC_URL");
    if (!rpcUrl) {
        return unconfigured("SOLANA_RPC_URL is not configured, so incoming SOL transfers cannot be discovered automatically.");
    }
    const signatures = (await (0, blockchainProviderClient_1.solanaRpcCall)(rpcUrl, "getSignaturesForAddress", [
        address,
        { limit: Math.min(25, DISCOVERY_LIMIT) }
    ]));
    const transactions = [];
    for (const entry of signatures || []) {
        if (entry.err) {
            continue;
        }
        const blockTime = typeof entry.blockTime === "number" ? entry.blockTime : 0;
        if (blockTime > 0 && blockTime < sinceUnixSeconds) {
            continue;
        }
        const detail = (await (0, blockchainProviderClient_1.fetchSolanaTransaction)(rpcUrl, entry.signature));
        if (!detail) {
            continue;
        }
        const transaction = (detail.transaction || {});
        const message = (transaction.message || {});
        const meta = (detail.meta || {});
        const accountKeys = Array.isArray(message.accountKeys)
            ? message.accountKeys
            : [];
        const preBalances = Array.isArray(meta.preBalances) ? meta.preBalances : [];
        const postBalances = Array.isArray(meta.postBalances) ? meta.postBalances : [];
        const index = accountKeys.findIndex((key) => normalizeAddress(String(key.pubkey || "")) === normalizeAddress(address));
        if (index === -1) {
            continue;
        }
        const amount = (Number(postBalances[index] || 0) - Number(preBalances[index] || 0)) / 1e9;
        if (amount <= 0) {
            continue;
        }
        const statuses = (await (0, blockchainProviderClient_1.solanaRpcCall)(rpcUrl, "getSignatureStatuses", [
            [entry.signature],
            { searchTransactionHistory: true }
        ]));
        const status = statuses?.value?.[0];
        const minConfirmations = readPositiveInt("SOL_MIN_CONFIRMATIONS", 10);
        const confirmations = typeof status?.confirmations === "number"
            ? status.confirmations
            : status?.confirmationStatus === "finalized"
                ? minConfirmations
                : 0;
        transactions.push({
            txHash: entry.signature,
            amount,
            toAddress: address,
            confirmations,
            memo: null,
            occurredAt: blockTime > 0 ? new Date(blockTime * 1000).toISOString() : null
        });
    }
    return { configured: true, reason: null, transactions };
}
/**
 * Discover recent incoming transfers to a receiving address for one network.
 *
 * The function never fabricates a transfer: a network whose provider is not
 * configured returns `configured: false` with a reason, and the deposit stays
 * pending for administrator reconciliation instead of being silently ignored.
 */
async function discoverIncomingTransactions(cryptoType, address, sinceUnixSeconds) {
    try {
        switch (cryptoType) {
            case "BTC":
                return await discoverBitcoin(address, sinceUnixSeconds);
            case "ETH":
                return await discoverEthereumNative(address, sinceUnixSeconds);
            case "ERC20":
                return await discoverEthereumUsdt(address, sinceUnixSeconds);
            case "TRC20":
                return await discoverTronUsdt(address, sinceUnixSeconds);
            case "SOL":
                return await discoverSolana(address, sinceUnixSeconds);
            default:
                return unconfigured(`No chain monitor is implemented for ${String(cryptoType)}.`);
        }
    }
    catch (error) {
        return failed(error instanceof Error ? error.message : String(error));
    }
}
function pickCandidate(deposits, amount) {
    let best = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const deposit of deposits) {
        const expected = Number(deposit.amount);
        if (!(0, depositRules_1.amountsWithinDepositTolerance)(amount, expected)) {
            continue;
        }
        const delta = Math.abs(amount - expected) / expected;
        if (delta < bestDelta) {
            best = deposit;
            bestDelta = delta;
        }
    }
    return best;
}
function memoSatisfied(deposit, capabilityMemoSupported, incomingMemo) {
    // Only networks that genuinely carry a memo are constrained: for those, a
    // deposit that expects an identifier must see the same identifier arrive.
    if (!capabilityMemoSupported) {
        return true;
    }
    if (!deposit.memo) {
        return true;
    }
    if (!incomingMemo) {
        return false;
    }
    return incomingMemo.trim().toLowerCase() === deposit.memo.trim().toLowerCase();
}
/**
 * Poll every network that has an outstanding deposit and match incoming
 * transfers to the correct pending deposit.
 *
 * The scan is deliberately conservative:
 *  - a transaction whose hash is already attached to any deposit is skipped, so
 *    one on-chain transfer can never fund two deposits,
 *  - the amount must sit within the shared tolerance of the deposit's expected
 *    amount,
 *  - the transfer is then re-verified independently (address, network, amount,
 *    confirmations) before the deposit advances,
 *  - a verified transfer stops at AWAITING_ADMIN_APPROVAL; the monitor never
 *    credits a wallet.
 */
async function runDepositMonitor() {
    const summary = {
        scanned: 0,
        matched: 0,
        advanced: 0,
        expired: 0,
        errors: []
    };
    summary.expired = await (0, depositLifecycleService_1.expireStaleDeposits)();
    const active = await (0, depositLifecycleService_1.listActiveDepositsForMonitor)();
    if (active.length === 0) {
        return summary;
    }
    summary.scanned = active.length;
    const allHashes = await Deposit_1.Deposit.findAll({
        where: { tx_hash: { [sequelize_1.Op.ne]: null } },
        attributes: ["tx_hash"]
    });
    const usedHashes = new Set(allHashes.map((row) => String(row.tx_hash || "").toLowerCase()).filter((value) => value.length > 0));
    const byCryptoType = new Map();
    for (const deposit of active) {
        if (!(0, depositRules_1.isSupportedDepositCryptoType)(deposit.crypto_type)) {
            continue;
        }
        const list = byCryptoType.get(deposit.crypto_type) || [];
        list.push(deposit);
        byCryptoType.set(deposit.crypto_type, list);
    }
    const lookback = readPositiveInt("DEPOSIT_MONITOR_LOOKBACK_SECONDS", LOOKBACK_SECONDS_DEFAULT);
    const floor = Math.floor(Date.now() / 1000) - lookback;
    for (const [cryptoType, deposits] of byCryptoType) {
        const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)(cryptoType);
        const wallet = (0, walletService_1.getPlatformWallet)(capability.platformAsset);
        if (!wallet) {
            summary.errors.push({
                cryptoType,
                reason: `No receiving address is configured for ${capability.networkLabel}.`
            });
            continue;
        }
        const earliest = deposits.reduce((min, deposit) => {
            const stamp = (deposit.timestamp || new Date()).getTime() / 1000;
            return Math.min(min, Math.floor(stamp));
        }, Number.POSITIVE_INFINITY);
        const since = Math.min(floor, Number.isFinite(earliest) ? earliest : floor);
        const discovery = await discoverIncomingTransactions(cryptoType, wallet.address, since);
        if (!discovery.configured || discovery.reason) {
            summary.errors.push({
                cryptoType,
                reason: discovery.reason || "Incoming transfers could not be listed."
            });
            continue;
        }
        // A matched deposit is removed from the working set so a second incoming
        // transfer in the same pass cannot be matched to the same deposit.
        const remaining = deposits.filter((deposit) => !deposit.tx_hash && (0, depositLifecycleService_1.detailedStatusOf)(deposit) !== "AWAITING_ADMIN_APPROVAL");
        for (const incoming of discovery.transactions) {
            const hash = incoming.txHash.toLowerCase();
            if (hash.length === 0 || usedHashes.has(hash)) {
                continue;
            }
            const target = pickCandidate(remaining, incoming.amount);
            if (!target) {
                continue;
            }
            if (!memoSatisfied(target, capability.memo.supported, incoming.memo)) {
                continue;
            }
            const targetIndex = remaining.indexOf(target);
            if (targetIndex >= 0) {
                remaining.splice(targetIndex, 1);
            }
            const verification = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
                cryptoType,
                txHash: incoming.txHash,
                expectedAmount: Number(target.amount)
            });
            if (verification.success) {
                try {
                    await (0, depositLifecycleService_1.recordVerifiedPayment)(target.deposit_id, verification);
                }
                catch (error) {
                    summary.errors.push({
                        cryptoType,
                        reason: `Transaction ${incoming.txHash} could not be attached to deposit ${target.reference ?? target.deposit_id}: ${describeMatchError(error)}`
                    });
                    continue;
                }
                usedHashes.add(hash);
                target.tx_hash = incoming.txHash;
                summary.matched += 1;
                summary.advanced += 1;
                continue;
            }
            if (verification.stage === "insufficient_confirmations") {
                try {
                    await (0, depositLifecycleService_1.applyVerificationResult)(target, verification);
                }
                catch (error) {
                    summary.errors.push({
                        cryptoType,
                        reason: `Transaction ${incoming.txHash} could not be recorded for deposit ${target.reference ?? target.deposit_id}: ${describeMatchError(error)}`
                    });
                    continue;
                }
                usedHashes.add(hash);
                target.tx_hash = incoming.txHash;
                summary.matched += 1;
                continue;
            }
            summary.errors.push({
                cryptoType,
                reason: `Transaction ${incoming.txHash} did not verify for deposit ${target.reference ?? target.deposit_id}: ${verification.failureReason || verification.stage}`
            });
        }
    }
    return summary;
}
/**
 * Re-check one deposit against its network right now. Used by the administrator
 * reconciliation action and by the "check now" control on the payment screen.
 * The outcome is always derived from an independent chain lookup.
 */
async function rescanDeposit(depositId) {
    const deposit = await Deposit_1.Deposit.findByPk(depositId);
    if (!deposit) {
        return { matched: false, advanced: false, reason: "Deposit not found.", txHash: null };
    }
    if (!(0, depositRules_1.isSupportedDepositCryptoType)(deposit.crypto_type)) {
        return {
            matched: false,
            advanced: false,
            reason: "This deposit uses an asset the platform cannot scan.",
            txHash: deposit.tx_hash ?? null
        };
    }
    const capability = (0, depositNetworkCapabilities_1.resolveDepositCapability)(deposit.crypto_type);
    const wallet = (0, walletService_1.getPlatformWallet)(capability.platformAsset);
    if (!wallet) {
        return {
            matched: false,
            advanced: false,
            reason: `No receiving address is configured for ${capability.networkLabel}.`,
            txHash: deposit.tx_hash ?? null
        };
    }
    if (deposit.tx_hash) {
        const verification = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
            cryptoType: deposit.crypto_type,
            txHash: deposit.tx_hash,
            expectedAmount: Number(deposit.amount)
        });
        if (verification.success) {
            try {
                await (0, depositLifecycleService_1.recordVerifiedPayment)(deposit.deposit_id, verification);
            }
            catch (error) {
                return {
                    matched: false,
                    advanced: false,
                    reason: `This transaction could not be attached to this deposit: ${describeMatchError(error)}.`,
                    txHash: deposit.tx_hash
                };
            }
            return {
                matched: true,
                advanced: true,
                reason: "We've verified your transaction on the blockchain. It is now awaiting administrator approval.",
                txHash: deposit.tx_hash
            };
        }
        const updated = await (0, depositLifecycleService_1.applyVerificationResult)(deposit, verification);
        return {
            matched: verification.stage === "insufficient_confirmations",
            advanced: false,
            reason: verification.failureReason ||
                "The recorded transaction could not be verified on-chain yet.",
            txHash: updated.tx_hash ?? deposit.tx_hash
        };
    }
    const lookback = readPositiveInt("DEPOSIT_MONITOR_LOOKBACK_SECONDS", LOOKBACK_SECONDS_DEFAULT);
    const since = Math.floor((deposit.timestamp || new Date()).getTime() / 1000) - 300;
    const discovery = await discoverIncomingTransactions(deposit.crypto_type, wallet.address, Math.min(since, Math.floor(Date.now() / 1000) - lookback));
    if (!discovery.configured) {
        return {
            matched: false,
            advanced: false,
            reason: discovery.reason || "Automatic scanning is unavailable for this network.",
            txHash: null
        };
    }
    const usedHashes = await Deposit_1.Deposit.findAll({
        where: { tx_hash: { [sequelize_1.Op.ne]: null } },
        attributes: ["tx_hash"]
    });
    const used = new Set(usedHashes.map((row) => String(row.tx_hash || "").toLowerCase()).filter((value) => value.length > 0));
    for (const incoming of discovery.transactions) {
        if (used.has(incoming.txHash.toLowerCase())) {
            continue;
        }
        if (!(0, depositRules_1.amountsWithinDepositTolerance)(incoming.amount, Number(deposit.amount))) {
            continue;
        }
        const verification = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
            cryptoType: deposit.crypto_type,
            txHash: incoming.txHash,
            expectedAmount: Number(deposit.amount)
        });
        try {
            await (0, depositLifecycleService_1.applyVerificationResult)(deposit, verification);
        }
        catch (error) {
            if (error instanceof sequelize_1.UniqueConstraintError) {
                // Another deposit claimed this transaction first; try the next candidate.
                used.add(incoming.txHash.toLowerCase());
                continue;
            }
            throw error;
        }
        if (verification.success) {
            return {
                matched: true,
                advanced: true,
                reason: "We've verified your transaction on the blockchain. It is now awaiting administrator approval.",
                txHash: incoming.txHash
            };
        }
        if (verification.stage === "insufficient_confirmations") {
            return {
                matched: true,
                advanced: false,
                reason: "We've detected your transaction and are checking its confirmations.",
                txHash: incoming.txHash
            };
        }
    }
    return {
        matched: false,
        advanced: false,
        reason: "No matching transfer has been detected on the selected network yet. Once your transfer is broadcast it can take a few minutes to appear.",
        txHash: null
    };
}
