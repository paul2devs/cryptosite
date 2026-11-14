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
