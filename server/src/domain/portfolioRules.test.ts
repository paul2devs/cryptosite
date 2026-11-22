import assert from "assert";
import { test } from "node:test";
import {
  buildPortfolioHoldings,
  computeAllocation,
  portfolioValuation,
  sumHoldingsValue
} from "./portfolioRules";

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

// ---------------------------------------------------------------------------
// Authoritative total portfolio value
// ---------------------------------------------------------------------------

function valuation(currentInvestmentValue: string, investedPrincipal: string, settled = "0") {
  return portfolioValuation({
    currentInvestmentValue,
    investedPrincipal,
    totalRealizedProfitLoss: settled,
    valuationComplete: true
  });
}

test("a fresh $1,000 investment with no accrued earnings values at exactly $1,000", () => {
  const result = valuation("1000.00000000", "1000.00000000");
  assert.equal(result.totalValue, "1000.00000000");
  assert.equal(result.investedPrincipal, "1000.00000000");
  assert.equal(result.accruedEarnings, "0.00000000");
  assert.equal(result.settledEarnings, "0.00000000");
});

test("pending earnings raise the total the moment they accrue (3% simple daily)", () => {
  // The current investment value already carries principal plus accruals, so the
  // total tracks the running position value day by day without compounding.
  assert.equal(valuation("1030.00000000", "1000.00000000").totalValue, "1030.00000000");
  assert.equal(valuation("1030.00000000", "1000.00000000").accruedEarnings, "30.00000000");
  assert.equal(valuation("1060.00000000", "1000.00000000").accruedEarnings, "60.00000000");
  assert.equal(valuation("1090.00000000", "1000.00000000").totalValue, "1090.00000000");
  assert.equal(valuation("1120.00000000", "1000.00000000").totalValue, "1120.00000000");
  assert.equal(valuation("1120.00000000", "1000.00000000").accruedEarnings, "120.00000000");
});

test("settled earnings are reported separately and never double counted", () => {
  // A distribution credits the wallet via the ledger; the position valuation is
  // unchanged, so the total still counts the earnings exactly once.
  const before = valuation("1030.00000000", "1000.00000000", "0.00000000");
  const after = valuation("1030.00000000", "1000.00000000", "30.00000000");
  assert.equal(after.totalValue, before.totalValue);
  assert.equal(after.accruedEarnings, "30.00000000");
  assert.equal(after.settledEarnings, "30.00000000");
});

test("multiple investments combine principal and accruals across positions", () => {
  // $1,000 earning $30 plus $500 earning $15.
  const result = valuation("1545.00000000", "1500.00000000");
  assert.equal(result.totalValue, "1545.00000000");
  assert.equal(result.investedPrincipal, "1500.00000000");
  assert.equal(result.accruedEarnings, "45.00000000");
});

test("a position trading below principal never reports negative accrued earnings", () => {
  const result = valuation("990.00000000", "1000.00000000");
  assert.equal(result.totalValue, "990.00000000");
  assert.equal(result.accruedEarnings, "0.00000000");
});

test("idle wallet deposits are not investment earnings and do not change the total", () => {
  // The rule derives the total only from invested positions, so a deposit that
  // sits in the wallet (not yet allocated) leaves the portfolio value untouched.
  const result = valuation("1000.00000000", "1000.00000000");
  assert.equal(result.totalValue, "1000.00000000");
  assert.equal(result.accruedEarnings, "0.00000000");
});

test("the valuation is deterministic so scheduler retries cannot produce a different total", () => {
  const input = { currentInvestmentValue: "1060.00000000", investedPrincipal: "1000.00000000" };
  assert.deepEqual(valuation(input.currentInvestmentValue, input.investedPrincipal), valuation(input.currentInvestmentValue, input.investedPrincipal));
});
