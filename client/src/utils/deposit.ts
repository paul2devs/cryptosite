export type CryptoType = "BTC" | "ETH" | "SOL" | "ERC20" | "TRC20";

export type PlatformAsset =
  | "BTC"
  | "ETH"
  | "SOL"
  | "USDT_TRC20"
  | "USDT_ERC20";

export type DepositSymbol = "BTC" | "ETH" | "SOL" | "USDT";

export type DepositTone = "gold" | "positive" | "negative";

export interface DepositNetworkOption {
  cryptoType: CryptoType;
  platformAsset: PlatformAsset;
  symbol: DepositSymbol;
  symbolLabel: string;
  networkLabel: string;
  networkType: string;
  decimals: number;
}

export const DEPOSIT_SYMBOLS: Array<{ symbol: DepositSymbol; name: string }> = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "USDT", name: "Tether" }
];

export const SYMBOL_NETWORKS: Record<DepositSymbol, CryptoType[]> = {
  BTC: ["BTC"],
  ETH: ["ETH"],
  SOL: ["SOL"],
  USDT: ["TRC20", "ERC20"]
};

export const DEPOSIT_NETWORK_OPTIONS: Record<CryptoType, DepositNetworkOption> = {
  BTC: {
    cryptoType: "BTC",
    platformAsset: "BTC",
    symbol: "BTC",
    symbolLabel: "BTC",
    networkLabel: "Bitcoin",
    networkType: "BTC",
    decimals: 8
  },
  ETH: {
    cryptoType: "ETH",
    platformAsset: "ETH",
    symbol: "ETH",
    symbolLabel: "ETH",
    networkLabel: "Ethereum",
    networkType: "Ethereum",
    decimals: 8
  },
  SOL: {
    cryptoType: "SOL",
    platformAsset: "SOL",
    symbol: "SOL",
    symbolLabel: "SOL",
    networkLabel: "Solana",
    networkType: "SOL",
    decimals: 8
  },
  ERC20: {
    cryptoType: "ERC20",
    platformAsset: "USDT_ERC20",
    symbol: "USDT",
    symbolLabel: "USDT",
    networkLabel: "Ethereum (ERC20)",
    networkType: "ERC20",
    decimals: 6
  },
  TRC20: {
    cryptoType: "TRC20",
    platformAsset: "USDT_TRC20",
    symbol: "USDT",
    symbolLabel: "USDT",
    networkLabel: "Tron (TRC20)",
    networkType: "TRC20",
    decimals: 6
  }
};

export const REQUIRED_CONFIRMATIONS: Record<CryptoType, number> = {
  BTC: 1,
  ETH: 6,
  SOL: 10,
  ERC20: 6,
  TRC20: 20
};

export function requiredConfirmations(cryptoType: CryptoType): number {
  return REQUIRED_CONFIRMATIONS[cryptoType];
}

/**
 * Platform deposit bounds expressed as USD value. The backend enforces an
 * amount strictly greater than zero and the per-asset decimal precision; these
 * bounds drive the amount quick-select presets and the client-side guard rails
 * surfaced next to the amount field.
 */
export const DEPOSIT_MIN_USD = 100;
export const DEPOSIT_MAX_USD = 100_000;

/** Quick-select deposit amounts (USD value) offered on the amount step. */
export const DEPOSIT_QUICK_SELECT_USD: number[] = [100, 250, 500, 1000];

/** Presets that fall inside the platform minimum/maximum band. */
export function depositQuickSelectUsd(): number[] {
  return DEPOSIT_QUICK_SELECT_USD.filter(
    (value) => value >= DEPOSIT_MIN_USD && value <= DEPOSIT_MAX_USD
  );
}

/**
 * Convert a USD value into the corresponding asset amount using a live price.
 * Returns null when the price is unavailable so callers can disable the preset
 * rather than fabricate a transfer amount.
 */
export function usdToCryptoAmount(
  usd: number,
  usdPrice: number,
  decimals: number
): string | null {
  if (!Number.isFinite(usd) || usd <= 0) {
    return null;
  }
  if (!Number.isFinite(usdPrice) || usdPrice <= 0) {
    return null;
  }
  const raw = usd / usdPrice;
  const factor = Math.pow(10, decimals);
  const floored = Math.floor(raw * factor) / factor;
  if (!Number.isFinite(floored) || floored <= 0) {
    return null;
  }
  return floored.toFixed(decimals).replace(/\.?0+$/, "");
}

export function isCryptoType(value: unknown): value is CryptoType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(DEPOSIT_NETWORK_OPTIONS, value)
  );
}

export function getNetworkOption(cryptoType: CryptoType): DepositNetworkOption {
  return DEPOSIT_NETWORK_OPTIONS[cryptoType];
}

export function symbolForCryptoType(cryptoType: CryptoType): DepositSymbol {
  return DEPOSIT_NETWORK_OPTIONS[cryptoType].symbol;
}

export function defaultCryptoTypeForSymbol(symbol: DepositSymbol): CryptoType {
  return SYMBOL_NETWORKS[symbol][0];
}

export function cryptoTypeFromAssetParam(param: string | null): CryptoType | null {
  if (!param) {
    return null;
  }
  const normalized = param.trim().toUpperCase();
  if (normalized === "USDT") {
    return "ERC20";
  }
  return isCryptoType(normalized) ? normalized : null;
}

export interface DepositStatusView {
  label: string;
  tone: DepositTone;
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

export function depositReference(depositId: string): string {
  const compact = depositId.replace(/-/g, "").toUpperCase();
  return `DEP-${compact.slice(0, 12)}`;
}

export function countDecimalPlaces(value: string): number {
  const separator = value.indexOf(".");
  if (separator === -1) {
    return 0;
  }
  return value.length - separator - 1;
}

export interface AmountValidation {
  valid: boolean;
  empty: boolean;
  message: string | null;
}

export function validateAmountInput(value: string, decimals: number): AmountValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, empty: true, message: null };
  }
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === ".") {
    return { valid: false, empty: false, message: "Enter a valid amount." };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return { valid: false, empty: false, message: "Enter a valid amount." };
  }
  if (parsed <= 0) {
    return { valid: false, empty: false, message: "Enter an amount greater than zero." };
  }
  if (countDecimalPlaces(trimmed) > decimals) {
    return {
      valid: false,
      empty: false,
      message: `This asset supports at most ${decimals} decimal places.`
    };
  }
  return { valid: true, empty: false, message: null };
}

export function validateTxHashInput(value: string): AmountValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, empty: true, message: null };
  }
  if (trimmed.length < 8 || trimmed.length > 200) {
    return {
      valid: false,
      empty: false,
      message: "Enter the full blockchain transaction hash (8–200 characters)."
    };
  }
  return { valid: true, empty: false, message: null };
}
