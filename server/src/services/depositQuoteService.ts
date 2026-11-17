import {
  DEPOSIT_DECIMALS_BY_CRYPTO_TYPE,
  DepositCryptoType,
  resolveDepositNetwork
} from "../domain/depositRules";
import {
  DEPOSIT_MAX_USD,
  DEPOSIT_MIN_USD,
  cryptoToUsdAmount,
  usdToCryptoAmount,
  validateUsdAmountInput,
  withinConversionTolerance
} from "../domain/depositQuote";
import {
  MarketDataSource,
  SupportedSymbol,
  classifyPriceFreshness,
  getAllMarketPrices
} from "./marketDataService";

/** Maps a deposit crypto type to the symbol the pricing service quotes in USD. */
const SYMBOL_BY_CRYPTO_TYPE: Record<DepositCryptoType, SupportedSymbol> = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  ERC20: "USDT",
  TRC20: "USDT"
};

const DISPLAY_SYMBOL_BY_CRYPTO_TYPE: Record<DepositCryptoType, string> = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  ERC20: "USDT",
  TRC20: "USDT"
};

const SOURCE_LABELS: Record<MarketDataSource, string> = {
  coingecko: "CoinGecko",
  kraken: "Kraken",
  coinbase: "Coinbase",
  binance: "Binance"
};

const RATE_UNAVAILABLE_REASON =
  "Current conversion pricing is temporarily unavailable. Please try again shortly.";

const RATE_STALE_REASON =
  "The last exchange rate we received is out of date, so it cannot be used for a conversion. Refresh the rate and try again.";

export const DEPOSIT_FEE_NOTE =
  "The platform does not charge a deposit fee. Network fees are set by the blockchain and are not collected by the platform.";

const NETWORK_FEE_NOTE =
  "Network fees are set by the blockchain and paid to miners or validators. They are not collected by the platform and cannot be estimated here.";

function trimTrailingZeros(value: string): string {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value;
}

function formatCryptoLabel(amount: number, decimals: number, symbol: string): string {
  return `${trimTrailingZeros(amount.toFixed(decimals))} ${symbol}`;
}

export interface DepositQuote {
  available: boolean;
  reason: string | null;
  cryptoType: DepositCryptoType;
  symbol: string;
  network: string;
  decimals: number;
  usdAmount: number | null;
  cryptoAmount: number | null;
  cryptoAmountLabel: string | null;
  rate: number | null;
  rateSource: string | null;
  rateUpdatedAt: string | null;
  stale: boolean;
  /** True when the shown rate is served from cache rather than fetched live. */
  cached: boolean;
  minUsd: number;
  maxUsd: number;
  feeUsd: number;
  feeNote: string;
  networkFeeNote: string;
  estimatedReceivedLabel: string | null;
}

/**
 * Build a USD→crypto quote for a deposit. The rate always comes from the
 * configured pricing service; nothing is hardcoded.
 */
export async function buildDepositQuote(input: {
  cryptoType: DepositCryptoType;
  usdAmount?: number | null;
}): Promise<DepositQuote> {
  const { cryptoType } = input;
  const decimals = DEPOSIT_DECIMALS_BY_CRYPTO_TYPE[cryptoType];
  const symbol = DISPLAY_SYMBOL_BY_CRYPTO_TYPE[cryptoType];
  const network = resolveDepositNetwork(cryptoType);

  const base: DepositQuote = {
    available: false,
    reason: null,
    cryptoType,
    symbol,
    network,
    decimals,
    usdAmount: null,
    cryptoAmount: null,
    cryptoAmountLabel: null,
    rate: null,
    rateSource: null,
    rateUpdatedAt: null,
    stale: false,
    cached: false,
    minUsd: DEPOSIT_MIN_USD,
    maxUsd: DEPOSIT_MAX_USD,
    feeUsd: 0,
    feeNote: DEPOSIT_FEE_NOTE,
    networkFeeNote: NETWORK_FEE_NOTE,
    estimatedReceivedLabel: null
  };

  const prices = await getAllMarketPrices();
  const point = prices[SYMBOL_BY_CRYPTO_TYPE[cryptoType]];

  if (!point || !Number.isFinite(point.price) || point.price <= 0) {
    return { ...base, reason: RATE_UNAVAILABLE_REASON };
  }

  const updatedAt = point.lastUpdated ? new Date(point.lastUpdated) : null;
  const updatedAtValid = updatedAt !== null && Number.isFinite(updatedAt.getTime());
  const ageMs = updatedAtValid ? Date.now() - updatedAt!.getTime() : null;
  const freshness = updatedAtValid ? classifyPriceFreshness(ageMs) : "stale";

  const rateMeta = {
    rate: point.price,
    rateSource: point.source ? SOURCE_LABELS[point.source] : "Configured pricing service",
    rateUpdatedAt: updatedAtValid ? updatedAt!.toISOString() : null
  };

  // A rate past the staleness threshold is disclosed with its timestamp so the
  // user knows how old it is, but it is never used to price a fresh conversion:
  // the amount stays unavailable until the rate is refreshed.
  if (freshness === "stale") {
    return { ...base, ...rateMeta, stale: true, reason: RATE_STALE_REASON };
  }

  // Inside the staleness window but past the live window: still usable, and
  // flagged so the UI can disclose that a cached rate is being shown rather than
  // presenting it as live.
  const quote: DepositQuote = {
    ...base,
    ...rateMeta,
    available: true,
    stale: false,
    cached: freshness === "cached"
  };

  const usdAmount =
    typeof input.usdAmount === "number" && Number.isFinite(input.usdAmount) && input.usdAmount > 0
      ? input.usdAmount
      : null;

  if (usdAmount !== null) {
    const cryptoAmount = usdToCryptoAmount(usdAmount, point.price, decimals);
    quote.usdAmount = usdAmount;
    quote.cryptoAmount = cryptoAmount;
    if (cryptoAmount !== null) {
      const formatted = formatCryptoLabel(cryptoAmount, decimals, symbol);
      quote.cryptoAmountLabel = formatted;
      // No platform fee is deducted, so the amount to send equals the amount received.
      quote.estimatedReceivedLabel = formatted;
    }
  }

  return quote;
}

export interface DepositConversionValidation {
  valid: boolean;
  errors: string[];
  quote: DepositQuote | null;
}

/**
 * Server-side validation of a USD-denominated deposit. The submitted crypto
 * amount must match the amount the backend derives from the current verified
 * rate, and the USD value must sit inside the platform min/max band.
 */
export async function validateDepositConversion(input: {
  cryptoType: DepositCryptoType;
  cryptoAmount: number;
  usdAmount?: number | null;
}): Promise<DepositConversionValidation> {
  const quote = await buildDepositQuote({ cryptoType: input.cryptoType });
  const errors: string[] = [];

  if (!quote.available || quote.rate === null) {
    return {
      valid: false,
      errors: [quote.reason || RATE_UNAVAILABLE_REASON],
      quote
    };
  }

  const providedUsd =
    typeof input.usdAmount === "number" && Number.isFinite(input.usdAmount) && input.usdAmount > 0
      ? input.usdAmount
      : null;
  const derivedUsd = cryptoToUsdAmount(input.cryptoAmount, quote.rate);
  const usdValue = providedUsd ?? derivedUsd;

  if (usdValue === null) {
    return {
      valid: false,
      errors: ["Enter a valid deposit amount."],
      quote
    };
  }

  const usdValidation = validateUsdAmountInput(String(usdValue));
  if (!usdValidation.valid && usdValidation.message) {
    errors.push(usdValidation.message);
  }

  const expectedCrypto = usdToCryptoAmount(usdValue, quote.rate, quote.decimals);
  if (expectedCrypto === null) {
    errors.push("The deposit amount is too small to convert to the selected asset.");
  } else if (!withinConversionTolerance(input.cryptoAmount, expectedCrypto)) {
    errors.push(
      "The submitted amount no longer matches the current exchange rate. Refresh the rate and try again."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    quote
  };
}
