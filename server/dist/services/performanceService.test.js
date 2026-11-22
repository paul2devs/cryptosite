"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
/**
 * Service level coverage for the authoritative portfolio valuation.
 *
 * The reported defect was a unit error: an investment position funded by a
 * volatile-asset deposit stores its principal and valuation in the deposited
 * asset's units (e.g. BTC), but the portfolio totals summed them as if they were
 * already dollars. A 100 USD deposit of 0.00158664 BTC therefore reported a total
 * of "0.00168184", which the dashboard formatted as $0.00.
 *
 * The performance reader is the single producer of these figures, so the models
 * it reads are replaced with small fakes and the assertions check that every
 * position amount is re-expressed in USD using the ratio recorded on its own
 * deposit, never a live market price.
 */
let service;
let InvestmentPosition;
let DailyPerformanceSnapshot;
let LedgerAccount;
let LedgerEntry;
let Deposit;
(0, node_test_1.before)(() => {
    service = require("./performanceService");
    InvestmentPosition = require("../models/InvestmentPosition").InvestmentPosition;
    DailyPerformanceSnapshot = require("../models/DailyPerformanceSnapshot").DailyPerformanceSnapshot;
    LedgerAccount = require("../models/LedgerAccount").LedgerAccount;
    LedgerEntry = require("../models/LedgerEntry").LedgerEntry;
    Deposit = require("../models/Deposit").Deposit;
});
const restorers = [];
function stub(target, key, impl) {
    const original = target[key];
    target[key] = impl;
    restorers.push(() => {
        target[key] = original;
    });
}
(0, node_test_1.afterEach)(() => {
    while (restorers.length > 0)
        restorers.pop()();
});
function installFixture(fixture) {
    stub(InvestmentPosition, "findAll", async () => fixture.positions ?? []);
    stub(DailyPerformanceSnapshot, "findAll", async () => fixture.snapshots ?? []);
    stub(Deposit, "findAll", async () => fixture.deposits ?? []);
    stub(LedgerAccount, "findAll", async () => fixture.accounts ?? []);
    stub(LedgerEntry, "findAll", async () => fixture.entries ?? []);
}
function position(overrides = {}) {
    return {
        position_id: "pos-1",
        user_id: "user-1",
        deposit_id: "dep-1",
        asset: "BTC",
        principal: "0",
        current_valuation: null,
        status: "active",
        verification_status: "unavailable",
        strategy: "custody_hold",
        ...overrides
    };
}
function deposit(overrides = {}) {
    return {
        deposit_id: "dep-1",
        user_id: "user-1",
        crypto_type: "BTC",
        amount: "0",
        usd_amount: null,
        received_amount: null,
        status: "Approved",
        ...overrides
    };
}
// ---------------------------------------------------------------------------
// Active investments are converted to USD with the deposit's stored ratio
// ---------------------------------------------------------------------------
(0, node_test_1.test)("an active BTC position is valued in USD, not in raw BTC units", async () => {
    // 0.5 BTC deposited for 30,000 USD -> 60,000 USD per BTC, recorded on the deposit.
    installFixture({
        deposits: [deposit({ amount: "0.5", received_amount: "0.5", usd_amount: 30000 })],
        positions: [position({ principal: "0.5", current_valuation: null })]
    });
    const overview = await service.getPerformanceOverview("user-1", "30d");
    assert_1.default.equal(overview.overview.investedPrincipal, "30000.00000000");
    // Unverified positions fall back to principal and flag the valuation.
    assert_1.default.equal(overview.overview.currentInvestmentValue, "30000.00000000");
    assert_1.default.equal(overview.overview.valuationComplete, false);
    const valuation = service.portfolioValuation(overview.overview);
    assert_1.default.equal(valuation.totalValue, "30000.00000000");
    assert_1.default.equal(valuation.accruedEarnings, "0.00000000");
});
(0, node_test_1.test)("a dollar-pegged stablecoin position is valued at par", async () => {
    installFixture({
        deposits: [deposit({ crypto_type: "TRC20", amount: "100", received_amount: "100", usd_amount: 100 })],
        positions: [
            position({ asset: "TRC20", principal: "100", current_valuation: null })
        ]
    });
    const overview = await service.getPerformanceOverview("user-1", "30d");
    assert_1.default.equal(overview.overview.investedPrincipal, "100.00000000");
    assert_1.default.equal(overview.overview.currentInvestmentValue, "100.00000000");
});
// ---------------------------------------------------------------------------
// Pending (accrued) earnings are included exactly once
// ---------------------------------------------------------------------------
(0, node_test_1.test)("accrued pending earnings lift the total exactly once", async () => {
    // 0.5 BTC principal, 0.515 BTC verified valuation -> +0.015 BTC = +900 USD.
    installFixture({
        deposits: [deposit({ amount: "0.5", received_amount: "0.5", usd_amount: 30000 })],
        positions: [
            position({ principal: "0.5", current_valuation: "0.515", verification_status: "verified" })
        ]
    });
    const overview = await service.getPerformanceOverview("user-1", "30d");
    assert_1.default.equal(overview.overview.investedPrincipal, "30000.00000000");
    assert_1.default.equal(overview.overview.currentInvestmentValue, "30900.00000000");
    assert_1.default.equal(overview.overview.valuationComplete, true);
    const valuation = service.portfolioValuation(overview.overview);
    assert_1.default.equal(valuation.totalValue, "30900.00000000");
    assert_1.default.equal(valuation.accruedEarnings, "900.00000000");
    assert_1.default.equal(valuation.settledEarnings, "0.00000000");
});
// ---------------------------------------------------------------------------
// Settled (distributed) earnings are reported separately, never double counted
// ---------------------------------------------------------------------------
(0, node_test_1.test)("settled earnings are reported separately and never added to the total again", async () => {
    installFixture({
        deposits: [deposit({ amount: "0.5", received_amount: "0.5", usd_amount: 30000 })],
        positions: [
            position({ principal: "0.5", current_valuation: "0.515", verification_status: "verified" })
        ],
        accounts: [{ account_id: "acc-1", user_id: "user-1", code: "realized_earnings", asset: "USD" }],
        entries: [
            {
                entry_id: "entry-1",
                account_id: "acc-1",
                user_id: "user-1",
                direction: "debit",
                amount: "900.00000000",
                asset: "USD",
                transaction_type: "profit_distribution",
                source_type: "balance_adjustment",
                source_id: "adj-1",
                created_at: new Date("2026-11-20T00:00:00.000Z")
            }
        ]
    });
    const overview = await service.getPerformanceOverview("user-1", "30d");
    assert_1.default.equal(overview.overview.currentInvestmentValue, "30900.00000000");
    assert_1.default.equal(overview.overview.totalRealizedProfitLoss, "900.00000000");
    const valuation = service.portfolioValuation(overview.overview);
    // The total is unchanged by a distribution; the settled 900 is surfaced separately.
    assert_1.default.equal(valuation.totalValue, "30900.00000000");
    assert_1.default.equal(valuation.settledEarnings, "900.00000000");
});
// ---------------------------------------------------------------------------
// Approved but uninvested deposits are wallet capital, not investment principal
// ---------------------------------------------------------------------------
(0, node_test_1.test)("an approved but uninvested deposit is not counted as investment principal", async () => {
    installFixture({
        deposits: [deposit({ amount: "0.001", received_amount: "0.001", usd_amount: 100 })],
        positions: [],
        accounts: [{ account_id: "acc-1", user_id: "user-1", code: "invested_principal", asset: "BTC" }],
        entries: [
            {
                entry_id: "entry-1",
                account_id: "acc-1",
                user_id: "user-1",
                direction: "credit",
                amount: "0.00100000",
                asset: "BTC",
                transaction_type: "deposit_confirmed",
                source_type: "deposit",
                source_id: "dep-1",
                created_at: new Date("2026-11-20T00:00:00.000Z")
            }
        ]
    });
    const overview = await service.getPerformanceOverview("user-1", "30d");
    // With no active position the portfolio totals stay empty; the deposit remains
    // wallet capital and is owned by the wallet/progression surface, not the portfolio.
    assert_1.default.equal(overview.overview.investedPrincipal, "0.00000000");
    assert_1.default.equal(overview.overview.currentInvestmentValue, "0.00000000");
    const valuation = service.portfolioValuation(overview.overview);
    assert_1.default.equal(valuation.totalValue, "0.00000000");
});
// ---------------------------------------------------------------------------
// Volatile positions without a recorded USD value are flagged, never invented
// ---------------------------------------------------------------------------
(0, node_test_1.test)("a position whose deposit has no recorded USD value is flagged, not valued as USD", async () => {
    installFixture({
        deposits: [deposit({ amount: "0.5", received_amount: "0.5", usd_amount: null })],
        positions: [position({ principal: "0.5", current_valuation: "0.5" })]
    });
    const overview = await service.getPerformanceOverview("user-1", "30d");
    assert_1.default.equal(overview.overview.valuationComplete, false);
    assert_1.default.equal(overview.overview.currentInvestmentValue, "0.00000000");
    assert_1.default.equal(overview.overview.investedPrincipal, "0.00000000");
});
// ---------------------------------------------------------------------------
// Regression: the exact reported figures
// ---------------------------------------------------------------------------
(0, node_test_1.test)("regression: a $100 BTC deposit values at ~$100 principal, never $0.00", async () => {
    // The production figures: 0.00158664 BTC credited as principal and 0.00168184
    // BTC as the verified valuation for a 100 USD deposit. Summed raw these showed
    // as $0.00 on the dashboard; converted they must read ~$106.
    installFixture({
        deposits: [deposit({ amount: "0.00158664", received_amount: "0.00158664", usd_amount: 100 })],
        positions: [
            position({ principal: "0.00158664", current_valuation: "0.00168184", verification_status: "verified" })
        ]
    });
    const overview = await service.getPerformanceOverview("user-1", "30d");
    const valuation = service.portfolioValuation(overview.overview);
    // Principal is the recorded USD value of the deposit, exact to the cent.
    assert_1.default.equal(valuation.investedPrincipal, "100.00000000");
    // The accrued portion is ~6 USD (0.0000952 BTC at the stored ratio); it can carry
    // sub-cent rounding from the 8dp ratio, so allow a tight tolerance.
    assert_1.default.ok(Math.abs(Number(valuation.totalValue) - 106.0001) < 0.01, `total ${valuation.totalValue}`);
    assert_1.default.ok(Math.abs(Number(valuation.accruedEarnings) - 6.0001) < 0.01, `accrued ${valuation.accruedEarnings}`);
    assert_1.default.notEqual(valuation.totalValue, "0.00000000");
});
