import { formatDecimal, multiplyDecimal, parseDecimal } from "./money";

export const USD_SCALE = 8;

/**
 * Crypto types that the platform treats as dollar-pegged. A stablecoin deposit is
 * valued at par: the quantity received is the USD amount, with no market
 * conversion applied. This is what makes "100 USDT deposited = 100 USDT credited".
 */
export const DEPOSIT_STABLECOIN_TYPES = [
  "ERC20",
  "TRC20",
  "USDT",
  "USDT_ERC20",
  "USDT_TRC20"
] as const;

export type DepositAssetSymbol = "BTC" | "ETH" | "SOL" | "USDT";

export type UsdValuationBasis = "stablecoin_par" | "market_price" | "unavailable";

/** Map a stored crypto type onto the market-data symbol used for pricing. */
export function depositAssetSymbol(cryptoType: string): DepositAssetSymbol | null {
  if (cryptoType === "BTC" || cryptoType === "ETH" || cryptoType === "SOL") {
    return cryptoType;
  }
  if ((DEPOSIT_STABLECOIN_TYPES as readonly string[]).includes(cryptoType)) {
    return "USDT";
  }
  return null;
}

export function isStablecoinDeposit(cryptoType: string): boolean {
  return (DEPOSIT_STABLECOIN_TYPES as readonly string[]).includes(cryptoType);
}

export interface DepositUsdValuation {
  /** USD value of the received quantity, or null when it cannot be valued. */
  usd: string | null;
  basis: UsdValuationBasis;
  /** The unit price used, when a market price was applied. */
  price: string | null;
}

function normaliseQuantity(quantity: string | number): string | null {
  try {
    const fixed = typeof quantity === "number" ? quantity.toFixed(USD_SCALE) : String(quantity);
    return formatDecimal(parseDecimal(fixed, USD_SCALE), USD_SCALE);
  } catch {
    return null;
  }
}

/**
 * Value a received quantity in USD under the platform's accounting policy.
 *
 * - Stablecoins are valued at par (1 unit = 1 USD) with no market conversion.
 * - Volatile assets keep their received quantity and are valued with a market
 *   price when one is available; the quantity is never replaced.
 * - When no price is available the USD value is `unavailable` (null) rather than
 *   zero, so the original quantity is preserved and approval is never blocked.
 */
export function valueDepositInUsd(input: {
  cryptoType: string;
  quantity: string | number;
  price?: number | null;
}): DepositUsdValuation {
  const quantity = normaliseQuantity(input.quantity);
  if (quantity === null) {
    return { usd: null, basis: "unavailable", price: null };
  }
  if (isStablecoinDeposit(input.cryptoType)) {
    return { usd: quantity, basis: "stablecoin_par", price: null };
  }
  const price = input.price;
  if (typeof price === "number" && Number.isFinite(price) && price > 0) {
    const usdUnits = multiplyDecimal(quantity, price.toFixed(USD_SCALE), USD_SCALE, USD_SCALE, USD_SCALE);
    return { usd: formatDecimal(usdUnits, USD_SCALE), basis: "market_price", price: price.toFixed(USD_SCALE) };
  }
  return { usd: null, basis: "unavailable", price: null };
}

/**
 * The stored USD-per-asset-unit ratio implied by a confirmed deposit's USD value.
 *
 * Uses the USD value recorded when the deposit was approved (never a live price),
 * so a fixed-principal investment is not re-valued by later market swings. The
 * ratio is expressed in the same 10^8 scale as `usdRatioUnits`, so an asset-unit
 * amount can be turned into USD with `applyUsdRatio`.
 *
 * Returns `null` when the USD value or quantity is missing or non-positive; the
 * caller then reports the position as unvalued rather than inventing a number.
 */
export function usdPerAssetUnitUnits(
  quantity: string | number,
  usdValue: string | number
): bigint | null {
  const normalised = normaliseQuantity(quantity);
  if (normalised === null) return null;
  const quantityUnits = parseDecimal(normalised, USD_SCALE);
  if (quantityUnits <= 0n) return null;
  let usdUnits: bigint;
  try {
    usdUnits = parseDecimal(
      typeof usdValue === "number" ? usdValue.toFixed(USD_SCALE) : String(usdValue),
      USD_SCALE
    );
  } catch {
    return null;
  }
  if (usdUnits <= 0n) return null;
  const numerator = usdUnits * 10n ** BigInt(USD_SCALE);
  const half = quantityUnits / 2n;
  return (numerator + half) / quantityUnits;
}

/**
 * USD value of one whole asset unit, scaled by 10^8. Stablecoins are exactly
 * 1:1; volatile assets use the supplied market price; when no price is known the
 * ratio is reported as unavailable with a neutral 1:1 fallback so downstream
 * arithmetic stays deterministic while the caller flags the gap.
 */
export function usdRatioUnits(
  cryptoType: string,
  price?: number | null
): { ratioUnits: bigint; basis: UsdValuationBasis } {
  if (isStablecoinDeposit(cryptoType)) {
    return { ratioUnits: 10n ** BigInt(USD_SCALE), basis: "stablecoin_par" };
  }
  if (typeof price === "number" && Number.isFinite(price) && price > 0) {
    return { ratioUnits: parseDecimal(price.toFixed(USD_SCALE), USD_SCALE), basis: "market_price" };
  }
  return { ratioUnits: 10n ** BigInt(USD_SCALE), basis: "unavailable" };
}

/** Convert an asset-unit amount into its USD equivalent, half-up rounded. */
export function applyUsdRatio(assetUnits: bigint, ratioUnits: bigint): bigint {
  const product = assetUnits * ratioUnits;
  const divisor = 10n ** BigInt(USD_SCALE);
  const half = divisor / 2n;
  const negative = product < 0n;
  const absolute = negative ? -product : product;
  const rounded = (absolute + half) / divisor;
  return negative ? -rounded : rounded;
}
