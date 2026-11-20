import axios from "axios";
import {
  DepositCryptoType,
  amountsWithinDepositTolerance,
  isSupportedDepositCryptoType
} from "../domain/depositRules";
import { resolveDepositCapability } from "../domain/depositNetworkCapabilities";
import { decodeTrc20Transfer, rawTokenAmountToNumber } from "../domain/tronTrc20";
import { SupportedPlatformAsset, getPlatformWallet } from "./walletService";
import {
  EtherscanProviderError,
  confirmationsForBlock,
  etherscanAccountList,
  etherscanLatestBlockNumber,
  etherscanTransactionByHash,
  etherscanTransactionReceipt,
  resolveEtherscanConfig
} from "./etherscanClient";
import {
  fetchBitcoinTipHeight,
  fetchBitcoinTransaction,
  fetchSolanaTransaction,
  isNotFoundError,
  providerGet,
  solanaRpcCall,
  readOptionalEnv
} from "./blockchainProviderClient";

export type SupportedCryptoType = DepositCryptoType;

/**
 * Outcome of an independent on-chain lookup. The deposit lifecycle consumes
 * `stage` rather than a boolean so a transfer that is merely still confirming
 * is not confused with one that has been wrongly submitted, and so a provider
 * outage can never be mistaken for a successful verification.
 */
export type BlockchainVerificationStage =
  | "verified"
  | "not_found"
  | "mismatch"
  | "invalid_hash"
  | "insufficient_confirmations"
  | "provider_unavailable"
  | "provider_error";

export interface BlockchainVerificationInput {
  cryptoType: SupportedCryptoType;
  txHash: string;
  expectedAmount: number;
}

export interface BlockchainVerificationResult {
  success: boolean;
  stage: BlockchainVerificationStage;
  assetSymbol: string;
  network: string;
  txHash: string;
  amount: number;
  toAddress: string;
  confirmations: number;
  minConfirmations: number;
  failureReason?: string;
}

/** Public Solana mainnet RPC, used only when SOLANA_RPC_URL is not configured. */
export const DEFAULT_SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/** Base58 is case sensitive, so TRON addresses are compared verbatim. */
function sameBase58Address(a: string, b: string): boolean {
  return String(a || "").trim() === String(b || "").trim();
}

function hexToNumber(value: unknown): number {
  const raw = String(value ?? "0");
  if (raw.length === 0) {
    return 0;
  }
  try {
    return Number(BigInt(raw.startsWith("0x") ? raw : `0x${raw}`));
  } catch {
    const parsed = Number.parseInt(raw, 16);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}

/** A Bitcoin/Tron transaction id: 64 hex characters. */
const HEX_TXID_PATTERN = /^[0-9a-f]{64}$/i;
/** A Solana signature: base58 of a 64-byte Ed25519 signature (86–88 characters). */
const SOLANA_SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{64,100}$/;
/** An Ed25519 signature — and therefore a Solana transaction signature — is 64 bytes. */
const SOLANA_SIGNATURE_BYTES = 64;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function stripHexPrefix(value: string): string {
  return /^0x/i.test(value) ? value.slice(2) : value;
}

/** Base58 decode with leading-zero handling, or null when a character is invalid. */
function decodeBase58(value: string): Uint8Array | null {
  const bytes: number[] = [0];
  for (const character of value) {
    let carry = BASE58_ALPHABET.indexOf(character);
    if (carry < 0) {
      return null;
    }
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < value.length && value[i] === "1"; i += 1) {
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

/**
 * Canonical form of a transaction hash for its network, or null when the value
 * cannot possibly be a hash on that network.
 *
 * This runs *before* any provider call for two reasons: a malformed hash is a
 * caller mistake and must never be reported as "the blockchain provider is
 * unreachable", and an EVM hash pasted without its `0x` prefix, or an uppercase
 * hex id, must resolve to exactly one stored string or the duplicate-transaction
 * guard can be bypassed with a cosmetic variant of the same hash.
 */
export function normalizeTransactionHash(
  cryptoType: SupportedCryptoType,
  rawHash: unknown
): string | null {
  const value = typeof rawHash === "string" ? rawHash.trim() : "";
  if (value.length === 0) {
    return null;
  }
  switch (cryptoType) {
    case "BTC":
      return HEX_TXID_PATTERN.test(value) ? value.toLowerCase() : null;
    case "TRC20":
      return HEX_TXID_PATTERN.test(stripHexPrefix(value)) ? stripHexPrefix(value).toLowerCase() : null;
    case "ETH":
    case "ERC20": {
      const withoutPrefix = stripHexPrefix(value);
      return HEX_TXID_PATTERN.test(withoutPrefix) ? `0x${withoutPrefix.toLowerCase()}` : null;
    }
    case "SOL": {
      // The decoded length matters, not just the alphabet: the RPC rejects a
      // base58 string that is not a 64-byte Ed25519 signature as an invalid
      // parameter, which would otherwise surface as a provider fault instead of
      // the caller mistake it actually is.
      if (!SOLANA_SIGNATURE_PATTERN.test(value)) {
        return null;
      }
      const decoded = decodeBase58(value);
      return decoded && decoded.length === SOLANA_SIGNATURE_BYTES ? value : null;
    }
    default:
      return null;
  }
}

/** Explanation shown when a submitted hash cannot belong to the chosen network. */
export const INVALID_TX_HASH_REASON: Record<SupportedCryptoType, string> = {
  BTC: "That is not a Bitcoin transaction ID. A Bitcoin transaction ID is 64 hexadecimal characters — copy it from your wallet or a block explorer and try again.",
  ETH: "That is not an Ethereum transaction hash. An Ethereum transaction hash is 66 characters starting with 0x — copy it from your wallet or a block explorer and try again.",
  ERC20:
    "That is not an Ethereum transaction hash. An ERC20 transfer is identified by its Ethereum transaction hash — 66 characters starting with 0x — copy it from your wallet or a block explorer and try again.",
  TRC20:
    "That is not a Tron transaction ID. A TRON transaction ID is 64 hexadecimal characters — copy it from your wallet or a block explorer and try again.",
  SOL: "That is not a Solana transaction signature. Copy the full base58 signature from your wallet or a block explorer and try again."
};

/** The platform receiving address and network for a crypto type, or null when unconfigured. */
export function platformAddressForCryptoType(
  cryptoType: SupportedCryptoType
): { asset: SupportedPlatformAsset; address: string; network: string } | null {
  if (!isSupportedDepositCryptoType(cryptoType)) {
    return null;
  }
  const capability = resolveDepositCapability(cryptoType);
  const wallet = getPlatformWallet(capability.platformAsset);
  if (!wallet) {
    return null;
  }
  return { asset: wallet.asset, address: wallet.address, network: wallet.network };
}

export function symbolForCryptoType(cryptoType: SupportedCryptoType): string {
  return isSupportedDepositCryptoType(cryptoType)
    ? resolveDepositCapability(cryptoType).symbol
    : String(cryptoType);
}

/**
 * The verification kill-switch. When it is off the platform does not claim a
 * transfer is valid — it reports the provider as unavailable so the deposit
 * stays pending for administrator reconciliation instead of being auto-advanced.
 */
export function isBlockchainVerificationEnabled(): boolean {
  return String(process.env.BLOCKCHAIN_VERIFICATION_ENABLED || "true").trim().toLowerCase() !== "false";
}

function buildResult(
  cryptoType: SupportedCryptoType,
  txHash: string,
  stage: BlockchainVerificationStage,
  overrides: Partial<BlockchainVerificationResult> = {}
): BlockchainVerificationResult {
  const capability = isSupportedDepositCryptoType(cryptoType)
    ? resolveDepositCapability(cryptoType)
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

function unconfigured(
  cryptoType: SupportedCryptoType,
  txHash: string,
  reason: string
): BlockchainVerificationResult {
  return buildResult(cryptoType, txHash, "provider_unavailable", { failureReason: reason });
}

/**
 * Strip anything sensitive (API keys, tokens embedded in URLs) out of a provider
 * error before it can reach a log line or a user-facing message. Only the scheme
 * + host + path of any URL survives, so a query-string credential cannot leak.
 */
function sanitizeProviderText(text: string): string {
  let output = String(text || "");
  const secrets = [
    process.env.ETHERSCAN_API_KEY,
    process.env.SOLANA_RPC_URL
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));
  for (const secret of secrets) {
    output = output.split(secret).join("***");
  }
  output = output.replace(/(apikey|api_key|token|secret)=[^&\s"']+/gi, "$1=***");
  output = output.replace(/https?:\/\/[^\s"']+/gi, (url) => {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
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
export function describeProviderError(error: unknown): string {
  const parts: string[] = [];

  if (axios.isAxiosError(error)) {
    if (error.code) {
      parts.push(String(error.code));
    }
    if (error.response?.status) {
      parts.push(`HTTP ${error.response.status}`);
    }
    const data = error.response?.data;
    if (typeof data === "string") {
      parts.push(data);
    } else if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const message = record.message ?? record.error ?? record.result;
      if (typeof message === "string") {
        parts.push(message);
      }
    }
    if (parts.length === 0 && error.message) {
      parts.push(error.message);
    }
  } else if (Array.isArray((error as { errors?: unknown })?.errors)) {
    // Duck-typed because the ES2020 lib target has no global AggregateError.
    parts.push((error as { name?: string }).name || "AggregateError");
    const inner = (error as { errors?: unknown[] }).errors || [];
    for (const item of inner) {
      const record = item as { code?: string; message?: string; syscall?: string };
      const detail = [record?.code, record?.syscall, record?.message].filter(Boolean).join(" ");
      if (detail) {
        parts.push(detail);
      }
    }
  } else if (error instanceof Error) {
    parts.push(error.name);
    if (error.message) {
      parts.push(error.message);
    }
    const code = (error as { code?: string }).code;
    if (code) {
      parts.push(String(code));
    }
  } else {
    parts.push(String(error));
  }

  const joined = parts
    .map((part) => String(part).trim())
    .filter((part) => part.length > 0)
    .join(" | ");
  return sanitizeProviderText(joined) || "unknown provider failure";
}

/**
 * Why a provider call failed, in the only three categories the deposit lifecycle
 * cares about:
 *
 * - `transient`     the provider could not be reached or is throttling us. The
 *                   transaction may well be perfectly valid, so the deposit must
 *                   stay pending and the stored hash must be retried later.
 * - `configuration` the provider answered but rejected us (bad/absent API key,
 *                   forbidden). An operator has to fix this; retrying blindly
 *                   will not help.
 * - `unclassified`  anything else — still never treated as a failed payment.
 *
 * A provider fault must never be flattened into `not_found` (which would imply
 * the transfer does not exist) or into a success.
 */
export type ProviderFailureKind = "transient" | "configuration" | "unclassified";

const TRANSIENT_NETWORK_CODES = new Set([
  "ETIMEDOUT",
  "ECONNABORTED",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ERR_NETWORK",
  "ERR_BAD_RESPONSE",
  "ERR_SOCKET_CONNECTION_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET"
]);

const CONFIGURATION_PATTERN =
  /invalid api key|invalid apikey|missing apikey|apikey is required|api key is required|unauthorized|not authorized|forbidden|invalid key|api key.*(invalid|expired)/i;

const TRANSIENT_MESSAGE_PATTERN =
  /rate limit|too many requests|max calls|max rate|throttl|temporarily unavailable|service unavailable|timed? ?out|socket hang up|getaddrinfo|econn|enotfound|eai_again/i;

export function classifyProviderFailure(error: unknown): ProviderFailureKind {
  if (error instanceof EtherscanProviderError) {
    const message = `${error.code} ${error.message}`;
    if (CONFIGURATION_PATTERN.test(message)) {
      return "configuration";
    }
    return TRANSIENT_MESSAGE_PATTERN.test(message) ? "transient" : "unclassified";
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return "configuration";
    }
    if (status === 429 || (typeof status === "number" && status >= 500)) {
      return "transient";
    }
    if (!error.response) {
      // No HTTP answer at all: DNS, TCP, TLS or timeout.
      return "transient";
    }
    return TRANSIENT_MESSAGE_PATTERN.test(String(error.message || ""))
      ? "transient"
      : "unclassified";
  }

  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && TRANSIENT_NETWORK_CODES.has(code)) {
    return "transient";
  }
  // Node reports DNS/connect failures as an AggregateError with no message.
  if (Array.isArray((error as { errors?: unknown } | null)?.errors)) {
    return "transient";
  }
  if (TRANSIENT_MESSAGE_PATTERN.test(String((error as Error | null)?.message || ""))) {
    return "transient";
  }
  return "unclassified";
}

/**
 * Turn a provider fault into a stage. The detail is logged (sanitised) so an
 * operator can see the real cause; the depositor only ever sees an explanation
 * that keeps the deposit pending and never claims the transfer is invalid.
 */
function providerFailure(
  cryptoType: SupportedCryptoType,
  txHash: string,
  error: unknown,
  context: string
): BlockchainVerificationResult {
  const kind = classifyProviderFailure(error);
  const detail = describeProviderError(error);
  // eslint-disable-next-line no-console
  console.error(`[blockchain-verification] ${cryptoType} ${context} failed (${kind}): ${detail}`);

  if (kind === "transient") {
    return buildResult(cryptoType, txHash, "provider_unavailable", {
      failureReason:
        "The blockchain provider is temporarily unavailable, so this transaction could not be checked yet. Your transaction hash is saved and your deposit stays pending — verification will be retried automatically."
    });
  }
  if (kind === "configuration") {
    return buildResult(cryptoType, txHash, "provider_error", {
      failureReason:
        "On-chain verification is unavailable because of a blockchain provider configuration problem. Your deposit stays pending and will be reconciled through our platform review process."
    });
  }
  return buildResult(cryptoType, txHash, "provider_error", {
    failureReason:
      "We could not reach the blockchain provider to verify this transaction right now. Your deposit stays pending and will be reconciled through our platform review process."
  });
}

async function verifyBitcoinDeposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const platform = platformAddressForCryptoType("BTC");
  if (!platform) {
    return unconfigured("BTC", txHash, "No receiving Bitcoin address is configured.");
  }
  const capability = resolveDepositCapability("BTC");

  try {
    // `fetchBitcoinTransaction` walks every configured Esplora endpoint: the
    // configured base first, then an independent fallback, and only reports a
    // fault once all of them have failed. A definitive "not found" from any
    // endpoint is authoritative, so failover can never invent a payment.
    const lookup = await fetchBitcoinTransaction(txHash);
    if (lookup.kind === "unavailable") {
      return providerFailure("BTC", txHash, lookup.error, "transaction lookup");
    }
    if (lookup.kind === "not_found") {
      return buildResult("BTC", txHash, "not_found", {
        failureReason: "We could not find this transaction on the Bitcoin network yet."
      });
    }

    const tx = lookup.tx;
    let valueSats = 0;
    let destinationFound = false;
    for (const vout of tx.vout as Array<Record<string, unknown>>) {
      if (normalizeAddress(String(vout.scriptpubkey_address || "")) === normalizeAddress(platform.address)) {
        destinationFound = true;
        valueSats += Number(vout.value || 0);
      }
    }

    // Blockstream's `/tx` endpoint does not return a confirmation count, so it
    // must be derived from the height difference. If the tip cannot be read the
    // verification fails closed rather than reporting confirmations of 0 as if
    // the transaction were not mined.
    const tipHeight = lookup.tipHeight || (await fetchBitcoinTipHeight());
    if (!tipHeight) {
      return providerFailure(
        "BTC",
        txHash,
        new Error("The Bitcoin chain tip could not be read from any explorer."),
        "chain tip lookup"
      );
    }
    const status = (tx.status || {}) as Record<string, unknown>;
    const blockHeight = Number(status.block_height || 0);
    const confirmed = status.confirmed === true;
    const confirmations =
      confirmed && blockHeight > 0 ? confirmationsForBlock(tipHeight, blockHeight) : 0;
    const amount = valueSats / 1e8;

    if (!destinationFound) {
      return buildResult("BTC", txHash, "mismatch", {
        amount,
        confirmations,
        failureReason: `This transaction does not pay to the platform Bitcoin address.`
      });
    }
    if (!amountsWithinDepositTolerance(amount, expectedAmount)) {
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
  } catch (error) {
    return providerFailure("BTC", txHash, error, "transaction lookup");
  }
}

async function verifyEthereumNativeDeposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const platform = platformAddressForCryptoType("ETH");
  if (!platform) {
    return unconfigured("ETH", txHash, "No receiving Ethereum address is configured.");
  }
  if (!resolveEtherscanConfig().apiKey) {
    return unconfigured("ETH", txHash, "ETHERSCAN_API_KEY is not configured for Ethereum verification.");
  }
  const capability = resolveDepositCapability("ETH");

  try {
    const tx = (await etherscanTransactionByHash(txHash)) as Record<string, unknown> | null;
    if (!tx || typeof tx !== "object") {
      return buildResult("ETH", txHash, "not_found", {
        failureReason: "We could not find this transaction on the Ethereum network yet."
      });
    }

    const toAddress = String(tx.to || "").trim();
    const amount = hexToNumber(tx.value) / 1e18;
    const receipt = (await etherscanTransactionReceipt(txHash)) as Record<string, unknown> | null;
    const latestBlock = await etherscanLatestBlockNumber();
    const txBlock = tx.blockNumber ? hexToNumber(tx.blockNumber) : 0;
    const confirmations = confirmationsForBlock(latestBlock, txBlock);

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
    if (!amountsWithinDepositTolerance(amount, expectedAmount)) {
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
  } catch (error) {
    return providerFailure("ETH", txHash, error, "transaction lookup");
  }
}

async function verifyEthereumUsdtErc20Deposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const platform = platformAddressForCryptoType("ERC20");
  if (!platform) {
    return unconfigured("ERC20", txHash, "No receiving ERC20 address is configured.");
  }
  const contract = readOptionalEnv("USDT_ERC20_CONTRACT_ADDRESS");
  if (!resolveEtherscanConfig().apiKey) {
    return unconfigured("ERC20", txHash, "ETHERSCAN_API_KEY is not configured for ERC20 verification.");
  }
  if (!contract) {
    return unconfigured(
      "ERC20",
      txHash,
      "USDT_ERC20_CONTRACT_ADDRESS is not configured, so ERC20 transfers cannot be verified."
    );
  }
  const capability = resolveDepositCapability("ERC20");

  try {
    const tx = (await etherscanTransactionByHash(txHash)) as Record<string, unknown> | null;
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
    const events = await etherscanAccountList("tokentx", {
      address: platform.address,
      contractaddress: contract,
      startblock: txBlock,
      endblock: txBlock,
      sort: "asc"
    });

    const forThisTransaction = events.filter(
      (event) => String(event.hash || "").toLowerCase() === txHash.toLowerCase()
    );
    if (forThisTransaction.length === 0) {
      return buildResult("ERC20", txHash, "not_found", {
        failureReason: "We could not find this USDT (ERC20) transfer yet."
      });
    }

    const contractMatches = forThisTransaction.filter(
      (event) => normalizeAddress(String(event.contractAddress || "")) === normalizeAddress(contract)
    );
    if (contractMatches.length === 0) {
      return buildResult("ERC20", txHash, "mismatch", {
        failureReason: "This transaction does not transfer the supported USDT (ERC20) token."
      });
    }

    const match = contractMatches.find(
      (event) => normalizeAddress(String(event.to || "")) === normalizeAddress(platform.address)
    );
    if (!match) {
      return buildResult("ERC20", txHash, "mismatch", {
        failureReason:
          "No matching USDT (ERC20) transfer to the platform receiving address was found in this transaction."
      });
    }

    const decimals = Number(match.tokenDecimal || capability.decimals);
    const amount = Number(match.value || 0) / Math.pow(10, decimals);
    const receipt = (await etherscanTransactionReceipt(txHash)) as Record<string, unknown> | null;
    const latestBlock = await etherscanLatestBlockNumber();
    const confirmations = confirmationsForBlock(latestBlock, Number(match.blockNumber || 0));

    if (receipt && String(receipt.status) === "0x0") {
      return buildResult("ERC20", txHash, "mismatch", {
        amount,
        toAddress: platform.address,
        confirmations,
        failureReason: "This Ethereum transaction failed on-chain and did not transfer any USDT."
      });
    }
    if (!amountsWithinDepositTolerance(amount, expectedAmount)) {
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
  } catch (error) {
    return providerFailure("ERC20", txHash, error, "token transfer lookup");
  }
}

async function verifyTronUsdtTrc20Deposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const platform = platformAddressForCryptoType("TRC20");
  if (!platform) {
    return unconfigured("TRC20", txHash, "No receiving TRC20 address is configured.");
  }
  const capability = resolveDepositCapability("TRC20");
  const base = (readOptionalEnv("TRONSCAN_API_BASE") || "https://apilist.tronscanapi.com/api").replace(
    /\/+$/,
    ""
  );
  const contract = readOptionalEnv("USDT_TRC20_CONTRACT_ADDRESS");

  try {
    const response = await providerGet(`${base}/transaction-info`, {
      params: { hash: txHash }
    });
    const tx = response.data as Record<string, unknown> | null;
    if (!tx || typeof tx !== "object" || Object.keys(tx).length === 0) {
      return buildResult("TRC20", txHash, "not_found", {
        failureReason: "We could not find this transaction on the Tron network yet."
      });
    }

    const contractData = (tx.contractData || {}) as Record<string, unknown>;
    // Tronscan encodes the recipient and amount inside the ABI `data` blob; the
    // friendly `to_address` / `amount` fields are not returned.
    const decoded = decodeTrc20Transfer(String(contractData.data || ""));
    if (!decoded) {
      return buildResult("TRC20", txHash, "mismatch", {
        failureReason: "This transaction is not a TRC20 token transfer."
      });
    }

    const tokenContract = String(contractData.contract_address || tx.contract_address || "").trim();
    const amount = rawTokenAmountToNumber(decoded.amountRaw, capability.decimals);
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
    if (!amountsWithinDepositTolerance(amount, expectedAmount)) {
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
  } catch (error) {
    if (isNotFoundError(error)) {
      return buildResult("TRC20", txHash, "not_found", {
        failureReason: "We could not find this transaction on the Tron network yet."
      });
    }
    return providerFailure("TRC20", txHash, error, "transaction lookup");
  }
}

async function verifySolanaDeposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const platform = platformAddressForCryptoType("SOL");
  if (!platform) {
    return unconfigured("SOL", txHash, "No receiving Solana address is configured.");
  }
  // The platform only accepts native SOL transfers (no SPL tokens), so a token
  // mint check is not applicable: the verified amount is the lamport balance
  // delta of the receiving account itself.
  const rpcUrl = readOptionalEnv("SOLANA_RPC_URL") || DEFAULT_SOLANA_RPC_URL;
  const capability = resolveDepositCapability("SOL");

  try {
    const result = (await fetchSolanaTransaction(rpcUrl, txHash)) as Record<string, unknown> | null;

    if (!result) {
      return buildResult("SOL", txHash, "not_found", {
        failureReason: "We could not find this transaction on the Solana network yet."
      });
    }

    const transaction = (result.transaction || {}) as Record<string, unknown>;
    const message = (transaction.message || {}) as Record<string, unknown>;
    const meta = (result.meta || {}) as Record<string, unknown>;
    const accountKeys = Array.isArray(message.accountKeys)
      ? (message.accountKeys as Array<Record<string, unknown>>)
      : [];
    const preBalances = Array.isArray(meta.preBalances) ? (meta.preBalances as number[]) : [];
    const postBalances = Array.isArray(meta.postBalances) ? (meta.postBalances as number[]) : [];

    const index = accountKeys.findIndex(
      (key) => normalizeAddress(String(key.pubkey || "")) === normalizeAddress(platform.address)
    );
    if (index === -1) {
      return buildResult("SOL", txHash, "mismatch", {
        failureReason: "This transaction does not involve the platform receiving address."
      });
    }

    const amount = (Number(postBalances[index] || 0) - Number(preBalances[index] || 0)) / 1e9;

    const statusResp = (await solanaRpcCall<{
      value?: Array<{ confirmations?: number | null; confirmationStatus?: string }>;
    }>(rpcUrl, "getSignatureStatuses", [
      [txHash],
      { searchTransactionHistory: true }
    ])) as { value?: Array<{ confirmations?: number | null; confirmationStatus?: string }> } | null;
    const status = statusResp?.value?.[0];
    const confirmations =
      typeof status?.confirmations === "number"
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
    if (!amountsWithinDepositTolerance(amount, expectedAmount)) {
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
  } catch (error) {
    return providerFailure("SOL", txHash, error, "RPC lookup");
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
export async function verifyDepositOnChain(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  if (!isSupportedDepositCryptoType(params.cryptoType)) {
    return buildResult(params.cryptoType, params.txHash, "provider_unavailable", {
      failureReason: `Verification is not implemented for ${String(params.cryptoType)}.`
    });
  }
  if (!isBlockchainVerificationEnabled()) {
    return unconfigured(
      params.cryptoType,
      params.txHash,
      "On-chain verification is disabled by configuration, so deposits must be reconciled through our platform review process."
    );
  }

  // Reject a hash that cannot belong to this network before it reaches a
  // provider. Reporting "invalid hash" instead of a provider fault keeps a
  // mistyped or wrong-network hash from looking like an outage, and normalising
  // here means the value stored against the deposit is canonical.
  const txHash = normalizeTransactionHash(params.cryptoType, params.txHash);
  if (!txHash) {
    return buildResult(params.cryptoType, String(params.txHash ?? "").trim(), "invalid_hash", {
      failureReason: INVALID_TX_HASH_REASON[params.cryptoType]
    });
  }

  const normalized: BlockchainVerificationInput = { ...params, txHash };
  switch (normalized.cryptoType) {
    case "BTC":
      return verifyBitcoinDeposit(normalized);
    case "ETH":
      return verifyEthereumNativeDeposit(normalized);
    case "SOL":
      return verifySolanaDeposit(normalized);
    case "ERC20":
      return verifyEthereumUsdtErc20Deposit(normalized);
    case "TRC20":
      return verifyTronUsdtTrc20Deposit(normalized);
    default:
      return buildResult(normalized.cryptoType, normalized.txHash, "provider_unavailable", {
        failureReason: `Verification is not implemented for ${String(normalized.cryptoType)}.`
      });
  }
}
