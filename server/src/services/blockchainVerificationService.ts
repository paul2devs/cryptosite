import axios from "axios";
import { getPlatformWallets, SupportedPlatformAsset } from "./walletService";
import { requireEnv, requireIntEnv } from "../config/env";

export type SupportedCryptoType = "BTC" | "ETH" | "SOL" | "ERC20" | "TRC20";

export interface BlockchainVerificationInput {
  cryptoType: SupportedCryptoType;
  txHash: string;
  expectedAmount: number;
}

export interface BlockchainVerificationResult {
  success: boolean;
  assetSymbol: string;
  network: string;
  txHash: string;
  amount: number;
  toAddress: string;
  confirmations: number;
  minConfirmations: number;
  failureReason?: string;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function getPlatformAddressForCryptoType(cryptoType: SupportedCryptoType): {
  asset: SupportedPlatformAsset;
  address: string;
  network: string;
} {
  const wallets = getPlatformWallets();
  let asset: SupportedPlatformAsset;

  switch (cryptoType) {
    case "BTC":
      asset = "BTC";
      break;
    case "ETH":
      asset = "ETH";
      break;
    case "SOL":
      asset = "SOL";
      break;
    case "ERC20":
      asset = "USDT_ERC20";
      break;
    case "TRC20":
      asset = "USDT_TRC20";
      break;
    default:
      throw new Error(`Unsupported crypto type: ${cryptoType}`);
  }

  const wallet = wallets.find((w) => w.asset === asset);
  if (!wallet) {
    throw new Error(`No platform wallet configured for asset ${asset}`);
  }
  return wallet;
}

function amountsRoughlyEqual(onChain: number, expected: number): boolean {
  if (!Number.isFinite(onChain) || !Number.isFinite(expected)) {
    return false;
  }
  if (expected <= 0) {
    return false;
  }
  const diff = Math.abs(onChain - expected);
  const tolerance = Math.max(expected * 0.005, 0.00000001);
  return diff <= tolerance;
}

async function verifyBitcoinDeposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const { address, network } = getPlatformAddressForCryptoType("BTC");

  const base =
    process.env.BTC_BLOCKCHAIN_API_BASE || "https://blockstream.info/api";
  const url = `${base.replace(/\/+$/, "")}/tx/${encodeURIComponent(txHash)}`;

  const response = await axios.get(url, { timeout: 10000 });
  const tx = response.data;

  if (!tx || !Array.isArray(tx.vout)) {
    return {
      success: false,
      assetSymbol: "BTC",
      network,
      txHash,
      amount: 0,
      toAddress: "",
      confirmations: 0,
      minConfirmations: 0,
      failureReason: "Unable to parse Bitcoin transaction outputs"
    };
  }

  let valueSats = 0;
  let destinationFound = false;

  for (const vout of tx.vout) {
    const outAddress = String(vout.scriptpubkey_address || "").trim();
    if (normalizeAddress(outAddress) === normalizeAddress(address)) {
      destinationFound = true;
      valueSats += Number(vout.value || 0);
    }
  }

  const confirmations =
    typeof tx.status?.confirmations === "number"
      ? tx.status.confirmations
      : 0;
  const minConfirmations = requireIntEnv("BTC_MIN_CONFIRMATIONS", 1);
  const amount = valueSats / 1e8;

  if (!destinationFound) {
    return {
      success: false,
      assetSymbol: "BTC",
      network,
      txHash,
      amount,
      toAddress: "",
      confirmations,
      minConfirmations,
      failureReason: "Transaction does not pay to the platform BTC address"
    };
  }

  if (!amountsRoughlyEqual(amount, expectedAmount)) {
    return {
      success: false,
      assetSymbol: "BTC",
      network,
      txHash,
      amount,
      toAddress: address,
      confirmations,
      minConfirmations,
      failureReason: "On-chain BTC amount does not match the claimed amount"
    };
  }

  if (confirmations < minConfirmations) {
    return {
      success: false,
      assetSymbol: "BTC",
      network,
      txHash,
      amount,
      toAddress: address,
      confirmations,
      minConfirmations,
      failureReason: "Bitcoin transaction does not have enough confirmations"
    };
  }

  return {
    success: true,
    assetSymbol: "BTC",
    network,
    txHash,
    amount,
    toAddress: address,
    confirmations,
    minConfirmations
  };
}

async function verifyEthereumNativeDeposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const { address, network } = getPlatformAddressForCryptoType("ETH");

  const base =
    process.env.ETHERSCAN_API_BASE || "https://api.etherscan.io/api";
  const apiKey = requireEnv("ETHERSCAN_API_KEY");

  const txResp = await axios.get(base, {
    timeout: 10000,
    params: {
      module: "proxy",
      action: "eth_getTransactionByHash",
      txhash: txHash,
      apikey: apiKey
    }
  });

  const tx = txResp.data?.result;
  if (!tx) {
    return {
      success: false,
      assetSymbol: "ETH",
      network,
      txHash,
      amount: 0,
      toAddress: "",
      confirmations: 0,
      minConfirmations: 0,
      failureReason: "Ethereum transaction not found"
    };
  }

  const toAddress = String(tx.to || "").trim();
  const valueWei = Number.parseInt(tx.value || "0", 16);
  const amount = valueWei / 1e18;

  const blockResp = await axios.get(base, {
    timeout: 10000,
    params: {
      module: "proxy",
      action: "eth_blockNumber",
      apikey: apiKey
    }
  });

  const latestBlock = Number.parseInt(blockResp.data?.result || "0", 16);
  const txBlock = Number.parseInt(tx.blockNumber || "0", 16);
  const confirmations =
    latestBlock && txBlock && latestBlock >= txBlock
      ? latestBlock - txBlock
      : 0;
  const minConfirmations = requireIntEnv("ETH_MIN_CONFIRMATIONS", 6);

  if (normalizeAddress(toAddress) !== normalizeAddress(address)) {
    return {
      success: false,
      assetSymbol: "ETH",
      network,
      txHash,
      amount,
      toAddress,
      confirmations,
      minConfirmations,
      failureReason: "Ethereum transaction receiver does not match platform wallet"
    };
  }

  if (!amountsRoughlyEqual(amount, expectedAmount)) {
    return {
      success: false,
      assetSymbol: "ETH",
      network,
      txHash,
      amount,
      toAddress,
      confirmations,
      minConfirmations,
      failureReason: "On-chain ETH amount does not match the claimed amount"
    };
  }

  if (confirmations < minConfirmations) {
    return {
      success: false,
      assetSymbol: "ETH",
      network,
      txHash,
      amount,
      toAddress,
      confirmations,
      minConfirmations,
      failureReason: "Ethereum transaction does not have enough confirmations"
    };
  }

  return {
    success: true,
    assetSymbol: "ETH",
    network,
    txHash,
    amount,
    toAddress,
    confirmations,
    minConfirmations
  };
}

async function verifyEthereumUsdtErc20Deposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const { address, network } = getPlatformAddressForCryptoType("ERC20");

  const base =
    process.env.ETHERSCAN_API_BASE || "https://api.etherscan.io/api";
  const apiKey = requireEnv("ETHERSCAN_API_KEY");
  const usdtContract = requireEnv("USDT_ERC20_CONTRACT_ADDRESS");

  const txResp = await axios.get(base, {
    timeout: 10000,
    params: {
      module: "account",
      action: "tokentx",
      txhash: txHash,
      apikey: apiKey
    }
  });

  const events: any[] = txResp.data?.result || [];
  const match = events.find(
    (e) =>
      normalizeAddress(e.contractAddress || "") ===
        normalizeAddress(usdtContract) &&
      normalizeAddress(e.to || "") === normalizeAddress(address)
  );

  if (!match) {
    return {
      success: false,
      assetSymbol: "USDT",
      network,
      txHash,
      amount: 0,
      toAddress: "",
      confirmations: 0,
      minConfirmations: 0,
      failureReason: "No matching USDT ERC20 transfer to platform address"
    };
  }

  const valueRaw = String(match.value || "0");
  const decimals = Number(match.tokenDecimal || 6);
  const divisor = Math.pow(10, decimals);
  const amount = Number(valueRaw) / divisor;

  const currentBlockResp = await axios.get(base, {
    timeout: 10000,
    params: {
      module: "proxy",
      action: "eth_blockNumber",
      apikey: apiKey
    }
  });

  const latestBlock = Number.parseInt(currentBlockResp.data?.result || "0", 16);
  const txBlock = Number(match.blockNumber || "0");
  const confirmations =
    latestBlock && txBlock && latestBlock >= txBlock
      ? latestBlock - txBlock
      : 0;
  const minConfirmations = requireIntEnv("ERC20_MIN_CONFIRMATIONS", 6);

  if (!amountsRoughlyEqual(amount, expectedAmount)) {
    return {
      success: false,
      assetSymbol: "USDT",
      network,
      txHash,
      amount,
      toAddress: address,
      confirmations,
      minConfirmations,
      failureReason: "On-chain USDT (ERC20) amount does not match the claimed amount"
    };
  }

  if (confirmations < minConfirmations) {
    return {
      success: false,
      assetSymbol: "USDT",
      network,
      txHash,
      amount,
      toAddress: address,
      confirmations,
      minConfirmations,
      failureReason: "USDT (ERC20) transfer does not have enough confirmations"
    };
  }

  return {
    success: true,
    assetSymbol: "USDT",
    network,
    txHash,
    amount,
    toAddress: address,
    confirmations,
    minConfirmations
  };
}

async function verifyTronUsdtTrc20Deposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const { address, network } = getPlatformAddressForCryptoType("TRC20");

  const base =
    process.env.TRONSCAN_API_BASE ||
    "https://apilist.tronscanapi.com/api";

  const response = await axios.get(base.replace(/\/+$/, "") + "/transaction-info", {
    timeout: 10000,
    params: { hash: txHash }
  });

  const tx = response.data;
  if (!tx) {
    return {
      success: false,
      assetSymbol: "USDT",
      network,
      txHash,
      amount: 0,
      toAddress: "",
      confirmations: 0,
      minConfirmations: 0,
      failureReason: "TRON transaction not found"
    };
  }

  const contractType = Number(tx.contractType || 0);
  if (contractType !== 31 && contractType !== 1) {
    return {
      success: false,
      assetSymbol: "USDT",
      network,
      txHash,
      amount: 0,
      toAddress: "",
      confirmations: 0,
      minConfirmations: 0,
      failureReason: "Transaction is not a TRC20 transfer"
    };
  }

  const toAddress = String(tx.contractData?.to_address || "").trim();
  const amountRaw = Number(tx.contractData?.amount || 0);
  const amount = amountRaw / 1e6;
  const confirmations = Number(tx.confirmations || 0);
  const minConfirmations = requireIntEnv("TRC20_MIN_CONFIRMATIONS", 20);

  if (normalizeAddress(toAddress) !== normalizeAddress(address)) {
    return {
      success: false,
      assetSymbol: "USDT",
      network,
      txHash,
      amount,
      toAddress,
      confirmations,
      minConfirmations,
      failureReason: "TRC20 receiver address does not match platform wallet"
    };
  }

  if (!amountsRoughlyEqual(amount, expectedAmount)) {
    return {
      success: false,
      assetSymbol: "USDT",
      network,
      txHash,
      amount,
      toAddress,
      confirmations,
      minConfirmations,
      failureReason: "On-chain USDT (TRC20) amount does not match the claimed amount"
    };
  }

  if (confirmations < minConfirmations) {
    return {
      success: false,
      assetSymbol: "USDT",
      network,
      txHash,
      amount,
      toAddress,
      confirmations,
      minConfirmations,
      failureReason: "USDT (TRC20) transfer does not have enough confirmations"
    };
  }

  return {
    success: true,
    assetSymbol: "USDT",
    network,
    txHash,
    amount,
    toAddress,
    confirmations,
    minConfirmations
  };
}

async function verifySolanaDeposit(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const { txHash, expectedAmount } = params;
  const { address, network } = getPlatformAddressForCryptoType("SOL");

  const rpcUrl = requireEnv("SOLANA_RPC_URL");

  const response = await axios.post(
    rpcUrl,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [txHash, { encoding: "jsonParsed" }]
    },
    { timeout: 10000 }
  );

  const result = response.data?.result;
  if (!result) {
    return {
      success: false,
      assetSymbol: "SOL",
      network,
      txHash,
      amount: 0,
      toAddress: "",
      confirmations: 0,
      minConfirmations: 0,
      failureReason: "Solana transaction not found"
    };
  }

  const accountKeys: Array<{ pubkey: string }> =
    result.transaction?.message?.accountKeys || [];
  const preBalances: number[] = result.meta?.preBalances || [];
  const postBalances: number[] = result.meta?.postBalances || [];

  const index = accountKeys.findIndex(
    (k) => normalizeAddress(k.pubkey) === normalizeAddress(address)
  );

  if (index === -1) {
    return {
      success: false,
      assetSymbol: "SOL",
      network,
      txHash,
      amount: 0,
      toAddress: "",
      confirmations: 0,
      minConfirmations: 0,
      failureReason: "Solana transaction does not involve the platform wallet"
    };
  }

  const pre = Number(preBalances[index] || 0);
  const post = Number(postBalances[index] || 0);
  const diffLamports = post - pre;
  const amount = diffLamports / 1e9;

  const statusResp = await axios.post(
    rpcUrl,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "getSignatureStatuses",
      params: [[txHash], { searchTransactionHistory: true }]
    },
    { timeout: 10000 }
  );

  const status = statusResp.data?.result?.value?.[0];
  const confirmations =
    typeof status?.confirmations === "number"
      ? status.confirmations
      : status?.confirmationStatus === "finalized"
        ? requireIntEnv("SOL_MIN_CONFIRMATIONS", 10)
        : 0;
  const minConfirmations = requireIntEnv("SOL_MIN_CONFIRMATIONS", 10);

  if (!amountsRoughlyEqual(amount, expectedAmount)) {
    return {
      success: false,
      assetSymbol: "SOL",
      network,
      txHash,
      amount,
      toAddress: address,
      confirmations,
      minConfirmations,
      failureReason: "On-chain SOL amount does not match the claimed amount"
    };
  }

  if (confirmations < minConfirmations) {
    return {
      success: false,
      assetSymbol: "SOL",
      network,
      txHash,
      amount,
      toAddress: address,
      confirmations,
      minConfirmations,
      failureReason: "Solana transaction does not have enough confirmations"
    };
  }

  return {
    success: true,
    assetSymbol: "SOL",
    network,
    txHash,
    amount,
    toAddress: address,
    confirmations,
    minConfirmations
  };
}

export async function verifyDepositOnChain(
  params: BlockchainVerificationInput
): Promise<BlockchainVerificationResult> {
  const enabled =
    String(process.env.BLOCKCHAIN_VERIFICATION_ENABLED || "true").toLowerCase() ===
    "true";

  if (!enabled) {
    return {
      success: true,
      assetSymbol:
        params.cryptoType === "BTC" || params.cryptoType === "ETH" || params.cryptoType === "SOL"
          ? params.cryptoType
          : "USDT",
      network: getPlatformAddressForCryptoType(params.cryptoType).network,
      txHash: params.txHash,
      amount: params.expectedAmount,
      toAddress: getPlatformAddressForCryptoType(params.cryptoType).address,
      confirmations: 0,
      minConfirmations: 0
    };
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
      throw new Error(`Unsupported crypto type: ${params.cryptoType}`);
  }
}

