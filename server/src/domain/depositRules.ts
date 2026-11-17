import {
  DepositStatusTone,
  DepositStatusView,
  describeDepositStatus as describeDepositStatusView
} from "./depositStatus";

export type DepositCryptoType = "BTC" | "ETH" | "SOL" | "ERC20" | "TRC20";

export { DepositStatusTone, DepositStatusView };

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

/**
 * Relative tolerance used when matching an on-chain amount to the expected
 * deposit amount. Shared by the blockchain verifier and the deposit monitor so
 * detection and verification always agree on what "the same amount" means.
 */
export const DEPOSIT_AMOUNT_TOLERANCE = 0.005;

export function amountsWithinDepositTolerance(actual: number, expected: number): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) {
    return false;
  }
  return Math.abs(actual - expected) <= Math.max(expected * DEPOSIT_AMOUNT_TOLERANCE, 1e-8);
}

export function describeDepositStatus(status: string): DepositStatusView {
  return describeDepositStatusView(status);
}

export interface DepositIntentInput {
  cryptoType: unknown;
  cryptoAmount: unknown;
  usdAmount: unknown;
}

export interface DepositIntentValidation {
  valid: boolean;
  errors: string[];
  numericCryptoAmount: number | null;
  numericUsdAmount: number | null;
}

/**
 * Validate a deposit *intent*: the asset/network, the amount the user intends to
 * send, and the optional USD value. No transaction hash is required here — a
 * pending deposit is created first and the on-chain transfer is matched later,
 * so this validation never depends on a blockchain provider.
 */
export function validateDepositIntent(input: DepositIntentInput): DepositIntentValidation {
  const errors: string[] = [];
  const cryptoType = input.cryptoType;

  if (!isSupportedDepositCryptoType(cryptoType)) {
    return {
      valid: false,
      errors: ["Select a supported asset and network before creating a deposit."],
      numericCryptoAmount: null,
      numericUsdAmount: null
    };
  }

  const hasCryptoAmount =
    input.cryptoAmount !== undefined && input.cryptoAmount !== null && input.cryptoAmount !== "";
  const hasUsdAmount =
    input.usdAmount !== undefined && input.usdAmount !== null && input.usdAmount !== "";

  const numericCryptoAmount = hasCryptoAmount ? Number(input.cryptoAmount) : null;
  const numericUsdAmount = hasUsdAmount ? Number(input.usdAmount) : null;

  if (!hasCryptoAmount && !hasUsdAmount) {
    errors.push("Enter a deposit amount.");
  }

  if (hasCryptoAmount) {
    if (!Number.isFinite(numericCryptoAmount) || (numericCryptoAmount as number) <= 0) {
      errors.push("Deposit amount must be a positive number.");
    } else if (
      exceedsDecimalPrecision(
        numericCryptoAmount as number,
        DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType]
      )
    ) {
      errors.push(
        `Amount supports at most ${
          DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType]
        } decimal places for this asset.`
      );
    }
  }

  if (hasUsdAmount && (!Number.isFinite(numericUsdAmount) || (numericUsdAmount as number) <= 0)) {
    errors.push("The deposit value must be a positive number.");
  }

  return {
    valid: errors.length === 0,
    errors,
    numericCryptoAmount: Number.isFinite(numericCryptoAmount as number)
      ? (numericCryptoAmount as number)
      : null,
    numericUsdAmount: Number.isFinite(numericUsdAmount as number)
      ? (numericUsdAmount as number)
      : null
  };
}
