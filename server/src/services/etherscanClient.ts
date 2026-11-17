import axios from "axios";

/**
 * Etherscan retired its V1 API; every call must go through V2 with an explicit
 * chain id. This module is the single place that resolves the endpoint so the
 * verifier and the chain monitor cannot drift apart, and so a stale
 * `ETHERSCAN_API_BASE` pointing at the dead V1 host cannot silently disable
 * Ethereum verification.
 */
export const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";
export const ETHEREUM_MAINNET_CHAIN_ID = "1";

const DEPRECATED_V1_BASE_PATTERN = /^https?:\/\/api\.etherscan\.io\/api$/i;

export interface EtherscanConfig {
  apiKey: string | null;
  base: string;
  chainId: string;
}

/**
 * Raised when Etherscan answers with a transport-successful but logically failed
 * envelope. Account endpoints reply `{ status: "0", message: "NOTOK", result:
 * "<reason>" }` for rate limits, invalid keys and other request failures, and
 * proxy endpoints reply `{ error: { code, message } }` for JSON-RPC failures.
 * Both are provider faults, not "the transaction does not exist", so they must
 * throw rather than be flattened into an empty list — otherwise a transient
 * rate limit is reported to the depositor as `not_found`.
 */
export class EtherscanProviderError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EtherscanProviderError";
    this.code = code;
  }
}

function detectEtherscanError(
  payload: Record<string, unknown>
): { code: string; message: string } | null {
  const rpcError = payload.error;
  if (rpcError && typeof rpcError === "object") {
    const record = rpcError as Record<string, unknown>;
    const code = record.code !== undefined ? `JSONRPC_${String(record.code)}` : "JSONRPC_ERROR";
    const message =
      typeof record.message === "string" && record.message.length > 0
        ? record.message
        : "Etherscan returned a JSON-RPC error.";
    return { code, message };
  }
  // `status: "0"` alone is not an error — an address with no transfers answers
  // `message: "No transactions found"`. Only the explicit NOTOK envelope means
  // the request itself failed.
  if (String(payload.status ?? "").trim() === "0" && String(payload.message ?? "").trim().toUpperCase() === "NOTOK") {
    const detail =
      typeof payload.result === "string" && payload.result.length > 0
        ? payload.result
        : "Etherscan reported a request failure.";
    return { code: "NOTOK", message: detail };
  }
  return null;
}

function readOptionalEnv(name: string): string | null {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveEtherscanConfig(): EtherscanConfig {
  const configured = readOptionalEnv("ETHERSCAN_API_BASE");
  let base = (configured || ETHERSCAN_V2_BASE).replace(/\/+$/, "");
  if (DEPRECATED_V1_BASE_PATTERN.test(base)) {
    base = ETHERSCAN_V2_BASE;
  }
  return {
    apiKey: readOptionalEnv("ETHERSCAN_API_KEY"),
    base,
    chainId: readOptionalEnv("ETHEREUM_CHAIN_ID") || ETHEREUM_MAINNET_CHAIN_ID
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
export async function etherscanRequest(
  params: Record<string, string | number>
): Promise<Record<string, unknown>> {
  const { apiKey, base, chainId } = resolveEtherscanConfig();
  const response = await axios.get(base, {
    timeout: 15000,
    params: { chainid: chainId, ...params, apikey: apiKey ?? "" }
  });
  const payload = (response.data || {}) as Record<string, unknown>;
  const envelopeError = detectEtherscanError(payload);
  if (envelopeError) {
    throw new EtherscanProviderError(envelopeError.code, envelopeError.message);
  }
  return payload;
}

/** Reads `result` from a proxy (`eth_*`) response, returning null when absent. */
export async function etherscanProxy(
  action: string,
  extra: Record<string, string | number>
): Promise<unknown> {
  const payload = await etherscanRequest({ module: "proxy", action, ...extra });
  return payload.result ?? null;
}

/** Reads an array `result` from an account response, returning [] when absent. */
export async function etherscanAccountList(
  action: string,
  extra: Record<string, string | number>
): Promise<Array<Record<string, unknown>>> {
  const payload = await etherscanRequest({ module: "account", action, ...extra });
  return Array.isArray(payload.result) ? (payload.result as Array<Record<string, unknown>>) : [];
}

export async function etherscanLatestBlockNumber(): Promise<number> {
  const result = await etherscanProxy("eth_blockNumber", {});
  const parsed = Number.parseInt(String(result ?? "0"), 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function etherscanTransactionReceipt(txHash: string): Promise<unknown> {
  return etherscanProxy("eth_getTransactionReceipt", { txhash: txHash });
}

export function etherscanTransactionByHash(txHash: string): Promise<unknown> {
  return etherscanProxy("eth_getTransactionByHash", { txhash: txHash });
}

/**
 * Confirmations for a mined block, inclusive of the block itself. Returns 0 when
 * the transaction is not yet mined or the tip is unknown so an unmined transfer
 * can never satisfy a confirmation threshold.
 */
export function confirmationsForBlock(
  latestBlock: number,
  blockNumber: number
): number {
  if (!latestBlock || !blockNumber || latestBlock < blockNumber) {
    return 0;
  }
  return latestBlock - blockNumber + 1;
}
