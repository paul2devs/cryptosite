"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
/**
 * Service level coverage for the administrator balance workflow. The Sequelize
 * models, the double entry writer and the performance reader are replaced with
 * small fakes so the assertions focus on the orchestration: which balance moves,
 * which ledger legs are posted, what is written to the permanent adjustment and
 * audit records, and how idempotency and reversals behave.
 */
let service;
let User;
let BalanceAdjustment;
let InvestmentPosition;
let Deposit;
let Withdrawal;
let AdminAuditLog;
let EarningsLog;
let MembershipTier;
let UserMembership;
let sequelize;
let financialOperations;
let performanceService;
let activityService;
let membershipService;
let investmentLevelService;
(0, node_test_1.before)(() => {
    service = require("./adminBalanceService");
    User = require("../models/User").User;
    BalanceAdjustment = require("../models/BalanceAdjustment").BalanceAdjustment;
    InvestmentPosition = require("../models/InvestmentPosition").InvestmentPosition;
    Deposit = require("../models/Deposit").Deposit;
    Withdrawal = require("../models/Withdrawal").Withdrawal;
    AdminAuditLog = require("../models/AdminAuditLog").AdminAuditLog;
    EarningsLog = require("../models/EarningsLog").EarningsLog;
    MembershipTier = require("../models/MembershipTier").MembershipTier;
    UserMembership = require("../models/UserMembership").UserMembership;
    sequelize = require("../config/database").sequelize;
    financialOperations = require("./financialOperationsService");
    performanceService = require("./performanceService");
    activityService = require("./activityService");
    membershipService = require("./membershipService");
    investmentLevelService = require("./investmentLevelService");
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
    while (restorers.length > 0) {
        restorers.pop()();
    }
});
function installStubs(balance, positions = []) {
    const state = {
        balance,
        positions,
        posted: [],
        adjustments: [],
        audits: [],
        created: []
    };
    const user = {
        user_id: "user-1",
        name: "Test User",
        email: "user@example.com",
        is_admin: false,
        created_at: new Date(),
        withdrawable_balance: balance,
        locked_balance: 0,
        async save() {
            state.balance = Number(user.withdrawable_balance);
        }
    };
    stub(sequelize, "transaction", async (callback) => callback({ id: "tx-1", LOCK: { UPDATE: "UPDATE" } }));
    stub(User, "findByPk", async () => user);
    stub(InvestmentPosition, "findAll", async (options) => {
        const wanted = options?.where?.status;
        return wanted ? state.positions.filter((position) => position.status === wanted) : state.positions;
    });
    stub(InvestmentPosition, "findByPk", async (positionId) => state.positions.find((position) => position.position_id === positionId) ?? null);
    stub(InvestmentPosition, "create", async (values) => {
        const position = {
            ...values,
            position_id: `pos-${state.positions.length + 1}`,
            async save() {
                return position;
            }
        };
        state.positions.push(position);
        return position;
    });
    stub(BalanceAdjustment, "findOne", async (options) => {
        const key = options?.where?.idempotency_key;
        return state.adjustments.find((row) => row.idempotency_key === key) ?? null;
    });
    stub(BalanceAdjustment, "findByPk", async (adjustmentId) => state.adjustments.find((row) => row.adjustment_id === adjustmentId) ?? null);
    stub(BalanceAdjustment, "create", async (values) => {
        const row = {
            ...values,
            async save() {
                return row;
            }
        };
        state.adjustments.push(row);
        state.created.push(values);
        return row;
    });
    stub(AdminAuditLog, "create", async (values) => {
        state.audits.push(values);
        return values;
    });
    // The overview reads the adjustment history to show recent administrative activity.
    stub(BalanceAdjustment, "findAll", async () => state.adjustments);
    stub(Deposit, "findAll", async () => []);
    stub(Withdrawal, "findAll", async () => []);
    // Earnings and membership reads are stubbed so the service never opens a real
    // database connection during the unit run.
    stub(EarningsLog, "sum", async () => 0);
    stub(MembershipTier, "findByPk", async () => null);
    stub(UserMembership, "findByPk", async () => null);
    // Derived state is recalculated after a committed adjustment. The recalculation
    // services are stubbed so the assertions stay on the adjustment orchestration.
    stub(membershipService, "syncUserMembership", async () => undefined);
    stub(investmentLevelService, "syncUserInvestmentLevel", async () => undefined);
    stub(financialOperations, "postBalancedEntry", async (input) => {
        state.posted.push(input);
        return undefined;
    });
    stub(financialOperations, "ledgerBalancesForUser", async () => ({
        totals: { available_balance: String(state.balance) },
        entries: []
    }));
    stub(performanceService, "getPerformanceOverview", async () => ({
        overview: {
            investedPrincipal: "0.00000000",
            currentInvestmentValue: "0.00000000",
            valuationComplete: true,
            totalUnrealizedProfitLoss: null,
            totalRealizedProfitLoss: "0.00000000",
            overallReturnPercent: null
        }
    }));
    stub(activityService, "trackUserActivity", async () => undefined);
    return state;
}
function activePosition(overrides = {}) {
    const position = {
        position_id: "pos-existing",
        user_id: "user-1",
        asset: "USD",
        principal: "50.00000000",
        current_valuation: "50.00000000",
        status: "active",
        verification_status: "verified",
        last_calculated_at: null,
        async save() {
            return position;
        },
        ...overrides
    };
    return position;
}
(0, node_test_1.test)("crediting available balance moves the wallet and posts a balanced adjustment entry", async () => {
    const state = installStubs(100);
    const result = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "credit",
        amount: "25.5",
        reason: "Goodwill credit"
    });
    assert_1.default.equal(state.balance, 125.5);
    assert_1.default.equal(state.posted.length, 1);
    assert_1.default.equal(state.posted[0].debit, "adjustments");
    assert_1.default.equal(state.posted[0].credit, "available_balance");
    assert_1.default.equal(state.posted[0].transactionType, "account_adjustment");
    assert_1.default.equal(result.adjustment.balanceBefore, "100.00000000");
    assert_1.default.equal(result.adjustment.balanceAfter, "125.50000000");
    assert_1.default.equal(result.adjustment.amount, "25.50000000");
    assert_1.default.equal(state.adjustments[0].principal_before, "0.00000000");
    assert_1.default.equal(state.adjustments[0].principal_after, "0.00000000");
    assert_1.default.equal(state.audits.length, 1);
    assert_1.default.equal(state.audits[0].action, "balance_credit");
});
(0, node_test_1.test)("debiting available balance reduces the wallet", async () => {
    const state = installStubs(100);
    const result = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "debit",
        amount: "40",
        reason: "Chargeback recovery"
    });
    assert_1.default.equal(state.balance, 60);
    assert_1.default.equal(state.posted[0].debit, "available_balance");
    assert_1.default.equal(state.posted[0].credit, "adjustments");
    assert_1.default.equal(result.adjustment.balanceAfter, "60.00000000");
});
(0, node_test_1.test)("rejects an adjustment that would overdraw the available balance", async () => {
    const state = installStubs(10);
    await assert_1.default.rejects(() => service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "debit",
        amount: "10.01",
        reason: "Too much"
    }), /Insufficient available balance/);
    assert_1.default.equal(state.balance, 10);
    assert_1.default.equal(state.posted.length, 0);
});
(0, node_test_1.test)("accepts a precise fractional amount", async () => {
    const state = installStubs(1);
    const result = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "credit",
        amount: "0.00000001",
        reason: "Rounding correction"
    });
    assert_1.default.equal(result.adjustment.amount, "0.00000001");
    assert_1.default.equal(state.balance, 1.00000001);
});
(0, node_test_1.test)("rejects zero, negative and malformed amounts and short reasons", async () => {
    installStubs(100);
    await assert_1.default.rejects(() => service.applyAdjustment("admin-1", { userId: "user-1", type: "credit", amount: "0", reason: "Zero" }), /greater than zero/);
    await assert_1.default.rejects(() => service.applyAdjustment("admin-1", { userId: "user-1", type: "credit", amount: "-5", reason: "Negative" }), /positive number/);
    await assert_1.default.rejects(() => service.applyAdjustment("admin-1", { userId: "user-1", type: "credit", amount: "abc", reason: "Bad" }), /positive number/);
    await assert_1.default.rejects(() => service.applyAdjustment("admin-1", { userId: "user-1", type: "credit", amount: "5", reason: "x" }), /reason of at least 3/);
});
(0, node_test_1.test)("a repeated idempotency key returns the original adjustment without applying it twice", async () => {
    const state = installStubs(100);
    await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "credit",
        amount: "10",
        reason: "First",
        idempotencyKey: "key-1"
    });
    const balanceAfterFirst = state.balance;
    const postedAfterFirst = state.posted.length;
    const repeat = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "credit",
        amount: "10",
        reason: "First",
        idempotencyKey: "key-1"
    });
    assert_1.default.equal(state.balance, balanceAfterFirst);
    assert_1.default.equal(state.posted.length, postedAfterFirst);
    assert_1.default.equal(repeat.adjustment.adjustmentId, state.adjustments[0].adjustment_id);
});
(0, node_test_1.test)("investment allocation moves funds from the wallet into principal and creates a position", async () => {
    const state = installStubs(100);
    const result = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "investment_allocation",
        amount: "50",
        reason: "Allocate idle cash"
    });
    assert_1.default.equal(state.balance, 50);
    assert_1.default.equal(state.posted[0].debit, "available_balance");
    assert_1.default.equal(state.posted[0].credit, "invested_principal");
    assert_1.default.equal(state.posted[0].transactionType, "investment_allocation");
    assert_1.default.equal(state.positions.length, 1);
    assert_1.default.equal(state.positions[0].principal, "50.00000000");
    assert_1.default.equal(state.positions[0].deposit_id, null);
    assert_1.default.equal(result.adjustment.principalBefore, "0.00000000");
    assert_1.default.equal(result.adjustment.principalAfter, "50.00000000");
    assert_1.default.equal(result.adjustment.positionId, state.positions[0].position_id);
});
(0, node_test_1.test)("investment deallocation returns principal to the wallet and shrinks the position", async () => {
    const position = activePosition();
    const state = installStubs(5, [position]);
    const result = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "investment_deallocation",
        amount: "20",
        reason: "Release capital"
    });
    assert_1.default.equal(state.balance, 25);
    assert_1.default.equal(position.principal, "30.00000000");
    assert_1.default.equal(position.current_valuation, "30.00000000");
    assert_1.default.equal(state.posted[0].debit, "invested_principal");
    assert_1.default.equal(state.posted[0].credit, "available_balance");
    assert_1.default.equal(state.posted[0].transactionType, "investment_redemption");
    assert_1.default.equal(result.adjustment.principalAfter, "30.00000000");
});
(0, node_test_1.test)("deallocation requires an eligible position", async () => {
    installStubs(5, []);
    await assert_1.default.rejects(() => service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "investment_deallocation",
        amount: "20",
        reason: "Release capital"
    }), /no eligible active investment/);
});
(0, node_test_1.test)("a reversal records a linked entry and marks the original reversed without deleting it", async () => {
    const state = installStubs(100);
    const original = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "credit",
        amount: "25",
        reason: "Mistaken credit"
    });
    const balanceAfterCredit = state.balance;
    const reversal = await service.reverseAdjustment("admin-2", original.adjustment.adjustmentId, "Correcting mistake");
    assert_1.default.equal(state.balance, balanceAfterCredit - 25);
    assert_1.default.equal(reversal.adjustment.type, "reversal");
    assert_1.default.equal(reversal.adjustment.reversalOf, original.adjustment.adjustmentId);
    assert_1.default.equal(state.posted.length, 2);
    assert_1.default.equal(state.posted[1].transactionType, "adjustment_reversal");
    const storedOriginal = state.adjustments.find((row) => row.adjustment_id === original.adjustment.adjustmentId);
    assert_1.default.equal(storedOriginal.status, "reversed");
    assert_1.default.equal(storedOriginal.reversed_by, reversal.adjustment.adjustmentId);
    // The original row is preserved for the audit trail.
    assert_1.default.equal(storedOriginal.amount, "25.00000000");
});
(0, node_test_1.test)("a reversal can only happen once and a reversal cannot be reversed", async () => {
    const state = installStubs(100);
    const original = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "credit",
        amount: "25",
        reason: "Mistaken credit"
    });
    const reversal = await service.reverseAdjustment("admin-2", original.adjustment.adjustmentId, "Correcting mistake");
    await assert_1.default.rejects(() => service.reverseAdjustment("admin-2", original.adjustment.adjustmentId, "Again"), /already been reversed/);
    await assert_1.default.rejects(() => service.reverseAdjustment("admin-2", reversal.adjustment.adjustmentId, "Nested"), /cannot be reversed/);
    assert_1.default.equal(state.posted.length, 2);
});
(0, node_test_1.test)("valuation correction adjusts a position valuation without moving wallet cash", async () => {
    const position = activePosition();
    const state = installStubs(100, [position]);
    const result = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "valuation_correction",
        amount: "15",
        direction: "credit",
        positionId: "pos-existing",
        reason: "Correct stale position valuation"
    });
    assert_1.default.equal(position.current_valuation, "65.00000000");
    assert_1.default.equal(position.verification_status, "verified");
    // The correction is a valuation component change; the wallet and cash ledger are untouched.
    assert_1.default.equal(state.balance, 100);
    assert_1.default.equal(state.posted.length, 0);
    assert_1.default.equal(result.adjustment.valuationBefore, "50.00000000");
    assert_1.default.equal(result.adjustment.valuationAfter, "65.00000000");
    assert_1.default.equal(result.adjustment.balanceAfter, "100.00000000");
});
(0, node_test_1.test)("a valuation correction requires a selected position", async () => {
    installStubs(100, [activePosition()]);
    await assert_1.default.rejects(() => service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "valuation_correction",
        amount: "15",
        direction: "credit",
        reason: "Missing target"
    }), /Select which investment position/);
});
(0, node_test_1.test)("pending earnings adjustment records the change without crediting the wallet", async () => {
    const state = installStubs(100);
    const result = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "pending_earnings",
        amount: "12",
        direction: "credit",
        reason: "Correct accrued pending earnings"
    });
    // Pending earnings move on the settlement account only; the available wallet is untouched.
    assert_1.default.equal(state.balance, 100);
    assert_1.default.equal(state.posted.length, 1);
    assert_1.default.equal(state.posted[0].debit, "adjustments");
    assert_1.default.equal(state.posted[0].credit, "pending_settlement");
    assert_1.default.equal(state.posted[0].transactionType, "pending_earnings_adjustment");
    assert_1.default.equal(result.adjustment.earningsBefore, "0.00000000");
    assert_1.default.equal(result.adjustment.earningsAfter, "12.00000000");
    assert_1.default.equal(result.adjustment.balanceAfter, "100.00000000");
});
(0, node_test_1.test)("a pending earnings decrease below zero is rejected", async () => {
    installStubs(100);
    await assert_1.default.rejects(() => service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "pending_earnings",
        amount: "5",
        direction: "debit",
        reason: "Over-correction"
    }), /pending earnings negative/);
});
(0, node_test_1.test)("realised earnings settlement credits the wallet via the profit distribution ledger type", async () => {
    const state = installStubs(100);
    const result = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "realised_earnings",
        amount: "30",
        direction: "credit",
        reason: "Settle verified realised profit"
    });
    assert_1.default.equal(state.balance, 130);
    assert_1.default.equal(state.posted[0].debit, "realized_earnings");
    assert_1.default.equal(state.posted[0].credit, "available_balance");
    assert_1.default.equal(state.posted[0].transactionType, "profit_distribution");
    assert_1.default.equal(result.adjustment.balanceAfter, "130.00000000");
});
(0, node_test_1.test)("reversing a pending earnings adjustment restores the recorded figure", async () => {
    const state = installStubs(100);
    const original = await service.applyAdjustment("admin-1", {
        userId: "user-1",
        type: "pending_earnings",
        amount: "12",
        direction: "credit",
        reason: "Correct accrued pending earnings"
    });
    const reversal = await service.reverseAdjustment("admin-2", original.adjustment.adjustmentId, "Wrong figure");
    assert_1.default.equal(reversal.adjustment.type, "reversal");
    assert_1.default.equal(reversal.adjustment.reversalOf, original.adjustment.adjustmentId);
    assert_1.default.equal(reversal.adjustment.earningsAfter, "0.00000000");
    assert_1.default.equal(state.balance, 100);
    // One entry for the original pending-earnings move, one for the reversal.
    assert_1.default.equal(state.posted.length, 2);
});
// --- Regression: float-backed balance columns ---------------------------------
// The wallet and lock columns are stored as floats, so a stored value such as
// 0.00004090354417649406 comes back from the driver as a JavaScript number with
// far more decimal places than the ledger scale. String(number) therefore
// produced a decimal the strict parser rejected, which failed the whole overview
// with a 500 for that one account. The stored value must be read at the ledger
// precision instead of being mistaken for corrupt input.
(0, node_test_1.test)("a float balance carrying binary artefacts is read at the ledger precision", async () => {
    installStubs(0.00004090354417649406);
    const overview = await service.financialOverviewForUser("user-1");
    assert_1.default.equal(overview.balance.available, "0.00004090");
});
(0, node_test_1.test)("a float balance in scientific notation is read at the ledger precision", async () => {
    installStubs(7.753344861060553e-7);
    const overview = await service.financialOverviewForUser("user-1");
    assert_1.default.equal(overview.balance.available, "0.00000078");
});
