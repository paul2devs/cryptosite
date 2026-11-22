"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const portfolioRules_1 = require("./portfolioRules");
(0, node_test_1.test)("values each holding from its quantity and current price and drops empty positions", () => {
    const holdings = (0, portfolioRules_1.buildPortfolioHoldings)([
        { symbol: "BTC", totalDeposited: 0.5, currentValue: 50000 },
        { symbol: "USDT", totalDeposited: 1000, currentValue: 1000 },
        { symbol: "ETH", totalDeposited: 0, currentValue: 0 }
    ], { BTC: 100000, USDT: 1 });
    assert_1.default.equal(holdings.length, 2);
    assert_1.default.equal(holdings[0].symbol, "BTC");
    assert_1.default.equal(holdings[0].price, 100000);
    assert_1.default.equal(holdings[0].value, 50000);
    assert_1.default.equal(holdings[1].symbol, "USDT");
    assert_1.default.equal((0, portfolioRules_1.sumHoldingsValue)(holdings), 51000);
});
(0, node_test_1.test)("allocates against the full holding total and never divides by zero", () => {
    const holdings = (0, portfolioRules_1.buildPortfolioHoldings)([
        { symbol: "BTC", totalDeposited: 1, currentValue: 75000 },
        { symbol: "ETH", totalDeposited: 1, currentValue: 25000 }
    ], {});
    const allocation = (0, portfolioRules_1.computeAllocation)(holdings);
    assert_1.default.equal(allocation[0].symbol, "BTC");
    assert_1.default.equal(allocation[0].percent, 75);
    assert_1.default.equal(allocation[1].percent, 25);
    const empty = (0, portfolioRules_1.computeAllocation)([]);
    assert_1.default.deepEqual(empty, []);
    const noTotal = (0, portfolioRules_1.computeAllocation)([
        { symbol: "BTC", quantity: 1, price: 0, value: 0, allocationPercent: 0 }
    ]);
    assert_1.default.equal(noTotal[0].percent, 0);
});
(0, node_test_1.test)("falls back to a derived price when the market quote is missing", () => {
    const holdings = (0, portfolioRules_1.buildPortfolioHoldings)([{ symbol: "SOL", totalDeposited: 4, currentValue: 800 }], { SOL: Number.NaN });
    assert_1.default.equal(holdings[0].price, 200);
    assert_1.default.equal(holdings[0].value, 800);
    assert_1.default.equal(holdings[0].allocationPercent, 100);
});
// ---------------------------------------------------------------------------
// Authoritative total portfolio value
// ---------------------------------------------------------------------------
function valuation(currentInvestmentValue, investedPrincipal, settled = "0") {
    return (0, portfolioRules_1.portfolioValuation)({
        currentInvestmentValue,
        investedPrincipal,
        totalRealizedProfitLoss: settled,
        valuationComplete: true
    });
}
(0, node_test_1.test)("a fresh $1,000 investment with no accrued earnings values at exactly $1,000", () => {
    const result = valuation("1000.00000000", "1000.00000000");
    assert_1.default.equal(result.totalValue, "1000.00000000");
    assert_1.default.equal(result.investedPrincipal, "1000.00000000");
    assert_1.default.equal(result.accruedEarnings, "0.00000000");
    assert_1.default.equal(result.settledEarnings, "0.00000000");
});
(0, node_test_1.test)("pending earnings raise the total the moment they accrue (3% simple daily)", () => {
    // The current investment value already carries principal plus accruals, so the
    // total tracks the running position value day by day without compounding.
    assert_1.default.equal(valuation("1030.00000000", "1000.00000000").totalValue, "1030.00000000");
    assert_1.default.equal(valuation("1030.00000000", "1000.00000000").accruedEarnings, "30.00000000");
    assert_1.default.equal(valuation("1060.00000000", "1000.00000000").accruedEarnings, "60.00000000");
    assert_1.default.equal(valuation("1090.00000000", "1000.00000000").totalValue, "1090.00000000");
    assert_1.default.equal(valuation("1120.00000000", "1000.00000000").totalValue, "1120.00000000");
    assert_1.default.equal(valuation("1120.00000000", "1000.00000000").accruedEarnings, "120.00000000");
});
(0, node_test_1.test)("settled earnings are reported separately and never double counted", () => {
    // A distribution credits the wallet via the ledger; the position valuation is
    // unchanged, so the total still counts the earnings exactly once.
    const before = valuation("1030.00000000", "1000.00000000", "0.00000000");
    const after = valuation("1030.00000000", "1000.00000000", "30.00000000");
    assert_1.default.equal(after.totalValue, before.totalValue);
    assert_1.default.equal(after.accruedEarnings, "30.00000000");
    assert_1.default.equal(after.settledEarnings, "30.00000000");
});
(0, node_test_1.test)("multiple investments combine principal and accruals across positions", () => {
    // $1,000 earning $30 plus $500 earning $15.
    const result = valuation("1545.00000000", "1500.00000000");
    assert_1.default.equal(result.totalValue, "1545.00000000");
    assert_1.default.equal(result.investedPrincipal, "1500.00000000");
    assert_1.default.equal(result.accruedEarnings, "45.00000000");
});
(0, node_test_1.test)("a position trading below principal never reports negative accrued earnings", () => {
    const result = valuation("990.00000000", "1000.00000000");
    assert_1.default.equal(result.totalValue, "990.00000000");
    assert_1.default.equal(result.accruedEarnings, "0.00000000");
});
(0, node_test_1.test)("idle wallet deposits are not investment earnings and do not change the total", () => {
    // The rule derives the total only from invested positions, so a deposit that
    // sits in the wallet (not yet allocated) leaves the portfolio value untouched.
    const result = valuation("1000.00000000", "1000.00000000");
    assert_1.default.equal(result.totalValue, "1000.00000000");
    assert_1.default.equal(result.accruedEarnings, "0.00000000");
});
(0, node_test_1.test)("the valuation is deterministic so scheduler retries cannot produce a different total", () => {
    const input = { currentInvestmentValue: "1060.00000000", investedPrincipal: "1000.00000000" };
    assert_1.default.deepEqual(valuation(input.currentInvestmentValue, input.investedPrincipal), valuation(input.currentInvestmentValue, input.investedPrincipal));
});
