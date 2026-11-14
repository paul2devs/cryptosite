import { validateAmountInput, type AmountValidation } from "./deposit";

export type { AmountValidation } from "./deposit";

export type WithdrawCryptoType = "BTC" | "ETH" | "SOL" | "ERC20" | "TRC20";

export type WithdrawSymbol = "BTC" | "ETH" | "SOL" | "USDT";

export type WithdrawTone = "neutral" | "positive" | "negative" | "gold";

export interface WithdrawNetworkOption {
  cryptoType: WithdrawCryptoType;
  platformAsset: string;
  symbol: WithdrawSymbol;
  symbolLabel: string;
  networkLabel: string;
  networkType: string;
  decimals: number;
}

export const WITHDRAW_SYMBOLS: Array<{ symbol: WithdrawSymbol; name: string }> = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "USDT", name: "Tether" }
];

export const WITHDRAW_SYMBOL_NETWORKS: Record<WithdrawSymbol, WithdrawCryptoType[]> = {
  BTC: ["BTC"],
  ETH: ["ETH"],
  SOL: ["SOL"],
  USDT: ["TRC20", "ERC20"]
};

export const WITHDRAW_NETWORK_OPTIONS: Record<WithdrawCryptoType, WithdrawNetworkOption> = {
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
    networkType: "ERC20",
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

const ADDRESS_PATTERNS: Record<string, RegExp[]> = {
  BTC: [/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, /^bc1[02-9ac-hj-np-z]{11,71}$/],
  ERC20: [/^0x[a-fA-F0-9]{40}$/],
  SOL: [/^[1-9A-HJ-NP-Za-km-z]{32,44}$/],
  TRC20: [/^T[1-9A-HJ-NP-Za-km-z]{33}$/]
};

export function isWithdrawCryptoType(value: unknown): value is WithdrawCryptoType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(WITHDRAW_NETWORK_OPTIONS, value)
  );
}

export function getWithdrawNetworkOption(cryptoType: WithdrawCryptoType): WithdrawNetworkOption {
  return WITHDRAW_NETWORK_OPTIONS[cryptoType];
}

export function symbolForWithdrawCryptoType(cryptoType: WithdrawCryptoType): WithdrawSymbol {
  return WITHDRAW_NETWORK_OPTIONS[cryptoType].symbol;
}

export function defaultWithdrawCryptoTypeForSymbol(symbol: WithdrawSymbol): WithdrawCryptoType {
  return WITHDRAW_SYMBOL_NETWORKS[symbol][0];
}

export interface AddressValidation {
  valid: boolean;
  empty: boolean;
  message: string | null;
}

export function detectWithdrawNetwork(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  for (const networkType of Object.keys(ADDRESS_PATTERNS)) {
    if (ADDRESS_PATTERNS[networkType].some((pattern) => pattern.test(trimmed))) {
      return networkType;
    }
  }
  return null;
}

export function validateWithdrawAddress(
  cryptoType: WithdrawCryptoType,
  value: string
): AddressValidation {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { valid: false, empty: true, message: null };
  }
  const option = getWithdrawNetworkOption(cryptoType);
  const patterns = ADDRESS_PATTERNS[option.networkType];
  if (!patterns || !patterns.some((pattern) => pattern.test(trimmed))) {
    return {
      valid: false,
      empty: false,
      message: `That is not a valid ${option.networkLabel} address for ${option.symbolLabel}.`
    };
  }
  return { valid: true, empty: false, message: null };
}

export function validateWithdrawAmount(
  value: string,
  decimals: number
): AmountValidation {
  return validateAmountInput(value, decimals);
}

export interface WithdrawFeeEstimate {
  networkFee: number;
  platformFee: number;
  totalFee: number;
  netAmount: number;
}

export function estimateWithdrawFees({
  amount,
  networkFee,
  platformFeePercent
}: {
  amount: number;
  networkFee: number;
  platformFeePercent: number;
}): WithdrawFeeEstimate {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const safeNetworkFee = Number.isFinite(networkFee) && networkFee > 0 ? networkFee : 0;
  const safePercent =
    Number.isFinite(platformFeePercent) && platformFeePercent > 0 ? platformFeePercent : 0;
  const platformFee = (safeAmount * safePercent) / 100;
  const totalFee = safeNetworkFee + platformFee;
  return {
    networkFee: safeNetworkFee,
    platformFee,
    totalFee,
    netAmount: Math.max(0, safeAmount - totalFee)
  };
}

export interface WithdrawalStatusView {
  label: string;
  tone: WithdrawTone;
}

const WITHDRAWAL_STATE_VIEW: Record<string, WithdrawalStatusView> = {
  requested: { label: "Pending", tone: "gold" },
  under_review: { label: "Under review", tone: "gold" },
  approved: { label: "Approved", tone: "positive" },
  processing: { label: "Processing", tone: "gold" },
  broadcast: { label: "Broadcast", tone: "positive" },
  completed: { label: "Completed", tone: "positive" },
  rejected: { label: "Rejected", tone: "negative" },
  failed: { label: "Failed", tone: "negative" },
  cancelled: { label: "Cancelled", tone: "neutral" }
};

export const WITHDRAWAL_LIFECYCLE_ORDER: string[] = [
  "requested",
  "under_review",
  "approved",
  "processing",
  "broadcast",
  "completed",
  "rejected",
  "failed",
  "cancelled"
];

export function resolveWithdrawalLifecycleState(
  status: string,
  detailedStatus: string | null
): string {
  if (detailedStatus && WITHDRAWAL_STATE_VIEW[detailedStatus]) {
    return detailedStatus;
  }
  if (status === "Approved") {
    return "approved";
  }
  if (status === "Rejected") {
    return "rejected";
  }
  return "requested";
}

export function describeWithdrawalLifecycle(
  status: string,
  detailedStatus: string | null
): WithdrawalStatusView {
  return WITHDRAWAL_STATE_VIEW[resolveWithdrawalLifecycleState(status, detailedStatus)];
}

export function withdrawalReference(withdrawalId: string): string {
  const compact = withdrawalId.replace(/-/g, "").toUpperCase();
  return `WD-${compact.slice(0, 12)}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0m";
  }
  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(" ");
}
