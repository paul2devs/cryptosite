import assert from "assert";
import { test } from "node:test";
import { buildPortfolioHoldings, computeAllocation, sumHoldingsValue } from "./portfolioRules";

test("values each holding from its quantity and current price and drops empty positions", () => {
  const holdings = buildPortfolioHoldings(
    [
      { symbol: "BTC", totalDeposited: 0.5, currentValue: 50000 },
      { symbol: "USDT", totalDeposited: 1000, currentValue: 1000 },
      { symbol: "ETH", totalDeposited: 0, currentValue: 0 }
    ],
    { BTC: 100000, USDT: 1 }
  );

  assert.equal(holdings.length, 2);
  assert.equal(holdings[0].symbol, "BTC");
  assert.equal(holdings[0].price, 100000);
  assert.equal(holdings[0].value, 50000);
  assert.equal(holdings[1].symbol, "USDT");
  assert.equal(sumHoldingsValue(holdings), 51000);
});

test("allocates against the full holding total and never divides by zero", () => {
  const holdings = buildPortfolioHoldings(
    [
      { symbol: "BTC", totalDeposited: 1, currentValue: 75000 },
      { symbol: "ETH", totalDeposited: 1, currentValue: 25000 }
    ],
    {}
  );

  const allocation = computeAllocation(holdings);
  assert.equal(allocation[0].symbol, "BTC");
  assert.equal(allocation[0].percent, 75);
  assert.equal(allocation[1].percent, 25);

  const empty = computeAllocation([]);
  assert.deepEqual(empty, []);
  const noTotal = computeAllocation([
    { symbol: "BTC", quantity: 1, price: 0, value: 0, allocationPercent: 0 }
  ]);
  assert.equal(noTotal[0].percent, 0);
});

test("falls back to a derived price when the market quote is missing", () => {
  const holdings = buildPortfolioHoldings(
    [{ symbol: "SOL", totalDeposited: 4, currentValue: 800 }],
    { SOL: Number.NaN }
  );
  assert.equal(holdings[0].price, 200);
  assert.equal(holdings[0].value, 800);
  assert.equal(holdings[0].allocationPercent, 100);
});
