export type DepositCryptoType = "BTC" | "ETH" | "SOL" | "ERC20" | "TRC20";

export type DepositPlatformAsset =
  | "BTC"
  | "ETH"
  | "SOL"
  | "USDT_TRC20"
  | "USDT_ERC20";

export const SUPPORTED_DEPOSIT_CRYPTO_TYPES: DepositCryptoType[] = [
  "BTC",
  "ETH",
  "SOL",
  "ERC20",
  "TRC20"
];

const PLATFORM_ASSET_BY_CRYPTO_TYPE: Record<DepositCryptoType, DepositPlatformAsset> = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  ERC20: "USDT_ERC20",
  TRC20: "USDT_TRC20"
};

const NETWORK_BY_CRYPTO_TYPE: Record<DepositCryptoType, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  ERC20: "ERC20",
  TRC20: "TRC20"
};

export const DEPOSIT_DECIMALS_BY_CRYPTO_TYPE: Record<DepositCryptoType, number> = {
  BTC: 8,
  ETH: 8,
  SOL: 8,
  ERC20: 6,
  TRC20: 6
};

export function isSupportedDepositCryptoType(
  value: unknown
): value is DepositCryptoType {
  return (
    typeof value === "string" &&
    (SUPPORTED_DEPOSIT_CRYPTO_TYPES as string[]).includes(value)
  );
}

export function resolvePlatformAsset(
  cryptoType: DepositCryptoType
): DepositPlatformAsset {
  const asset = PLATFORM_ASSET_BY_CRYPTO_TYPE[cryptoType];
  if (!asset) {
    throw new Error(`Unsupported deposit crypto type: ${cryptoType}`);
  }
  return asset;
}

export function resolveDepositNetwork(cryptoType: DepositCryptoType): string {
  const network = NETWORK_BY_CRYPTO_TYPE[cryptoType];
  if (!network) {
    throw new Error(`Unsupported deposit crypto type: ${cryptoType}`);
  }
  return network;
}

export function normalizeTxHash(hash: unknown): string {
  return typeof hash === "string" ? hash.trim() : "";
}

export function exceedsDecimalPrecision(value: number, decimals: number): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  const scaled = value * Math.pow(10, decimals);
  return Math.abs(scaled - Math.round(scaled)) > 1e-6;
}

export interface DepositSubmissionInput {
  cryptoType: unknown;
  amount: unknown;
  txHash: unknown;
}

export interface DepositSubmissionValidation {
  valid: boolean;
  errors: string[];
  normalizedTxHash: string;
  numericAmount: number;
}

export function validateDepositSubmission(
  input: DepositSubmissionInput
): DepositSubmissionValidation {
  const errors: string[] = [];
  const normalizedTxHash = normalizeTxHash(input.txHash);
  const numericAmount = Number(input.amount);
  const cryptoType = input.cryptoType;

  if (normalizedTxHash.length < 8 || normalizedTxHash.length > 200) {
    errors.push("A valid blockchain transaction hash is required to submit a deposit.");
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    errors.push("Deposit amount must be a positive number.");
  }

  if (!isSupportedDepositCryptoType(cryptoType)) {
    errors.push("Select a supported asset and network before submitting a deposit.");
  } else if (
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    exceedsDecimalPrecision(numericAmount, DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType])
  ) {
    errors.push(
      `Amount supports at most ${
        DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType]
      } decimal places for this asset.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedTxHash,
    numericAmount
  };
}

export type DepositStatusTone = "gold" | "positive" | "negative";

export interface DepositStatusView {
  label: string;
  tone: DepositStatusTone;
}

export function describeDepositStatus(status: string): DepositStatusView {
  if (status === "Approved") {
    return { label: "Confirmed", tone: "positive" };
  }
  if (status === "Rejected") {
    return { label: "Rejected", tone: "negative" };
  }
  return { label: "Pending", tone: "gold" };
}
