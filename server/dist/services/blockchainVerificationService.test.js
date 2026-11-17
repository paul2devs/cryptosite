"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const axios_1 = __importDefault(require("axios"));
/**
 * Deterministic platform configuration. Every reader in the verification stack
 * reads `process.env` lazily, so setting these here (before any call) is enough
 * to pin the receiving addresses, contracts and confirmation thresholds.
 */
process.env.BLOCKCHAIN_VERIFICATION_ENABLED = "true";
process.env.BTC_DEPOSIT_ADDRESS = "bc1qg626afhea5ysw9a470c0ewa3dyapw0avff4em6";
process.env.ETH_DEPOSIT_ADDRESS = "0xcE3AFeE928f519e7057cf3f487D44286f7c324f8";
process.env.SOL_DEPOSIT_ADDRESS = "9i5fDc2wEfqzcR4mu4bVyR2iXpQbYC3GdEodqAZp6FbG";
process.env.USDT_TRC20_DEPOSIT_ADDRESS = "TTCLFjW1EdAFEWemoNfgzvNfVr9Ex4R5vP";
process.env.USDT_ERC20_DEPOSIT_ADDRESS = "0xcE3AFeE928f519e7057cf3f487D44286f7c324f8";
process.env.BTC_BLOCKCHAIN_API_BASE = "https://blockstream.info/api";
process.env.ETHERSCAN_API_BASE = "https://api.etherscan.io/v2/api";
process.env.ETHERSCAN_API_KEY = "TEST-ETHERSCAN-KEY";
process.env.ETHEREUM_CHAIN_ID = "1";
process.env.USDT_ERC20_CONTRACT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
process.env.TRONSCAN_API_BASE = "https://apilist.tronscanapi.com/api";
process.env.USDT_TRC20_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
process.env.SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
process.env.BTC_MIN_CONFIRMATIONS = "2";
process.env.ETH_MIN_CONFIRMATIONS = "6";
process.env.ERC20_MIN_CONFIRMATIONS = "6";
process.env.TRC20_MIN_CONFIRMATIONS = "20";
process.env.SOL_MIN_CONFIRMATIONS = "10";
const blockchainVerificationService_1 = require("./blockchainVerificationService");
const walletService_1 = require("./walletService");
const BTC_ADDR = process.env.BTC_DEPOSIT_ADDRESS;
const ETH_ADDR = process.env.ETH_DEPOSIT_ADDRESS;
const SOL_ADDR = process.env.SOL_DEPOSIT_ADDRESS;
const TRC20_ADDR = process.env.USDT_TRC20_DEPOSIT_ADDRESS;
const ERC20_CONTRACT = process.env.USDT_ERC20_CONTRACT_ADDRESS;
const TRC20_CONTRACT = process.env.USDT_TRC20_CONTRACT_ADDRESS;
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";
const TRON_BASE = "https://apilist.tronscanapi.com/api";
const SOL_RPC = "https://api.mainnet-beta.solana.com";
const BTC_TIP = 800000;
let routes = [];
const getCalls = [];
const postCalls = [];
function mockAxiosError(overrides) {
    const error = new Error(overrides.message || "simulated provider failure");
    error.isAxiosError = true;
    if (overrides.code) {
        error.code = overrides.code;
    }
    if (overrides.status) {
        error.response = { status: overrides.status, data: overrides.data };
    }
    return error;
}
const originalGet = axios_1.default.get;
const originalPost = axios_1.default.post;
(0, node_test_1.before)(() => {
    axios_1.default.get = async (url, config) => {
        getCalls.push({ url, params: config?.params });
        const route = routes.find((candidate) => candidate.method === "get" && candidate.match(url, config));
        if (!route) {
            throw mockAxiosError({ code: "ENOTFOUND", message: `no mock route for GET ${url}` });
        }
        return { data: route.respond(url, config) };
    };
    axios_1.default.post = async (url, body) => {
        postCalls.push({ url, body });
        const context = { data: body };
        const route = routes.find((candidate) => candidate.method === "post" && candidate.match(url, context));
        if (!route) {
            throw mockAxiosError({ code: "ENOTFOUND", message: `no mock route for POST ${url}` });
        }
        return { data: route.respond(url, context) };
    };
});
(0, node_test_1.after)(() => {
    axios_1.default.get = originalGet;
    axios_1.default.post = originalPost;
});
(0, node_test_1.beforeEach)(() => {
    routes = [];
    getCalls.length = 0;
    postCalls.length = 0;
    (0, walletService_1.resetPlatformWalletCache)();
});
// ---------------------------------------------------------------------------
// Route builders
// ---------------------------------------------------------------------------
function btcRoutes(tx, tip) {
    return [
        { method: "get", match: (url) => url.includes("/tx/"), respond: () => tx },
        { method: "get", match: (url) => url.endsWith("/blocks/tip/height"), respond: () => tip }
    ];
}
function btcTx(to, sats, confirmations) {
    return {
        status: {
            confirmed: true,
            block_height: BTC_TIP - confirmations + 1,
            block_hash: "0000000000000000000",
            block_time: 1700000000
        },
        vout: [{ scriptpubkey_address: to, value: sats }]
    };
}
function etherscanRoute(action, payload) {
    return {
        method: "get",
        match: (url, config) => url.replace(/\/+$/, "") === ETHERSCAN_BASE && String(config?.params?.action) === action,
        respond: () => payload
    };
}
function proxyResult(result) {
    return { jsonrpc: "2.0", id: 1, result };
}
function accountResult(result) {
    return { status: "1", message: "OK", result };
}
function tronRoute(tx) {
    return {
        method: "get",
        match: (url) => url.startsWith(`${TRON_BASE}/transaction-info`),
        respond: () => tx
    };
}
function solRoutes(handlers) {
    return [
        {
            method: "post",
            match: (_url, config) => config?.data?.method === "getTransaction",
            respond: (_url, config) => ({
                jsonrpc: "2.0",
                id: 1,
                result: handlers.getTransaction ? handlers.getTransaction(config?.data?.params) : null
            })
        },
        {
            method: "post",
            match: (_url, config) => config?.data?.method === "getSignatureStatuses",
            respond: (_url, config) => ({
                jsonrpc: "2.0",
                id: 1,
                result: handlers.getSignatureStatuses ? handlers.getSignatureStatuses(config?.data?.params) : null
            })
        }
    ];
}
const BTC_HASH = "b".repeat(64);
const ETH_HASH = `0x${"a".repeat(64)}`;
const ERC20_HASH = `0x${"c".repeat(64)}`;
const TRC20_HASH = "d".repeat(64);
/**
 * Base58 of 64 bytes, i.e. the shape of a real Solana signature. Random-looking
 * text of the same length is not enough: the decoded byte length is what the
 * RPC accepts, and what `normalizeTransactionHash` now enforces.
 */
const SOL_HASH = "d814XjoBuviF7Knd8Cjz5sGU3pW4oJNPa5DLwJdaqZMTm5MMnq6MytPwH7yv1U89wXQZUUTHTuRpDvmTYLiY9Cs";
const SOL_HASH_ALT = "2FD9cqYHAsFiVe1Y91Rj58T47Ba16gS74BYtTqSMBf3Nc9hnfmSaNiAnB6wpqofyd6jcckwGjeQTjYZzADzEFfVg";
// ---------------------------------------------------------------------------
// Bitcoin — Blockstream
// ---------------------------------------------------------------------------
(0, node_test_1.test)("BTC: verifies a mined transfer using the tip height, not status.confirmations", async () => {
    routes = btcRoutes(btcTx(BTC_ADDR, 50000000, 3), BTC_TIP);
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
    assert_1.default.equal(result.stage, "verified");
    assert_1.default.equal(result.success, true);
    assert_1.default.equal(result.amount, 0.5);
    assert_1.default.equal(result.confirmations, 3);
    assert_1.default.equal(result.toAddress, BTC_ADDR);
});
(0, node_test_1.test)("BTC: an unconfirmed transaction stays unverified", async () => {
    routes = btcRoutes({ status: { confirmed: false }, vout: [{ scriptpubkey_address: BTC_ADDR, value: 50000000 }] }, BTC_TIP);
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
    assert_1.default.equal(result.success, false);
    assert_1.default.equal(result.stage, "insufficient_confirmations");
    assert_1.default.equal(result.confirmations, 0);
});
(0, node_test_1.test)("BTC: too few confirmations is reported as insufficient, never verified", async () => {
    routes = btcRoutes(btcTx(BTC_ADDR, 50000000, 1), BTC_TIP);
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
    assert_1.default.equal(result.stage, "insufficient_confirmations");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("BTC: a nonexistent hash is not_found", async () => {
    routes = [
        {
            method: "get",
            match: (url) => url.includes("/tx/"),
            respond: () => {
                throw mockAxiosError({ status: 404 });
            }
        },
        { method: "get", match: (url) => url.endsWith("/blocks/tip/height"), respond: () => BTC_TIP }
    ];
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
    assert_1.default.equal(result.stage, "not_found");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("BTC: a transfer to a different address is a mismatch", async () => {
    routes = btcRoutes(btcTx("bc1qsomeoneelse000000000000000000000000000", 50000000, 3), BTC_TIP);
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("BTC: a wrong amount is a mismatch", async () => {
    routes = btcRoutes(btcTx(BTC_ADDR, 90000000, 3), BTC_TIP);
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /amount/i);
});
(0, node_test_1.test)("BTC: a provider outage never verifies the deposit", async () => {
    routes = [
        {
            method: "get",
            match: (url) => url.includes("/tx/"),
            respond: () => {
                throw mockAxiosError({ code: "ETIMEDOUT", message: "timeout" });
            }
        },
        { method: "get", match: (url) => url.endsWith("/blocks/tip/height"), respond: () => BTC_TIP }
    ];
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
    // A timeout is transient: the chain was never asked, so the hash stays
    // retryable instead of being reported as a provider configuration fault.
    assert_1.default.equal(result.stage, "provider_unavailable");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("BTC: a malformed provider response is not treated as a payment", async () => {
    routes = btcRoutes({ unexpected: true }, BTC_TIP);
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
    assert_1.default.equal(result.stage, "not_found");
    assert_1.default.equal(result.success, false);
});
// ---------------------------------------------------------------------------
// Ethereum — Etherscan V2
// ---------------------------------------------------------------------------
const ETH_TX_BLOCK = 19000000;
async function verifyEth(overrides) {
    routes = [
        etherscanRoute("eth_getTransactionByHash", proxyResult(overrides.tx === undefined
            ? {
                to: ETH_ADDR,
                value: `0x${BigInt("500000000000000000").toString(16)}`,
                blockNumber: `0x${ETH_TX_BLOCK.toString(16)}`
            }
            : overrides.tx)),
        etherscanRoute("eth_getTransactionReceipt", proxyResult(overrides.receipt === undefined ? { status: "0x1" } : overrides.receipt)),
        etherscanRoute("eth_blockNumber", proxyResult(`0x${(overrides.latest ?? ETH_TX_BLOCK + 5).toString(16)}`))
    ];
    return (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "ETH",
        txHash: ETH_HASH,
        expectedAmount: overrides.expected ?? 0.5
    });
}
(0, node_test_1.test)("ETH: verifies a native transfer through the V2 endpoint with the chain id", async () => {
    const result = await verifyEth({});
    assert_1.default.equal(result.stage, "verified");
    assert_1.default.equal(result.amount, 0.5);
    assert_1.default.equal(result.confirmations, 6);
    // Etherscan V2 requires an explicit chain id on every request.
    assert_1.default.ok(getCalls.length > 0);
    for (const call of getCalls) {
        assert_1.default.equal(call.url, ETHERSCAN_BASE);
        assert_1.default.equal(String(call.params.chainid), "1");
    }
});
(0, node_test_1.test)("ETH: a nonexistent hash is not_found", async () => {
    const result = await verifyEth({ tx: null });
    assert_1.default.equal(result.stage, "not_found");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("ETH: a reverted transfer is a mismatch", async () => {
    const result = await verifyEth({ receipt: { status: "0x0" } });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /failed on-chain/i);
});
(0, node_test_1.test)("ETH: a transfer to a different address is a mismatch", async () => {
    const result = await verifyEth({
        tx: {
            to: "0x000000000000000000000000000000000000dEaD",
            value: `0x${BigInt("500000000000000000").toString(16)}`,
            blockNumber: `0x${ETH_TX_BLOCK.toString(16)}`
        }
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /receiver/i);
});
(0, node_test_1.test)("ETH: a wrong amount is a mismatch", async () => {
    const result = await verifyEth({
        tx: {
            to: ETH_ADDR,
            value: `0x${BigInt("5000000000000000000").toString(16)}`,
            blockNumber: `0x${ETH_TX_BLOCK.toString(16)}`
        }
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /amount/i);
});
(0, node_test_1.test)("ETH: insufficient confirmations is reported as such", async () => {
    const result = await verifyEth({ latest: ETH_TX_BLOCK });
    assert_1.default.equal(result.stage, "insufficient_confirmations");
    assert_1.default.equal(result.confirmations, 1);
});
// ---------------------------------------------------------------------------
// USDT — ERC20 (Etherscan V2 token transfer)
// ---------------------------------------------------------------------------
const ERC20_BLOCK = 19100000;
async function verifyErc20(overrides) {
    const events = overrides.events === undefined
        ? [
            {
                contractAddress: ERC20_CONTRACT,
                to: ETH_ADDR,
                value: "50000000",
                tokenDecimal: "6",
                blockNumber: String(ERC20_BLOCK),
                hash: ERC20_HASH
            }
        ]
        : overrides.events;
    routes = [
        // The verifier resolves the transaction's block first, then scopes the
        // token lookup to that single block (Etherscan V2 ignores `txhash`).
        etherscanRoute("eth_getTransactionByHash", proxyResult({ blockNumber: `0x${ERC20_BLOCK.toString(16)}` })),
        etherscanRoute("tokentx", accountResult(events)),
        etherscanRoute("eth_getTransactionReceipt", proxyResult(overrides.receipt === undefined ? { status: "0x1" } : overrides.receipt)),
        etherscanRoute("eth_blockNumber", proxyResult(`0x${(overrides.latest ?? ERC20_BLOCK + 5).toString(16)}`))
    ];
    return (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "ERC20",
        txHash: ERC20_HASH,
        expectedAmount: overrides.expected ?? 50
    });
}
(0, node_test_1.test)("ERC20: verifies a USDT transfer using the token decimals", async () => {
    const result = await verifyErc20({});
    assert_1.default.equal(result.stage, "verified");
    assert_1.default.equal(result.amount, 50);
    assert_1.default.equal(result.confirmations, 6);
    const tokenCall = getCalls.find((call) => call.params?.action === "tokentx");
    assert_1.default.ok(tokenCall);
    assert_1.default.equal(String(tokenCall.params.contractaddress), ERC20_CONTRACT);
    assert_1.default.equal(String(tokenCall.params.address), ETH_ADDR);
    assert_1.default.equal(String(tokenCall.params.startblock), String(ERC20_BLOCK));
    assert_1.default.equal(String(tokenCall.params.endblock), String(ERC20_BLOCK));
});
(0, node_test_1.test)("ERC20: no matching transfer is not_found", async () => {
    const result = await verifyErc20({ events: [] });
    assert_1.default.equal(result.stage, "not_found");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("ERC20: a transfer of a different token contract is a mismatch", async () => {
    const result = await verifyErc20({
        events: [
            {
                contractAddress: "0x1111111111111111111111111111111111111111",
                to: ETH_ADDR,
                value: "50000000",
                tokenDecimal: "6",
                blockNumber: String(ERC20_BLOCK),
                hash: ERC20_HASH
            }
        ]
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /supported USDT/i);
});
(0, node_test_1.test)("ERC20: a transfer to a different address is a mismatch", async () => {
    const result = await verifyErc20({
        events: [
            {
                contractAddress: ERC20_CONTRACT,
                to: "0x000000000000000000000000000000000000dEaD",
                value: "50000000",
                tokenDecimal: "6",
                blockNumber: String(ERC20_BLOCK),
                hash: ERC20_HASH
            }
        ]
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("ERC20: a wrong token amount is a mismatch", async () => {
    const result = await verifyErc20({
        events: [
            {
                contractAddress: ERC20_CONTRACT,
                to: ETH_ADDR,
                value: "10000000",
                tokenDecimal: "6",
                blockNumber: String(ERC20_BLOCK),
                hash: ERC20_HASH
            }
        ]
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /amount/i);
});
(0, node_test_1.test)("ERC20: a reverted token transfer is a mismatch", async () => {
    const result = await verifyErc20({ receipt: { status: "0x0" } });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /failed on-chain/i);
});
(0, node_test_1.test)("ERC20: insufficient confirmations is reported as such", async () => {
    const result = await verifyErc20({ latest: ERC20_BLOCK });
    assert_1.default.equal(result.stage, "insufficient_confirmations");
    assert_1.default.equal(result.confirmations, 1);
});
(0, node_test_1.test)("ERC20: an Etherscan NOTOK envelope is retryable, never a false not_found", async () => {
    // A rate limit reached during a token lookup used to be flattened into an
    // empty transfer list, so a real deposit was reported as `not_found`.
    routes = [
        etherscanRoute("eth_getTransactionByHash", proxyResult({ blockNumber: `0x${ERC20_BLOCK.toString(16)}` })),
        etherscanRoute("tokentx", {
            status: "0",
            message: "NOTOK",
            result: "Max rate limit reached, please use API Key for higher rate limit"
        })
    ];
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "ERC20",
        txHash: ERC20_HASH,
        expectedAmount: 50
    });
    // Rate limiting is transient, so the deposit stays pending and retryable.
    assert_1.default.equal(result.stage, "provider_unavailable");
    assert_1.default.equal(result.success, false);
    // The provider detail is logged server-side but never echoed to the user.
    assert_1.default.doesNotMatch(result.failureReason || "", /rate limit/i);
});
(0, node_test_1.test)("ERC20: an Etherscan JSON-RPC rate-limit envelope is retryable", async () => {
    routes = [
        etherscanRoute("eth_getTransactionByHash", {
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32005, message: "rate limit exceeded" }
        })
    ];
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "ERC20",
        txHash: ERC20_HASH,
        expectedAmount: 50
    });
    assert_1.default.equal(result.stage, "provider_unavailable");
});
(0, node_test_1.test)("ERC20: an Etherscan authentication failure is a configuration error", async () => {
    // A rejected API key will not recover on retry, so it is reported as a
    // configuration fault (provider_error) rather than as temporarily unavailable.
    routes = [
        etherscanRoute("eth_getTransactionByHash", {
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32000, message: "Invalid API Key" }
        })
    ];
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "ERC20",
        txHash: ERC20_HASH,
        expectedAmount: 50
    });
    assert_1.default.equal(result.stage, "provider_error");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("ERC20: Etherscan's empty-result envelope still resolves to not_found", async () => {
    // `status: "0"` with "No transactions found" is a legitimate empty result and
    // must not be mistaken for a provider fault.
    routes = [
        etherscanRoute("eth_getTransactionByHash", proxyResult({ blockNumber: `0x${ERC20_BLOCK.toString(16)}` })),
        etherscanRoute("tokentx", { status: "0", message: "No transactions found", result: [] })
    ];
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "ERC20",
        txHash: ERC20_HASH,
        expectedAmount: 50
    });
    assert_1.default.equal(result.stage, "not_found");
});
// ---------------------------------------------------------------------------
// USDT — TRC20 (Tronscan contractData decoding)
// ---------------------------------------------------------------------------
const TRC20_RECIPIENT_HEX = "41bcf599af92b80528aaeee693fba3dd9cfbe289b4";
function trc20Data(recipientHex, amountRaw) {
    return ("a9059cbb" +
        recipientHex.padStart(64, "0") +
        amountRaw.toString(16).padStart(64, "0"));
}
async function verifyTrc20(overrides) {
    const tx = overrides.rawResponse !== undefined
        ? overrides.rawResponse
        : {
            contractRet: overrides.contractRet ?? "SUCCESS",
            confirmations: overrides.confirmations ?? 20,
            contractData: {
                owner_address: "41cE3AFeE928f519e7057cf3f487D44286f7c324f8",
                contract_address: overrides.contract ?? TRC20_CONTRACT,
                data: overrides.data ?? trc20Data(TRC20_RECIPIENT_HEX, 11000000n)
            }
        };
    routes = [tronRoute(tx)];
    return (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "TRC20",
        txHash: TRC20_HASH,
        expectedAmount: overrides.expected ?? 11
    });
}
(0, node_test_1.test)("TRC20: decodes recipient and amount from contractData.data", async () => {
    const result = await verifyTrc20({});
    assert_1.default.equal(result.stage, "verified");
    assert_1.default.equal(result.amount, 11);
    assert_1.default.equal(result.toAddress, TRC20_ADDR);
    assert_1.default.equal(result.confirmations, 20);
});
(0, node_test_1.test)("TRC20: a nonexistent hash is not_found", async () => {
    const result = await verifyTrc20({ rawResponse: {} });
    assert_1.default.equal(result.stage, "not_found");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("TRC20: a non-TRC20 contract call is a mismatch", async () => {
    const result = await verifyTrc20({ data: `095ea7b3${"0".repeat(128)}` });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /not a TRC20/i);
});
(0, node_test_1.test)("TRC20: a transfer of a different token contract is a mismatch", async () => {
    const result = await verifyTrc20({ contract: "TXFBqBbqJommqZf7BV8NNYzePh97UmJodJ" });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /supported USDT/i);
});
(0, node_test_1.test)("TRC20: a transfer to a different recipient is a mismatch", async () => {
    const result = await verifyTrc20({
        data: trc20Data(`41${"22".repeat(20)}`, 11000000n)
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /receiver address/i);
});
(0, node_test_1.test)("TRC20: a wrong USDt amount is a mismatch", async () => {
    const result = await verifyTrc20({ data: trc20Data(TRC20_RECIPIENT_HEX, 1000000n) });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /amount/i);
});
(0, node_test_1.test)("TRC20: a reverted transfer is a mismatch", async () => {
    const result = await verifyTrc20({ contractRet: "REVERT" });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /failed on-chain/i);
});
(0, node_test_1.test)("TRC20: insufficient confirmations is reported as such", async () => {
    const result = await verifyTrc20({ confirmations: 5 });
    assert_1.default.equal(result.stage, "insufficient_confirmations");
    assert_1.default.equal(result.success, false);
});
// ---------------------------------------------------------------------------
// Solana — JSON-RPC
// ---------------------------------------------------------------------------
const SOL_LAMPORTS = 1000000000;
function solTransaction(options) {
    return {
        transaction: {
            message: {
                accountKeys: options.accounts.map((pubkey) => ({ pubkey, signer: false, writable: true }))
            }
        },
        meta: {
            err: options.err ?? null,
            preBalances: options.preBalances,
            postBalances: options.postBalances
        }
    };
}
async function verifySol(overrides) {
    if (overrides.rpcError) {
        routes = [
            {
                method: "post",
                match: (_url, config) => config?.data?.method === "getTransaction",
                respond: () => {
                    throw mockAxiosError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" });
                }
            }
        ];
    }
    else {
        routes = solRoutes({
            getTransaction: () => overrides.transaction === undefined
                ? solTransaction({
                    accounts: ["11111111111111111111111111111111", SOL_ADDR],
                    preBalances: [0, 1 * SOL_LAMPORTS],
                    postBalances: [0, 1.5 * SOL_LAMPORTS]
                })
                : overrides.transaction,
            getSignatureStatuses: () => ({
                value: [
                    {
                        confirmations: overrides.confirmations === undefined ? 12 : overrides.confirmations,
                        confirmationStatus: overrides.confirmationStatus ?? "confirmed"
                    }
                ]
            })
        });
    }
    return (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "SOL",
        txHash: SOL_HASH,
        expectedAmount: overrides.expected ?? 0.5
    });
}
(0, node_test_1.test)("SOL: verifies a native transfer to the platform account", async () => {
    const result = await verifySol({});
    assert_1.default.equal(result.stage, "verified");
    assert_1.default.equal(result.amount, 0.5);
    assert_1.default.equal(result.toAddress, SOL_ADDR);
    assert_1.default.equal(result.confirmations, 12);
    assert_1.default.equal(postCalls[0]?.url, SOL_RPC);
});
(0, node_test_1.test)("SOL: a nonexistent hash is not_found", async () => {
    const result = await verifySol({ transaction: null });
    assert_1.default.equal(result.stage, "not_found");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("SOL: a failed transaction is a mismatch", async () => {
    const result = await verifySol({
        transaction: solTransaction({
            accounts: ["11111111111111111111111111111111", SOL_ADDR],
            preBalances: [0, 1 * SOL_LAMPORTS],
            postBalances: [0, 1.5 * SOL_LAMPORTS],
            err: { InstructionError: [0, "Custom"] }
        })
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /failed on-chain/i);
});
(0, node_test_1.test)("SOL: a transaction not involving the platform account is a mismatch", async () => {
    const result = await verifySol({
        transaction: solTransaction({
            accounts: ["11111111111111111111111111111111", "So11111111111111111111111111111111111111112"],
            preBalances: [0, 1 * SOL_LAMPORTS],
            postBalances: [0, 1.5 * SOL_LAMPORTS]
        })
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /receiving address/i);
});
(0, node_test_1.test)("SOL: a wrong amount is a mismatch", async () => {
    const result = await verifySol({
        transaction: solTransaction({
            accounts: ["11111111111111111111111111111111", SOL_ADDR],
            preBalances: [0, 1 * SOL_LAMPORTS],
            postBalances: [0, 1.1 * SOL_LAMPORTS]
        })
    });
    assert_1.default.equal(result.stage, "mismatch");
    assert_1.default.match(result.failureReason || "", /amount/i);
});
(0, node_test_1.test)("SOL: insufficient confirmations is reported as such", async () => {
    const result = await verifySol({ confirmations: 3 });
    assert_1.default.equal(result.stage, "insufficient_confirmations");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("SOL: a finalized transaction counts as fully confirmed", async () => {
    const result = await verifySol({ confirmations: null, confirmationStatus: "finalized" });
    assert_1.default.equal(result.stage, "verified");
    assert_1.default.equal(result.confirmations, 10);
});
(0, node_test_1.test)("SOL: an unavailable RPC is never a valid transaction", async () => {
    const result = await verifySol({ rpcError: true });
    // A refused connection is transient, so the hash stays retryable.
    assert_1.default.equal(result.stage, "provider_unavailable");
    assert_1.default.equal(result.success, false);
});
(0, node_test_1.test)("SOL: a newer transaction version is retried, not reported as a provider fault", async () => {
    // Mainnet carries versioned transactions beyond v0. The node rejects a
    // getTransaction that does not acknowledge the version, so the helper widens
    // the version it asks for and the transfer verifies normally.
    let getTransactionAttempts = 0;
    routes = [
        {
            method: "post",
            match: (_url, config) => config?.data?.method === "getTransaction",
            respond: (_url, config) => {
                getTransactionAttempts += 1;
                const requested = config?.data?.params?.[1]?.maxSupportedTransactionVersion;
                if (requested === 0) {
                    return {
                        jsonrpc: "2.0",
                        id: 1,
                        error: {
                            code: -32015,
                            message: 'Transaction version (1) is not supported by the requesting client. Please try the request again with the following configuration parameter: "maxSupportedTransactionVersion": 1'
                        }
                    };
                }
                return {
                    jsonrpc: "2.0",
                    id: 1,
                    result: solTransaction({
                        accounts: ["11111111111111111111111111111111", SOL_ADDR],
                        preBalances: [0, 1 * SOL_LAMPORTS],
                        postBalances: [0, 1.5 * SOL_LAMPORTS]
                    })
                };
            }
        },
        {
            method: "post",
            match: (_url, config) => config?.data?.method === "getSignatureStatuses",
            respond: () => ({
                jsonrpc: "2.0",
                id: 1,
                result: { value: [{ confirmations: 12, confirmationStatus: "confirmed" }] }
            })
        }
    ];
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "SOL",
        txHash: SOL_HASH,
        expectedAmount: 0.5
    });
    assert_1.default.equal(result.stage, "verified");
    assert_1.default.equal(getTransactionAttempts, 2);
});
// ---------------------------------------------------------------------------
// Transaction hash normalisation
// ---------------------------------------------------------------------------
(0, node_test_1.test)("normalizeTransactionHash canonicalises every supported network", () => {
    // Bitcoin and Tron txids are bare lowercase hex.
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("BTC", BTC_HASH.toUpperCase()), BTC_HASH);
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("TRC20", TRC20_HASH.toUpperCase()), TRC20_HASH);
    // Ethereum hashes always carry the 0x prefix and are lowercased.
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("ETH", ETH_HASH.slice(2)), ETH_HASH);
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("ERC20", ETH_HASH.toUpperCase()), ETH_HASH);
    // A Solana signature is base58 of exactly 64 bytes and is passed through verbatim.
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("SOL", SOL_HASH), SOL_HASH);
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("SOL", SOL_HASH_ALT), SOL_HASH_ALT);
    // Anything that cannot belong to the network is rejected.
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("BTC", "not-a-hash"), null);
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("ETH", "0x1234"), null);
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("SOL", "has spaces"), null);
    // Base58 that does not decode to a 64-byte signature is a caller mistake, not
    // a provider fault: the RPC would answer "Invalid param: WrongSize" and the
    // submission would be misreported as an unreachable provider.
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("SOL", "5".repeat(64)), null);
    assert_1.default.equal((0, blockchainVerificationService_1.normalizeTransactionHash)("SOL", "1".repeat(88)), null);
});
(0, node_test_1.test)("a malformed transaction hash is invalid_hash, never a provider fault", async () => {
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "BTC",
        txHash: "definitely-not-a-transaction-hash",
        expectedAmount: 0.5
    });
    assert_1.default.equal(result.stage, "invalid_hash");
    assert_1.default.equal(result.success, false);
    assert_1.default.match(result.failureReason || "", /bitcoin/i);
});
(0, node_test_1.test)("an uppercase Bitcoin txid is accepted and looked up in canonical form", async () => {
    routes = btcRoutes(btcTx(BTC_ADDR, 50000000, 3), BTC_TIP);
    const result = await (0, blockchainVerificationService_1.verifyDepositOnChain)({
        cryptoType: "BTC",
        txHash: BTC_HASH.toUpperCase(),
        expectedAmount: 0.5
    });
    assert_1.default.equal(result.stage, "verified");
    assert_1.default.equal(result.txHash, BTC_HASH);
});
// ---------------------------------------------------------------------------
// Provider error reporting
// ---------------------------------------------------------------------------
(0, node_test_1.test)("describeProviderError surfaces codes, HTTP status and provider messages", () => {
    const axiosError = mockAxiosError({
        code: "ETIMEDOUT",
        status: 503,
        data: { message: "Service temporarily unavailable" }
    });
    const text = (0, blockchainVerificationService_1.describeProviderError)(axiosError);
    assert_1.default.match(text, /ETIMEDOUT/);
    assert_1.default.match(text, /HTTP 503/);
    assert_1.default.match(text, /Service temporarily unavailable/);
});
(0, node_test_1.test)("describeProviderError reads the inner errors of an AggregateError", () => {
    const aggregate = Object.assign(new Error(""), {
        name: "AggregateError",
        errors: [{ code: "EAI_AGAIN", syscall: "getaddrinfo", message: "DNS lookup failed" }]
    });
    const text = (0, blockchainVerificationService_1.describeProviderError)(aggregate);
    assert_1.default.match(text, /EAI_AGAIN/);
    assert_1.default.match(text, /DNS lookup failed/);
});
(0, node_test_1.test)("describeProviderError never leaks API keys or URL query credentials", () => {
    const previous = process.env.ETHERSCAN_API_KEY;
    process.env.ETHERSCAN_API_KEY = "SUPER-SECRET-KEY-42";
    try {
        const text = (0, blockchainVerificationService_1.describeProviderError)(new Error("request failed SUPER-SECRET-KEY-42 at https://api.etherscan.io/v2/api?apikey=SUPER-SECRET-KEY-42&module=account"));
        assert_1.default.ok(!text.includes("SUPER-SECRET-KEY-42"));
        assert_1.default.ok(text.includes("https://api.etherscan.io/v2/api"));
        assert_1.default.ok(!text.includes("module=account"));
    }
    finally {
        process.env.ETHERSCAN_API_KEY = previous;
    }
});
