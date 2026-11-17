import assert from "assert";
import { after, before, beforeEach, test } from "node:test";
import axios from "axios";

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

import {
  describeProviderError,
  normalizeTransactionHash,
  verifyDepositOnChain
} from "./blockchainVerificationService";
import { resetPlatformWalletCache } from "./walletService";

const BTC_ADDR = process.env.BTC_DEPOSIT_ADDRESS!;
const ETH_ADDR = process.env.ETH_DEPOSIT_ADDRESS!;
const SOL_ADDR = process.env.SOL_DEPOSIT_ADDRESS!;
const TRC20_ADDR = process.env.USDT_TRC20_DEPOSIT_ADDRESS!;
const ERC20_CONTRACT = process.env.USDT_ERC20_CONTRACT_ADDRESS!;
const TRC20_CONTRACT = process.env.USDT_TRC20_CONTRACT_ADDRESS!;
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";
const TRON_BASE = "https://apilist.tronscanapi.com/api";
const SOL_RPC = "https://api.mainnet-beta.solana.com";

const BTC_TIP = 800_000;

interface MockRoute {
  method: "get" | "post";
  match: (url: string, config?: any) => boolean;
  respond: (url: string, config?: any) => unknown;
}

let routes: MockRoute[] = [];
const getCalls: Array<{ url: string; params: any }> = [];
const postCalls: Array<{ url: string; body: any }> = [];

function mockAxiosError(overrides: {
  code?: string;
  status?: number;
  data?: unknown;
  message?: string;
}) {
  const error = new Error(overrides.message || "simulated provider failure") as Error & {
    isAxiosError: boolean;
    code?: string;
    response?: { status: number; data: unknown };
  };
  error.isAxiosError = true;
  if (overrides.code) {
    error.code = overrides.code;
  }
  if (overrides.status) {
    error.response = { status: overrides.status, data: overrides.data };
  }
  return error;
}

const originalGet = axios.get;
const originalPost = axios.post;

before(() => {
  (axios as any).get = async (url: string, config?: any) => {
    getCalls.push({ url, params: config?.params });
    const route = routes.find((candidate) => candidate.method === "get" && candidate.match(url, config));
    if (!route) {
      throw mockAxiosError({ code: "ENOTFOUND", message: `no mock route for GET ${url}` });
    }
    return { data: route.respond(url, config) };
  };
  (axios as any).post = async (url: string, body: any) => {
    postCalls.push({ url, body });
    const context = { data: body };
    const route = routes.find((candidate) => candidate.method === "post" && candidate.match(url, context));
    if (!route) {
      throw mockAxiosError({ code: "ENOTFOUND", message: `no mock route for POST ${url}` });
    }
    return { data: route.respond(url, context) };
  };
});

after(() => {
  (axios as any).get = originalGet;
  (axios as any).post = originalPost;
});

beforeEach(() => {
  routes = [];
  getCalls.length = 0;
  postCalls.length = 0;
  resetPlatformWalletCache();
});

// ---------------------------------------------------------------------------
// Route builders
// ---------------------------------------------------------------------------

function btcRoutes(tx: unknown, tip: number): MockRoute[] {
  return [
    { method: "get", match: (url) => url.includes("/tx/"), respond: () => tx },
    { method: "get", match: (url) => url.endsWith("/blocks/tip/height"), respond: () => tip }
  ];
}

function btcTx(to: string, sats: number, confirmations: number) {
  return {
    status: {
      confirmed: true,
      block_height: BTC_TIP - confirmations + 1,
      block_hash: "0000000000000000000",
      block_time: 1_700_000_000
    },
    vout: [{ scriptpubkey_address: to, value: sats }]
  };
}

function etherscanRoute(action: string, payload: unknown): MockRoute {
  return {
    method: "get",
    match: (url, config) =>
      url.replace(/\/+$/, "") === ETHERSCAN_BASE && String(config?.params?.action) === action,
    respond: () => payload
  };
}

function proxyResult(result: unknown) {
  return { jsonrpc: "2.0", id: 1, result };
}

function accountResult(result: unknown) {
  return { status: "1", message: "OK", result };
}

function tronRoute(tx: unknown): MockRoute {
  return {
    method: "get",
    match: (url) => url.startsWith(`${TRON_BASE}/transaction-info`),
    respond: () => tx
  };
}

function solRoutes(handlers: {
  getTransaction?: (params: any) => unknown;
  getSignatureStatuses?: (params: any) => unknown;
}): MockRoute[] {
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

test("BTC: verifies a mined transfer using the tip height, not status.confirmations", async () => {
  routes = btcRoutes(btcTx(BTC_ADDR, 50_000_000, 3), BTC_TIP);
  const result = await verifyDepositOnChain({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
  assert.equal(result.stage, "verified");
  assert.equal(result.success, true);
  assert.equal(result.amount, 0.5);
  assert.equal(result.confirmations, 3);
  assert.equal(result.toAddress, BTC_ADDR);
});

test("BTC: an unconfirmed transaction stays unverified", async () => {
  routes = btcRoutes(
    { status: { confirmed: false }, vout: [{ scriptpubkey_address: BTC_ADDR, value: 50_000_000 }] },
    BTC_TIP
  );
  const result = await verifyDepositOnChain({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
  assert.equal(result.success, false);
  assert.equal(result.stage, "insufficient_confirmations");
  assert.equal(result.confirmations, 0);
});

test("BTC: too few confirmations is reported as insufficient, never verified", async () => {
  routes = btcRoutes(btcTx(BTC_ADDR, 50_000_000, 1), BTC_TIP);
  const result = await verifyDepositOnChain({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
  assert.equal(result.stage, "insufficient_confirmations");
  assert.equal(result.success, false);
});

test("BTC: a nonexistent hash is not_found", async () => {
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
  const result = await verifyDepositOnChain({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
  assert.equal(result.stage, "not_found");
  assert.equal(result.success, false);
});

test("BTC: a transfer to a different address is a mismatch", async () => {
  routes = btcRoutes(btcTx("bc1qsomeoneelse000000000000000000000000000", 50_000_000, 3), BTC_TIP);
  const result = await verifyDepositOnChain({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
  assert.equal(result.stage, "mismatch");
  assert.equal(result.success, false);
});

test("BTC: a wrong amount is a mismatch", async () => {
  routes = btcRoutes(btcTx(BTC_ADDR, 90_000_000, 3), BTC_TIP);
  const result = await verifyDepositOnChain({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /amount/i);
});

test("BTC: a provider outage never verifies the deposit", async () => {
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
  const result = await verifyDepositOnChain({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
  // A timeout is transient: the chain was never asked, so the hash stays
  // retryable instead of being reported as a provider configuration fault.
  assert.equal(result.stage, "provider_unavailable");
  assert.equal(result.success, false);
});

test("BTC: a malformed provider response is not treated as a payment", async () => {
  routes = btcRoutes({ unexpected: true }, BTC_TIP);
  const result = await verifyDepositOnChain({ cryptoType: "BTC", txHash: BTC_HASH, expectedAmount: 0.5 });
  assert.equal(result.stage, "not_found");
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Ethereum — Etherscan V2
// ---------------------------------------------------------------------------

const ETH_TX_BLOCK = 19_000_000;

async function verifyEth(overrides: {
  tx?: unknown;
  receipt?: unknown;
  latest?: number;
  expected?: number;
}) {
  routes = [
    etherscanRoute(
      "eth_getTransactionByHash",
      proxyResult(
        overrides.tx === undefined
          ? {
              to: ETH_ADDR,
              value: `0x${BigInt("500000000000000000").toString(16)}`,
              blockNumber: `0x${ETH_TX_BLOCK.toString(16)}`
            }
          : overrides.tx
      )
    ),
    etherscanRoute(
      "eth_getTransactionReceipt",
      proxyResult(overrides.receipt === undefined ? { status: "0x1" } : overrides.receipt)
    ),
    etherscanRoute(
      "eth_blockNumber",
      proxyResult(`0x${((overrides.latest ?? ETH_TX_BLOCK + 5) as number).toString(16)}`)
    )
  ];
  return verifyDepositOnChain({
    cryptoType: "ETH",
    txHash: ETH_HASH,
    expectedAmount: overrides.expected ?? 0.5
  });
}

test("ETH: verifies a native transfer through the V2 endpoint with the chain id", async () => {
  const result = await verifyEth({});
  assert.equal(result.stage, "verified");
  assert.equal(result.amount, 0.5);
  assert.equal(result.confirmations, 6);
  // Etherscan V2 requires an explicit chain id on every request.
  assert.ok(getCalls.length > 0);
  for (const call of getCalls) {
    assert.equal(call.url, ETHERSCAN_BASE);
    assert.equal(String(call.params.chainid), "1");
  }
});

test("ETH: a nonexistent hash is not_found", async () => {
  const result = await verifyEth({ tx: null });
  assert.equal(result.stage, "not_found");
  assert.equal(result.success, false);
});

test("ETH: a reverted transfer is a mismatch", async () => {
  const result = await verifyEth({ receipt: { status: "0x0" } });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /failed on-chain/i);
});

test("ETH: a transfer to a different address is a mismatch", async () => {
  const result = await verifyEth({
    tx: {
      to: "0x000000000000000000000000000000000000dEaD",
      value: `0x${BigInt("500000000000000000").toString(16)}`,
      blockNumber: `0x${ETH_TX_BLOCK.toString(16)}`
    }
  });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /receiver/i);
});

test("ETH: a wrong amount is a mismatch", async () => {
  const result = await verifyEth({
    tx: {
      to: ETH_ADDR,
      value: `0x${BigInt("5000000000000000000").toString(16)}`,
      blockNumber: `0x${ETH_TX_BLOCK.toString(16)}`
    }
  });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /amount/i);
});

test("ETH: insufficient confirmations is reported as such", async () => {
  const result = await verifyEth({ latest: ETH_TX_BLOCK });
  assert.equal(result.stage, "insufficient_confirmations");
  assert.equal(result.confirmations, 1);
});

// ---------------------------------------------------------------------------
// USDT — ERC20 (Etherscan V2 token transfer)
// ---------------------------------------------------------------------------

const ERC20_BLOCK = 19_100_000;

async function verifyErc20(overrides: {
  events?: Array<Record<string, unknown>>;
  receipt?: unknown;
  latest?: number;
  expected?: number;
}) {
  const events =
    overrides.events === undefined
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
    etherscanRoute(
      "eth_getTransactionByHash",
      proxyResult({ blockNumber: `0x${ERC20_BLOCK.toString(16)}` })
    ),
    etherscanRoute("tokentx", accountResult(events)),
    etherscanRoute(
      "eth_getTransactionReceipt",
      proxyResult(overrides.receipt === undefined ? { status: "0x1" } : overrides.receipt)
    ),
    etherscanRoute(
      "eth_blockNumber",
      proxyResult(`0x${((overrides.latest ?? ERC20_BLOCK + 5) as number).toString(16)}`)
    )
  ];
  return verifyDepositOnChain({
    cryptoType: "ERC20",
    txHash: ERC20_HASH,
    expectedAmount: overrides.expected ?? 50
  });
}

test("ERC20: verifies a USDT transfer using the token decimals", async () => {
  const result = await verifyErc20({});
  assert.equal(result.stage, "verified");
  assert.equal(result.amount, 50);
  assert.equal(result.confirmations, 6);
  const tokenCall = getCalls.find((call) => call.params?.action === "tokentx");
  assert.ok(tokenCall);
  assert.equal(String(tokenCall!.params.contractaddress), ERC20_CONTRACT);
  assert.equal(String(tokenCall!.params.address), ETH_ADDR);
  assert.equal(String(tokenCall!.params.startblock), String(ERC20_BLOCK));
  assert.equal(String(tokenCall!.params.endblock), String(ERC20_BLOCK));
});

test("ERC20: no matching transfer is not_found", async () => {
  const result = await verifyErc20({ events: [] });
  assert.equal(result.stage, "not_found");
  assert.equal(result.success, false);
});

test("ERC20: a transfer of a different token contract is a mismatch", async () => {
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
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /supported USDT/i);
});

test("ERC20: a transfer to a different address is a mismatch", async () => {
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
  assert.equal(result.stage, "mismatch");
  assert.equal(result.success, false);
});

test("ERC20: a wrong token amount is a mismatch", async () => {
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
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /amount/i);
});

test("ERC20: a reverted token transfer is a mismatch", async () => {
  const result = await verifyErc20({ receipt: { status: "0x0" } });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /failed on-chain/i);
});

test("ERC20: insufficient confirmations is reported as such", async () => {
  const result = await verifyErc20({ latest: ERC20_BLOCK });
  assert.equal(result.stage, "insufficient_confirmations");
  assert.equal(result.confirmations, 1);
});

test("ERC20: an Etherscan NOTOK envelope is retryable, never a false not_found", async () => {
  // A rate limit reached during a token lookup used to be flattened into an
  // empty transfer list, so a real deposit was reported as `not_found`.
  routes = [
    etherscanRoute(
      "eth_getTransactionByHash",
      proxyResult({ blockNumber: `0x${ERC20_BLOCK.toString(16)}` })
    ),
    etherscanRoute("tokentx", {
      status: "0",
      message: "NOTOK",
      result: "Max rate limit reached, please use API Key for higher rate limit"
    })
  ];
  const result = await verifyDepositOnChain({
    cryptoType: "ERC20",
    txHash: ERC20_HASH,
    expectedAmount: 50
  });
  // Rate limiting is transient, so the deposit stays pending and retryable.
  assert.equal(result.stage, "provider_unavailable");
  assert.equal(result.success, false);
  // The provider detail is logged server-side but never echoed to the user.
  assert.doesNotMatch(result.failureReason || "", /rate limit/i);
});

test("ERC20: an Etherscan JSON-RPC rate-limit envelope is retryable", async () => {
  routes = [
    etherscanRoute("eth_getTransactionByHash", {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32005, message: "rate limit exceeded" }
    })
  ];
  const result = await verifyDepositOnChain({
    cryptoType: "ERC20",
    txHash: ERC20_HASH,
    expectedAmount: 50
  });
  assert.equal(result.stage, "provider_unavailable");
});

test("ERC20: an Etherscan authentication failure is a configuration error", async () => {
  // A rejected API key will not recover on retry, so it is reported as a
  // configuration fault (provider_error) rather than as temporarily unavailable.
  routes = [
    etherscanRoute("eth_getTransactionByHash", {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32000, message: "Invalid API Key" }
    })
  ];
  const result = await verifyDepositOnChain({
    cryptoType: "ERC20",
    txHash: ERC20_HASH,
    expectedAmount: 50
  });
  assert.equal(result.stage, "provider_error");
  assert.equal(result.success, false);
});

test("ERC20: Etherscan's empty-result envelope still resolves to not_found", async () => {
  // `status: "0"` with "No transactions found" is a legitimate empty result and
  // must not be mistaken for a provider fault.
  routes = [
    etherscanRoute(
      "eth_getTransactionByHash",
      proxyResult({ blockNumber: `0x${ERC20_BLOCK.toString(16)}` })
    ),
    etherscanRoute("tokentx", { status: "0", message: "No transactions found", result: [] })
  ];
  const result = await verifyDepositOnChain({
    cryptoType: "ERC20",
    txHash: ERC20_HASH,
    expectedAmount: 50
  });
  assert.equal(result.stage, "not_found");
});

// ---------------------------------------------------------------------------
// USDT — TRC20 (Tronscan contractData decoding)
// ---------------------------------------------------------------------------

const TRC20_RECIPIENT_HEX = "41bcf599af92b80528aaeee693fba3dd9cfbe289b4";

function trc20Data(recipientHex: string, amountRaw: bigint): string {
  return (
    "a9059cbb" +
    recipientHex.padStart(64, "0") +
    amountRaw.toString(16).padStart(64, "0")
  );
}

async function verifyTrc20(overrides: {
  data?: string;
  contract?: string;
  contractRet?: string;
  confirmations?: number;
  expected?: number;
  rawResponse?: unknown;
}) {
  const tx =
    overrides.rawResponse !== undefined
      ? overrides.rawResponse
      : {
          contractRet: overrides.contractRet ?? "SUCCESS",
          confirmations: overrides.confirmations ?? 20,
          contractData: {
            owner_address: "41cE3AFeE928f519e7057cf3f487D44286f7c324f8",
            contract_address: overrides.contract ?? TRC20_CONTRACT,
            data: overrides.data ?? trc20Data(TRC20_RECIPIENT_HEX, 11_000_000n)
          }
        };
  routes = [tronRoute(tx)];
  return verifyDepositOnChain({
    cryptoType: "TRC20",
    txHash: TRC20_HASH,
    expectedAmount: overrides.expected ?? 11
  });
}

test("TRC20: decodes recipient and amount from contractData.data", async () => {
  const result = await verifyTrc20({});
  assert.equal(result.stage, "verified");
  assert.equal(result.amount, 11);
  assert.equal(result.toAddress, TRC20_ADDR);
  assert.equal(result.confirmations, 20);
});

test("TRC20: a nonexistent hash is not_found", async () => {
  const result = await verifyTrc20({ rawResponse: {} });
  assert.equal(result.stage, "not_found");
  assert.equal(result.success, false);
});

test("TRC20: a non-TRC20 contract call is a mismatch", async () => {
  const result = await verifyTrc20({ data: `095ea7b3${"0".repeat(128)}` });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /not a TRC20/i);
});

test("TRC20: a transfer of a different token contract is a mismatch", async () => {
  const result = await verifyTrc20({ contract: "TXFBqBbqJommqZf7BV8NNYzePh97UmJodJ" });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /supported USDT/i);
});

test("TRC20: a transfer to a different recipient is a mismatch", async () => {
  const result = await verifyTrc20({
    data: trc20Data(`41${"22".repeat(20)}`, 11_000_000n)
  });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /receiver address/i);
});

test("TRC20: a wrong USDt amount is a mismatch", async () => {
  const result = await verifyTrc20({ data: trc20Data(TRC20_RECIPIENT_HEX, 1_000_000n) });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /amount/i);
});

test("TRC20: a reverted transfer is a mismatch", async () => {
  const result = await verifyTrc20({ contractRet: "REVERT" });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /failed on-chain/i);
});

test("TRC20: insufficient confirmations is reported as such", async () => {
  const result = await verifyTrc20({ confirmations: 5 });
  assert.equal(result.stage, "insufficient_confirmations");
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Solana — JSON-RPC
// ---------------------------------------------------------------------------

const SOL_LAMPORTS = 1_000_000_000;

function solTransaction(options: {
  accounts: string[];
  preBalances: number[];
  postBalances: number[];
  err?: unknown;
}) {
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

async function verifySol(overrides: {
  transaction?: unknown;
  confirmations?: number | null;
  confirmationStatus?: string;
  rpcError?: boolean;
  expected?: number;
}) {
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
  } else {
    routes = solRoutes({
      getTransaction: () =>
        overrides.transaction === undefined
          ? solTransaction({
              accounts: ["11111111111111111111111111111111", SOL_ADDR],
              preBalances: [0, 1 * SOL_LAMPORTS],
              postBalances: [0, 1.5 * SOL_LAMPORTS]
            })
          : overrides.transaction,
      getSignatureStatuses: () => ({
        value: [
          {
            confirmations:
              overrides.confirmations === undefined ? 12 : overrides.confirmations,
            confirmationStatus: overrides.confirmationStatus ?? "confirmed"
          }
        ]
      })
    });
  }
  return verifyDepositOnChain({
    cryptoType: "SOL",
    txHash: SOL_HASH,
    expectedAmount: overrides.expected ?? 0.5
  });
}

test("SOL: verifies a native transfer to the platform account", async () => {
  const result = await verifySol({});
  assert.equal(result.stage, "verified");
  assert.equal(result.amount, 0.5);
  assert.equal(result.toAddress, SOL_ADDR);
  assert.equal(result.confirmations, 12);
  assert.equal(postCalls[0]?.url, SOL_RPC);
});

test("SOL: a nonexistent hash is not_found", async () => {
  const result = await verifySol({ transaction: null });
  assert.equal(result.stage, "not_found");
  assert.equal(result.success, false);
});

test("SOL: a failed transaction is a mismatch", async () => {
  const result = await verifySol({
    transaction: solTransaction({
      accounts: ["11111111111111111111111111111111", SOL_ADDR],
      preBalances: [0, 1 * SOL_LAMPORTS],
      postBalances: [0, 1.5 * SOL_LAMPORTS],
      err: { InstructionError: [0, "Custom"] }
    })
  });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /failed on-chain/i);
});

test("SOL: a transaction not involving the platform account is a mismatch", async () => {
  const result = await verifySol({
    transaction: solTransaction({
      accounts: ["11111111111111111111111111111111", "So11111111111111111111111111111111111111112"],
      preBalances: [0, 1 * SOL_LAMPORTS],
      postBalances: [0, 1.5 * SOL_LAMPORTS]
    })
  });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /receiving address/i);
});

test("SOL: a wrong amount is a mismatch", async () => {
  const result = await verifySol({
    transaction: solTransaction({
      accounts: ["11111111111111111111111111111111", SOL_ADDR],
      preBalances: [0, 1 * SOL_LAMPORTS],
      postBalances: [0, 1.1 * SOL_LAMPORTS]
    })
  });
  assert.equal(result.stage, "mismatch");
  assert.match(result.failureReason || "", /amount/i);
});

test("SOL: insufficient confirmations is reported as such", async () => {
  const result = await verifySol({ confirmations: 3 });
  assert.equal(result.stage, "insufficient_confirmations");
  assert.equal(result.success, false);
});

test("SOL: a finalized transaction counts as fully confirmed", async () => {
  const result = await verifySol({ confirmations: null, confirmationStatus: "finalized" });
  assert.equal(result.stage, "verified");
  assert.equal(result.confirmations, 10);
});

test("SOL: an unavailable RPC is never a valid transaction", async () => {
  const result = await verifySol({ rpcError: true });
  // A refused connection is transient, so the hash stays retryable.
  assert.equal(result.stage, "provider_unavailable");
  assert.equal(result.success, false);
});

test("SOL: a newer transaction version is retried, not reported as a provider fault", async () => {
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
              message:
                'Transaction version (1) is not supported by the requesting client. Please try the request again with the following configuration parameter: "maxSupportedTransactionVersion": 1'
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

  const result = await verifyDepositOnChain({
    cryptoType: "SOL",
    txHash: SOL_HASH,
    expectedAmount: 0.5
  });
  assert.equal(result.stage, "verified");
  assert.equal(getTransactionAttempts, 2);
});

// ---------------------------------------------------------------------------
// Transaction hash normalisation
// ---------------------------------------------------------------------------

test("normalizeTransactionHash canonicalises every supported network", () => {
  // Bitcoin and Tron txids are bare lowercase hex.
  assert.equal(normalizeTransactionHash("BTC", BTC_HASH.toUpperCase()), BTC_HASH);
  assert.equal(normalizeTransactionHash("TRC20", TRC20_HASH.toUpperCase()), TRC20_HASH);
  // Ethereum hashes always carry the 0x prefix and are lowercased.
  assert.equal(normalizeTransactionHash("ETH", ETH_HASH.slice(2)), ETH_HASH);
  assert.equal(normalizeTransactionHash("ERC20", ETH_HASH.toUpperCase()), ETH_HASH);
  // A Solana signature is base58 of exactly 64 bytes and is passed through verbatim.
  assert.equal(normalizeTransactionHash("SOL", SOL_HASH), SOL_HASH);
  assert.equal(normalizeTransactionHash("SOL", SOL_HASH_ALT), SOL_HASH_ALT);
  // Anything that cannot belong to the network is rejected.
  assert.equal(normalizeTransactionHash("BTC", "not-a-hash"), null);
  assert.equal(normalizeTransactionHash("ETH", "0x1234"), null);
  assert.equal(normalizeTransactionHash("SOL", "has spaces"), null);
  // Base58 that does not decode to a 64-byte signature is a caller mistake, not
  // a provider fault: the RPC would answer "Invalid param: WrongSize" and the
  // submission would be misreported as an unreachable provider.
  assert.equal(normalizeTransactionHash("SOL", "5".repeat(64)), null);
  assert.equal(normalizeTransactionHash("SOL", "1".repeat(88)), null);
});

test("a malformed transaction hash is invalid_hash, never a provider fault", async () => {
  const result = await verifyDepositOnChain({
    cryptoType: "BTC",
    txHash: "definitely-not-a-transaction-hash",
    expectedAmount: 0.5
  });
  assert.equal(result.stage, "invalid_hash");
  assert.equal(result.success, false);
  assert.match(result.failureReason || "", /bitcoin/i);
});

test("an uppercase Bitcoin txid is accepted and looked up in canonical form", async () => {
  routes = btcRoutes(btcTx(BTC_ADDR, 50_000_000, 3), BTC_TIP);
  const result = await verifyDepositOnChain({
    cryptoType: "BTC",
    txHash: BTC_HASH.toUpperCase(),
    expectedAmount: 0.5
  });
  assert.equal(result.stage, "verified");
  assert.equal(result.txHash, BTC_HASH);
});

// ---------------------------------------------------------------------------
// Provider error reporting
// ---------------------------------------------------------------------------

test("describeProviderError surfaces codes, HTTP status and provider messages", () => {
  const axiosError = mockAxiosError({
    code: "ETIMEDOUT",
    status: 503,
    data: { message: "Service temporarily unavailable" }
  });
  const text = describeProviderError(axiosError);
  assert.match(text, /ETIMEDOUT/);
  assert.match(text, /HTTP 503/);
  assert.match(text, /Service temporarily unavailable/);
});

test("describeProviderError reads the inner errors of an AggregateError", () => {
  const aggregate = Object.assign(new Error(""), {
    name: "AggregateError",
    errors: [{ code: "EAI_AGAIN", syscall: "getaddrinfo", message: "DNS lookup failed" }]
  });
  const text = describeProviderError(aggregate);
  assert.match(text, /EAI_AGAIN/);
  assert.match(text, /DNS lookup failed/);
});

test("describeProviderError never leaks API keys or URL query credentials", () => {
  const previous = process.env.ETHERSCAN_API_KEY;
  process.env.ETHERSCAN_API_KEY = "SUPER-SECRET-KEY-42";
  try {
    const text = describeProviderError(
      new Error(
        "request failed SUPER-SECRET-KEY-42 at https://api.etherscan.io/v2/api?apikey=SUPER-SECRET-KEY-42&module=account"
      )
    );
    assert.ok(!text.includes("SUPER-SECRET-KEY-42"));
    assert.ok(text.includes("https://api.etherscan.io/v2/api"));
    assert.ok(!text.includes("module=account"));
  } finally {
    process.env.ETHERSCAN_API_KEY = previous;
  }
});
