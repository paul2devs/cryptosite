"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPortfolioHoldings = buildPortfolioHoldings;
exports.computeAllocation = computeAllocation;
exports.sumHoldingsValue = sumHoldingsValue;
function safeNumber(value) {
    return Number.isFinite(value) ? value : 0;
}
function buildPortfolioHoldings(assets, prices) {
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
function computeAllocation(holdings) {
    const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
    return holdings.map((holding) => ({
        symbol: holding.symbol,
        value: holding.value,
        percent: total > 0 ? (holding.value / total) * 100 : 0
    }));
}
function sumHoldingsValue(holdings) {
    return holdings.reduce((sum, holding) => sum + holding.value, 0);
}
