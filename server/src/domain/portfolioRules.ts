import { formatDecimal, parseDecimal } from "./money";

export interface PortfolioAssetInput {
  symbol: string;
  totalDeposited: number;
  currentValue: number;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  allocationPercent: number;
}

export interface PortfolioAllocationSlice {
  symbol: string;
  value: number;
  percent: number;
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function buildPortfolioHoldings(
  assets: PortfolioAssetInput[],
  prices: Record<string, number | undefined>
): PortfolioHolding[] {
  const total = assets.reduce((sum, asset) => sum + safeNumber(asset.currentValue), 0);
  return assets
    .filter((asset) => safeNumber(asset.totalDeposited) > 0)
    .map((asset) => {
      const quantity = safeNumber(asset.totalDeposited);
      const value = safeNumber(asset.currentValue);
      const marketPrice = prices[asset.symbol];
      const price = Number.isFinite(marketPrice)
        ? Number(marketPrice)
        : quantity > 0
          ? value / quantity
          : 0;
      const allocationPercent = total > 0 ? (value / total) * 100 : 0;
      return { symbol: asset.symbol, quantity, price, value, allocationPercent };
    })
    .sort((left, right) => right.value - left.value);
}

export function computeAllocation(holdings: PortfolioHolding[]): PortfolioAllocationSlice[] {
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
  return holdings.map((holding) => ({
    symbol: holding.symbol,
    value: holding.value,
    percent: total > 0 ? (holding.value / total) * 100 : 0
  }));
}

export function sumHoldingsValue(holdings: PortfolioHolding[]): number {
  return holdings.reduce((sum, holding) => sum + holding.value, 0);
}

const VALUATION_SCALE = 8;

/**
 * The single authoritative portfolio valuation.
 *
 * Total portfolio value is the principal allocated to active investment
 * positions plus the earnings those positions have accrued. It is derived only
 * from verified position valuations, never from live market prices, so a
 * fixed-principal investment is never re-valued by BTC/ETH price swings.
 *
 * Because accruals are written straight onto the position valuation,
 * `currentInvestmentValue` already carries principal plus accrued earnings, so
 * the unsettled (pending) portion is simply the difference from principal and is
 * included in the total the moment it accrues. Settled (distributed) earnings
 * are reported separately and are never added on top, which keeps them counted
 * exactly once.
 */
export interface PortfolioValuation {
  currency: "USD";
  totalValue: string;
  investedPrincipal: string;
  accruedEarnings: string;
  settledEarnings: string;
  valuationComplete: boolean;
}

export function portfolioValuation(input: {
  currentInvestmentValue: string;
  investedPrincipal: string;
  totalRealizedProfitLoss: string;
  valuationComplete: boolean;
}): PortfolioValuation {
  const total = parseDecimal(input.currentInvestmentValue, VALUATION_SCALE);
  const principal = parseDecimal(input.investedPrincipal, VALUATION_SCALE);
  const accrued = total - principal;
  return {
    currency: "USD",
    totalValue: formatDecimal(total, VALUATION_SCALE),
    investedPrincipal: formatDecimal(principal, VALUATION_SCALE),
    accruedEarnings: formatDecimal(accrued > 0n ? accrued : 0n, VALUATION_SCALE),
    settledEarnings: formatDecimal(parseDecimal(input.totalRealizedProfitLoss, VALUATION_SCALE), VALUATION_SCALE),
    valuationComplete: input.valuationComplete
  };
}
