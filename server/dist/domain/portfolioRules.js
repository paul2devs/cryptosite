"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPortfolioHoldings = buildPortfolioHoldings;
exports.computeAllocation = computeAllocation;
exports.sumHoldingsValue = sumHoldingsValue;
exports.portfolioValuation = portfolioValuation;
const money_1 = require("./money");
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
const VALUATION_SCALE = 8;
function portfolioValuation(input) {
    const total = (0, money_1.parseDecimal)(input.currentInvestmentValue, VALUATION_SCALE);
    const principal = (0, money_1.parseDecimal)(input.investedPrincipal, VALUATION_SCALE);
    const accrued = total - principal;
    const accruedEarnings = accrued > 0n ? accrued : 0n;
    const settled = (0, money_1.parseDecimal)(input.totalRealizedProfitLoss, VALUATION_SCALE);
    const pending = accruedEarnings - settled;
    return {
        currency: "USD",
        totalValue: (0, money_1.formatDecimal)(total, VALUATION_SCALE),
        investedPrincipal: (0, money_1.formatDecimal)(principal, VALUATION_SCALE),
        accruedEarnings: (0, money_1.formatDecimal)(accruedEarnings, VALUATION_SCALE),
        settledEarnings: (0, money_1.formatDecimal)(settled, VALUATION_SCALE),
        pendingEarnings: (0, money_1.formatDecimal)(pending > 0n ? pending : 0n, VALUATION_SCALE),
        valuationComplete: input.valuationComplete
    };
}
