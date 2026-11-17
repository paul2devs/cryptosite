import { Op, UniqueConstraintError } from "sequelize";
import { Deposit } from "../models/Deposit";
import {
  DepositCryptoType,
  amountsWithinDepositTolerance,
  isSupportedDepositCryptoType
} from "../domain/depositRules";
import { resolveDepositCapability } from "../domain/depositNetworkCapabilities";
import {
  listActiveDepositsForMonitor,
  expireStaleDeposits,
  recordVerifiedPayment,
  applyVerificationResult,
  detailedStatusOf
} from "./depositLifecycleService";
import { getPlatformWallet } from "./walletService";
import { verifyDepositOnChain } from "./blockchainVerificationService";
import {
  confirmationsForBlock,
  etherscanAccountList,
  resolveEtherscanConfig
} from "./etherscanClient";
import {
  fetchBitcoinAddressTransactions,
  fetchSolanaTransaction,
  providerGet,
  solanaRpcCall,
  readOptionalEnv
} from "./blockchainProviderClient";

export interface IncomingTransaction {
  txHash: string;
  /** Amount received by the watched address, in whole asset units. */
  amount: number;
  toAddress: string;
  confirmations: number;
  /** Memo / destination tag, when the network genuinely carries one. */
  memo: string | null;
  /** ISO timestamp when the provider reports one. */
  occurredAt: string | null;
}

export interface DiscoveryResult {
  /** False when the network provider is not configured well enough to look. */
  configured: boolean;
  reason: string | null;
  transactions: IncomingTransaction[];
}

const LOOKBACK_SECONDS_DEFAULT = 48 * 60 * 60;
const DISCOVERY_LIMIT = 50;

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * A duplicate hash is rejected by the database's unique index as a side effect
 * of the concurrent write, so it surfaces as a constraint error rather than the
 * friendly reuse check. Report it in plain language; anything else keeps its
 * own message.
 */
function describeMatchError(error: unknown): string {
  if (error instanceof UniqueConstraintError) {
    return "this transaction is already attached to another deposit";
  }
  return error instanceof Error ? error.message : String(error);
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || String(raw).trim().length === 0) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function unconfigured(reason: string): DiscoveryResult {
  return { configured: false, reason, transactions: [] };
}

function failed(reason: string): DiscoveryResult {
  return { configured: true, reason, transactions: [] };
}

async function discoverBitcoin(
  address: string,
  sinceUnixSeconds: number
): Promise<DiscoveryResult> {
  // Shares the verifier's Esplora failover and IPv4 pinning, so scanning the
  // receiving address keeps working when the primary explorer is unreachable.
  const { rows, tipHeight: reportedTip } = await fetchBitcoinAddressTransactions(address);
  const tipHeight = reportedTip ?? 0;

  const transactions: IncomingTransaction[] = [];
  for (const row of rows) {
    const status = (row.status || {}) as Record<string, unknown>;
    const blockTime = Number(status.block_time || 0);
    if (blockTime > 0 && blockTime < sinceUnixSeconds) {
      continue;
    }
    const vout: Array<Record<string, unknown>> = Array.isArray(row.vout)
      ? (row.vout as Array<Record<string, unknown>>)
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
    // Esplora never returns a confirmation count, so it is derived from the tip
    // with the same shared helper the verifier uses — one formula for the whole
    // Bitcoin stack, so address discovery and admin approval cannot disagree.
    const confirmations =
      status.confirmed === true ? confirmationsForBlock(tipHeight, blockHeight) : 0;
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

async function discoverEthereumNative(
  address: string,
  sinceUnixSeconds: number
): Promise<DiscoveryResult> {
  const apiKey = resolveEtherscanConfig().apiKey;
  if (!apiKey) {
    return unconfigured(
      "ETHERSCAN_API_KEY is not configured, so incoming ETH transfers cannot be discovered automatically."
    );
  }
  // Etherscan V2 only: the chain id is applied by the shared client.
  const rows = await etherscanAccountList("txlist", {
    address,
    sort: "desc",
    page: 1,
    offset: DISCOVERY_LIMIT
  });

  const transactions: IncomingTransaction[] = [];
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

async function discoverEthereumUsdt(
  address: string,
  sinceUnixSeconds: number
): Promise<DiscoveryResult> {
  const apiKey = resolveEtherscanConfig().apiKey;
  const contract = readOptionalEnv("USDT_ERC20_CONTRACT_ADDRESS");
  if (!apiKey || !contract) {
    return unconfigured(
      !apiKey
        ? "ETHERSCAN_API_KEY is not configured, so incoming USDT (ERC20) transfers cannot be discovered automatically."
        : "USDT_ERC20_CONTRACT_ADDRESS is not configured, so incoming USDT (ERC20) transfers cannot be discovered automatically."
    );
  }
  // Etherscan V2 only: the address scopes the lookup and the chain id is applied
  // by the shared client.
  const rows = await etherscanAccountList("tokentx", {
    address,
    contractaddress: contract,
    sort: "desc",
    page: 1,
    offset: DISCOVERY_LIMIT
  });

  const transactions: IncomingTransaction[] = [];
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

async function discoverTronUsdt(
  address: string,
  sinceUnixSeconds: number
): Promise<DiscoveryResult> {
  const base = readOptionalEnv("TRONSCAN_API_BASE") || "https://apilist.tronscanapi.com/api";
  const token = readOptionalEnv("USDT_TRC20_CONTRACT_ADDRESS");
  const response = await providerGet<{ data?: Array<Record<string, unknown>> }>(
    `${base.replace(/\/+$/, "")}/filter/trc20/transfers`,
    {
      params: { relatedAddress: address, limit: DISCOVERY_LIMIT, start: 0 }
    }
  );

  const rows: Array<Record<string, unknown>> = Array.isArray(response.data?.data)
    ? response.data.data
    : [];

  const transactions: IncomingTransaction[] = [];
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
    const decimals = Number((row.tokenInfo as Record<string, unknown>)?.tokenDecimal || 6);
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

async function discoverSolana(
  address: string,
  sinceUnixSeconds: number
): Promise<DiscoveryResult> {
  const rpcUrl = readOptionalEnv("SOLANA_RPC_URL");
  if (!rpcUrl) {
    return unconfigured(
      "SOLANA_RPC_URL is not configured, so incoming SOL transfers cannot be discovered automatically."
    );
  }

  const signatures = (await solanaRpcCall(rpcUrl, "getSignaturesForAddress", [
    address,
    { limit: Math.min(25, DISCOVERY_LIMIT) }
  ])) as Array<{ signature: string; err?: unknown; blockTime?: number | null }> | null;

  const transactions: IncomingTransaction[] = [];
  for (const entry of signatures || []) {
    if (entry.err) {
      continue;
    }
    const blockTime = typeof entry.blockTime === "number" ? entry.blockTime : 0;
    if (blockTime > 0 && blockTime < sinceUnixSeconds) {
      continue;
    }
    const detail = (await fetchSolanaTransaction(rpcUrl, entry.signature)) as Record<string, unknown> | null;
    if (!detail) {
      continue;
    }
    const transaction = (detail.transaction || {}) as Record<string, unknown>;
    const message = (transaction.message || {}) as Record<string, unknown>;
    const meta = (detail.meta || {}) as Record<string, unknown>;
    const accountKeys = Array.isArray(message.accountKeys)
      ? (message.accountKeys as Array<Record<string, unknown>>)
      : [];
    const preBalances = Array.isArray(meta.preBalances) ? (meta.preBalances as number[]) : [];
    const postBalances = Array.isArray(meta.postBalances) ? (meta.postBalances as number[]) : [];

    const index = accountKeys.findIndex(
      (key) => normalizeAddress(String(key.pubkey || "")) === normalizeAddress(address)
    );
    if (index === -1) {
      continue;
    }
    const amount = (Number(postBalances[index] || 0) - Number(preBalances[index] || 0)) / 1e9;
    if (amount <= 0) {
      continue;
    }

    const statuses = (await solanaRpcCall(rpcUrl, "getSignatureStatuses", [
      [entry.signature],
      { searchTransactionHistory: true }
    ])) as { value?: Array<{ confirmations?: number | null; confirmationStatus?: string }> } | null;
    const status = statuses?.value?.[0];
    const minConfirmations = readPositiveInt("SOL_MIN_CONFIRMATIONS", 10);
    const confirmations =
      typeof status?.confirmations === "number"
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
export async function discoverIncomingTransactions(
  cryptoType: DepositCryptoType,
  address: string,
  sinceUnixSeconds: number
): Promise<DiscoveryResult> {
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
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }
}

function pickCandidate(deposits: Deposit[], amount: number): Deposit | null {
  let best: Deposit | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const deposit of deposits) {
    const expected = Number(deposit.amount);
    if (!amountsWithinDepositTolerance(amount, expected)) {
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

function memoSatisfied(
  deposit: Deposit,
  capabilityMemoSupported: boolean,
  incomingMemo: string | null
): boolean {
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

export interface MonitorSummary {
  scanned: number;
  matched: number;
  advanced: number;
  expired: number;
  errors: Array<{ cryptoType: string; reason: string }>;
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
export async function runDepositMonitor(): Promise<MonitorSummary> {
  const summary: MonitorSummary = {
    scanned: 0,
    matched: 0,
    advanced: 0,
    expired: 0,
    errors: []
  };

  summary.expired = await expireStaleDeposits();

  const active = await listActiveDepositsForMonitor();
  if (active.length === 0) {
    return summary;
  }

  summary.scanned = active.length;

  const allHashes = await Deposit.findAll({
    where: { tx_hash: { [Op.ne]: null } },
    attributes: ["tx_hash"]
  });
  const usedHashes = new Set(
    allHashes.map((row) => String(row.tx_hash || "").toLowerCase()).filter((value) => value.length > 0)
  );

  const byCryptoType = new Map<DepositCryptoType, Deposit[]>();
  for (const deposit of active) {
    if (!isSupportedDepositCryptoType(deposit.crypto_type)) {
      continue;
    }
    const list = byCryptoType.get(deposit.crypto_type) || [];
    list.push(deposit);
    byCryptoType.set(deposit.crypto_type, list);
  }

  const lookback = readPositiveInt("DEPOSIT_MONITOR_LOOKBACK_SECONDS", LOOKBACK_SECONDS_DEFAULT);
  const floor = Math.floor(Date.now() / 1000) - lookback;

  for (const [cryptoType, deposits] of byCryptoType) {
    const capability = resolveDepositCapability(cryptoType);
    const wallet = getPlatformWallet(capability.platformAsset);
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
    const remaining = deposits.filter(
      (deposit) => !deposit.tx_hash && detailedStatusOf(deposit) !== "AWAITING_ADMIN_APPROVAL"
    );

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

      const verification = await verifyDepositOnChain({
        cryptoType,
        txHash: incoming.txHash,
        expectedAmount: Number(target.amount)
      });

      if (verification.success) {
        try {
          await recordVerifiedPayment(target.deposit_id, verification);
        } catch (error) {
          summary.errors.push({
            cryptoType,
            reason: `Transaction ${incoming.txHash} could not be attached to deposit ${
              target.reference ?? target.deposit_id
            }: ${describeMatchError(error)}`
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
          await applyVerificationResult(target, verification);
        } catch (error) {
          summary.errors.push({
            cryptoType,
            reason: `Transaction ${incoming.txHash} could not be recorded for deposit ${
              target.reference ?? target.deposit_id
            }: ${describeMatchError(error)}`
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
        reason: `Transaction ${incoming.txHash} did not verify for deposit ${
          target.reference ?? target.deposit_id
        }: ${verification.failureReason || verification.stage}`
      });
    }
  }

  return summary;
}

export interface RescanOutcome {
  matched: boolean;
  advanced: boolean;
  reason: string;
  txHash: string | null;
}

/**
 * Re-check one deposit against its network right now. Used by the administrator
 * reconciliation action and by the "check now" control on the payment screen.
 * The outcome is always derived from an independent chain lookup.
 */
export async function rescanDeposit(depositId: string): Promise<RescanOutcome> {
  const deposit = await Deposit.findByPk(depositId);
  if (!deposit) {
    return { matched: false, advanced: false, reason: "Deposit not found.", txHash: null };
  }
  if (!isSupportedDepositCryptoType(deposit.crypto_type)) {
    return {
      matched: false,
      advanced: false,
      reason: "This deposit uses an asset the platform cannot scan.",
      txHash: deposit.tx_hash ?? null
    };
  }

  const capability = resolveDepositCapability(deposit.crypto_type);
  const wallet = getPlatformWallet(capability.platformAsset);
  if (!wallet) {
    return {
      matched: false,
      advanced: false,
      reason: `No receiving address is configured for ${capability.networkLabel}.`,
      txHash: deposit.tx_hash ?? null
    };
  }

  if (deposit.tx_hash) {
    const verification = await verifyDepositOnChain({
      cryptoType: deposit.crypto_type,
      txHash: deposit.tx_hash,
      expectedAmount: Number(deposit.amount)
    });
    if (verification.success) {
      try {
        await recordVerifiedPayment(deposit.deposit_id, verification);
      } catch (error) {
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
        reason:
          "We've verified your transaction on the blockchain. It is now awaiting administrator approval.",
        txHash: deposit.tx_hash
      };
    }
    const updated = await applyVerificationResult(deposit, verification);
    return {
      matched: verification.stage === "insufficient_confirmations",
      advanced: false,
      reason:
        verification.failureReason ||
        "The recorded transaction could not be verified on-chain yet.",
      txHash: updated.tx_hash ?? deposit.tx_hash
    };
  }

  const lookback = readPositiveInt("DEPOSIT_MONITOR_LOOKBACK_SECONDS", LOOKBACK_SECONDS_DEFAULT);
  const since = Math.floor((deposit.timestamp || new Date()).getTime() / 1000) - 300;
  const discovery = await discoverIncomingTransactions(
    deposit.crypto_type,
    wallet.address,
    Math.min(since, Math.floor(Date.now() / 1000) - lookback)
  );

  if (!discovery.configured) {
    return {
      matched: false,
      advanced: false,
      reason: discovery.reason || "Automatic scanning is unavailable for this network.",
      txHash: null
    };
  }

  const usedHashes = await Deposit.findAll({
    where: { tx_hash: { [Op.ne]: null } },
    attributes: ["tx_hash"]
  });
  const used = new Set(
    usedHashes.map((row) => String(row.tx_hash || "").toLowerCase()).filter((value) => value.length > 0)
  );

  for (const incoming of discovery.transactions) {
    if (used.has(incoming.txHash.toLowerCase())) {
      continue;
    }
    if (!amountsWithinDepositTolerance(incoming.amount, Number(deposit.amount))) {
      continue;
    }
    const verification = await verifyDepositOnChain({
      cryptoType: deposit.crypto_type,
      txHash: incoming.txHash,
      expectedAmount: Number(deposit.amount)
    });
    try {
      await applyVerificationResult(deposit, verification);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
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
        reason:
          "We've verified your transaction on the blockchain. It is now awaiting administrator approval.",
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
    reason:
      "No matching transfer has been detected on the selected network yet. Once your transfer is broadcast it can take a few minutes to appear.",
    txHash: null
  };
}
