import {
  DEPOSIT_DECIMALS_BY_CRYPTO_TYPE,
  DepositCryptoType,
  DepositPlatformAsset,
  resolvePlatformAsset
} from "./depositRules";

/**
 * Per asset/network capability descriptor.
 *
 * This is the single source of truth for what a given network can and cannot do.
 * The deposit experience is data-driven from it: whether a memo/destination tag
 * is shown, how many confirmations are required, and which network warning the
 * user sees all come from here rather than from hardcoded per-asset branches.
 *
 * `memo.supported` is the critical field. It is `false` for every network the
 * platform currently accepts, because none of Bitcoin, Ethereum, Solana or Tron
 * carries a native memo / destination tag on an address-based transfer. The
 * platform self-custodies receiving addresses and has no payment provider that
 * assigns a per-deposit identifier, so inventing a memo would be misleading: the
 * blockchain would not transmit it and the deposit would never match.
 *
 * Networks that genuinely support one (XRP destination tags, Stellar memos,
 * Cosmos memos, TON comments) can be added here by declaring `supported: true`
 * with a label and a validation pattern; the persistence, display and matching
 * code paths already consume this field.
 */
export interface DepositMemoCapability {
  supported: boolean;
  required: boolean;
  label: string | null;
  /** Validation pattern for a user-supplied memo, when memo is supported. */
  pattern: RegExp | null;
  guidance: string | null;
}

export interface DepositNetworkCapability {
  cryptoType: DepositCryptoType;
  platformAsset: DepositPlatformAsset;
  symbol: string;
  networkLabel: string;
  networkType: string;
  decimals: number;
  minConfirmations: number;
  memo: DepositMemoCapability;
  /** Asset/network specific instructions shown on the payment screen. */
  sendingInstruction: string;
  /** The wrong-network warning shown beside the receiving address. */
  networkWarning: string;
}

const MEMO_UNSUPPORTED: DepositMemoCapability = {
  supported: false,
  required: false,
  label: null,
  pattern: null,
  guidance: null
};

const MEMO_GUIDANCE =
  "Include the exact memo or destination tag when sending. Missing or incorrect identifiers may prevent automatic deposit matching.";

function confirmationsFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || String(raw).trim().length === 0) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

const BASE_CAPABILITIES: Record<
  DepositCryptoType,
  {
    symbol: string;
    networkLabel: string;
    networkType: string;
    confirmationsEnv: string;
    confirmationsDefault: number;
    sendingInstruction: string;
    networkWarning: string;
    memo: DepositMemoCapability;
  }
> = {
  BTC: {
    symbol: "BTC",
    networkLabel: "Bitcoin",
    networkType: "Bitcoin",
    confirmationsEnv: "BTC_MIN_CONFIRMATIONS",
    confirmationsDefault: 1,
    sendingInstruction:
      "Send your BTC to the receiving address shown above. Make sure you select the Bitcoin network.",
    networkWarning:
      "Send BTC on the Bitcoin network only. Bitcoin sent on any other network cannot be recovered.",
    memo: MEMO_UNSUPPORTED
  },
  ETH: {
    symbol: "ETH",
    networkLabel: "Ethereum",
    networkType: "Ethereum",
    confirmationsEnv: "ETH_MIN_CONFIRMATIONS",
    confirmationsDefault: 6,
    sendingInstruction:
      "Send your ETH to the receiving address shown above. Make sure you select the Ethereum (ERC20) network.",
    networkWarning:
      "Send ETH on the Ethereum network only. ETH sent on any other network cannot be recovered. Do not send USDT to this address.",
    memo: MEMO_UNSUPPORTED
  },
  SOL: {
    symbol: "SOL",
    networkLabel: "Solana",
    networkType: "SOL",
    confirmationsEnv: "SOL_MIN_CONFIRMATIONS",
    confirmationsDefault: 10,
    sendingInstruction:
      "Send your SOL to the receiving address shown above. Make sure you select the Solana network.",
    networkWarning:
      "Send SOL on the Solana network only. SOL sent on any other network cannot be recovered. Do not send SPL tokens to this address.",
    memo: MEMO_UNSUPPORTED
  },
  ERC20: {
    symbol: "USDT",
    networkLabel: "Ethereum (ERC20)",
    networkType: "ERC20",
    confirmationsEnv: "ERC20_MIN_CONFIRMATIONS",
    confirmationsDefault: 6,
    sendingInstruction:
      "Send your USDT to the receiving address shown above. Make sure you select the Ethereum (ERC20) network.",
    networkWarning:
      "Send USDT on the Ethereum (ERC20) network only. USDT sent on any other network cannot be recovered. Do not send ETH to this address.",
    memo: MEMO_UNSUPPORTED
  },
  TRC20: {
    symbol: "USDT",
    networkLabel: "Tron (TRC20)",
    networkType: "TRC20",
    confirmationsEnv: "TRC20_MIN_CONFIRMATIONS",
    confirmationsDefault: 20,
    sendingInstruction:
      "Send your USDT to the receiving address shown above. Make sure you select the Tron (TRC20) network.",
    networkWarning:
      "Send USDT on the Tron (TRC20) network only. USDT sent on any other network cannot be recovered. Do not send TRX to this address.",
    memo: MEMO_UNSUPPORTED
  }
};

export function resolveDepositCapability(
  cryptoType: DepositCryptoType
): DepositNetworkCapability {
  const base = BASE_CAPABILITIES[cryptoType];
  if (!base) {
    throw new Error(`Unsupported deposit crypto type: ${cryptoType}`);
  }
  return {
    cryptoType,
    platformAsset: resolvePlatformAsset(cryptoType),
    symbol: base.symbol,
    networkLabel: base.networkLabel,
    networkType: base.networkType,
    decimals: DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType],
    minConfirmations: confirmationsFromEnv(base.confirmationsEnv, base.confirmationsDefault),
    memo: { ...base.memo },
    sendingInstruction: base.sendingInstruction,
    networkWarning: base.networkWarning
  };
}

export function listDepositCapabilities(): DepositNetworkCapability[] {
  return (Object.keys(BASE_CAPABILITIES) as DepositCryptoType[]).map((cryptoType) =>
    resolveDepositCapability(cryptoType)
  );
}

export interface MemoValidation {
  valid: boolean;
  /** Null when the network does not support a memo, so nothing is stored. */
  memo: string | null;
  error: string | null;
}

/**
 * Validate an optional user-supplied memo against the network capability. When
 * the network has no memo concept the value is discarded rather than stored, so
 * the platform never pretends a memo will be transmitted on a network that
 * cannot carry one.
 */
export function validateDepositMemo(
  capability: DepositNetworkCapability,
  rawMemo: unknown
): MemoValidation {
  const trimmed = typeof rawMemo === "string" ? rawMemo.trim() : "";

  if (!capability.memo.supported) {
    return { valid: true, memo: null, error: null };
  }

  if (trimmed.length === 0) {
    if (capability.memo.required) {
      return {
        valid: false,
        memo: null,
        error: `${capability.memo.label || "Memo"} is required for ${capability.networkLabel} deposits.`
      };
    }
    return { valid: true, memo: null, error: null };
  }

  if (capability.memo.pattern && !capability.memo.pattern.test(trimmed)) {
    return {
      valid: false,
      memo: null,
      error: `Enter a valid ${capability.memo.label || "memo"} for ${capability.networkLabel}.`
    };
  }

  return { valid: true, memo: trimmed, error: null };
}

export const DEPOSIT_MEMO_GUIDANCE = MEMO_GUIDANCE;

/**
 * The network that would carry a memo for each supported asset, if any. Used by
 * the completion report / diagnostics endpoint so operators can see at a glance
 * which assets require an identifier.
 */
export function memoSupportSummary(): Array<{
  cryptoType: DepositCryptoType;
  networkLabel: string;
  memoSupported: boolean;
  memoRequired: boolean;
  memoLabel: string | null;
}> {
  return listDepositCapabilities().map((capability) => ({
    cryptoType: capability.cryptoType,
    networkLabel: capability.networkLabel,
    memoSupported: capability.memo.supported,
    memoRequired: capability.memo.required,
    memoLabel: capability.memo.label
  }));
}

export function resolveDepositNetworkLabel(cryptoType: DepositCryptoType): string {
  return BASE_CAPABILITIES[cryptoType].networkLabel;
}
