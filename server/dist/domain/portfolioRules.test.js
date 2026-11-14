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
