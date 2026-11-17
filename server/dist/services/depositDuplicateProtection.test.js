"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const node_test_1 = require("node:test");
const axios_1 = __importDefault(require("axios"));
const sequelize_1 = require("sequelize");
/**
 * Deterministic platform configuration. All readers in the deposit stack read
 * `process.env` lazily, so pinning them here (before any call) is sufficient.
 */
process.env.BLOCKCHAIN_VERIFICATION_ENABLED = "true";
process.env.BTC_DEPOSIT_ADDRESS = "bc1qg626afhea5ysw9a470c0ewa3dyapw0avff4em6";
process.env.BTC_BLOCKCHAIN_API_BASE = "https://blockstream.info/api";
process.env.BTC_MIN_CONFIRMATIONS = "2";
const depositLifecycleService_1 = require("./depositLifecycleService");
const walletService_1 = require("./walletService");
/**
 * The models, the Sequelize instance and the side-effect services are resolved
 * through `require` so their live module objects can be swapped out. The deposit
 * service reads these as stable singleton references, so patching the property
 * on the module object is what actually intercepts the call.
 */
let Deposit;
let AdminAuditLog;
let Notification;
let User;
let sequelize;
let activityService;
let financialOperations;
let referralService;
(0, node_test_1.before)(() => {
    Deposit = require("../models/Deposit").Deposit;
    AdminAuditLog = require("../models/AdminAuditLog").AdminAuditLog;
    Notification = require("../models/Notification").Notification;
    User = require("../models/User").User;
    sequelize = require("../config/database").sequelize;
    activityService = require("./activityService");
    financialOperations = require("./financialOperationsService");
    referralService = require("./referralService");
});
const restorers = [];
function stub(target, key, impl) {
    const original = target[key];
    target[key] = impl;
    restorers.push(() => {
        target[key] = original;
    });
}
const BTC_TIP = 800000;
let routes = [];
const originalGet = axios_1.default.get;
(0, node_test_1.before)(() => {
    axios_1.default.get = async (url) => {
        const route = routes.find((candidate) => candidate.match(url));
        if (!route) {
            throw new Error(`no mock route for GET ${url}`);
        }
        return { data: route.respond() };
    };
});
(0, node_test_1.after)(() => {
    axios_1.default.get = originalGet;
});
(0, node_test_1.beforeEach)(() => {
    routes = [];
    (0, walletService_1.resetPlatformWalletCache)();
});
(0, node_test_1.afterEach)(() => {
    while (restorers.length > 0) {
        restorers.pop()();
    }
});
/**
 * Mirrors an Esplora `/tx/:txid` answer for a *mined* transfer. Note what is
 * deliberately absent: Esplora does not return `status.confirmations`, so the
 * only way to a correct count is `tipHeight - block_height + 1`.
 */
function btcRoutes(to, sats, confirmations) {
    return [
        {
            match: (url) => url.includes("/tx/"),
            respond: () => ({
                status: { confirmed: true, block_height: BTC_TIP - confirmations + 1 },
                vout: [{ scriptpubkey_address: to, value: sats }]
            })
        },
        { match: (url) => url.endsWith("/blocks/tip/height"), respond: () => BTC_TIP }
    ];
}
/** Mirrors an Esplora answer for a transfer that is still in the mempool. */
function btcRoutesUnconfirmed(to, sats) {
    return [
        {
            match: (url) => url.includes("/tx/"),
            respond: () => ({
                status: { confirmed: false },
                vout: [{ scriptpubkey_address: to, value: sats }]
            })
        },
        { match: (url) => url.endsWith("/blocks/tip/height"), respond: () => BTC_TIP }
    ];
}
/**
 * Stub every side effect an approval triggers and count the wallet credits. The
 * counter is the observable proof of "credited exactly once".
 */
function stubApprovalSideEffects() {
    stub(sequelize, "transaction", async (callback) => callback({ id: "tx-1" }));
    stub(AdminAuditLog, "create", async () => ({}));
    stub(Notification, "create", async () => ({}));
    stub(User, "findByPk", async () => null);
    stub(activityService, "trackUserActivity", async () => undefined);
    stub(referralService, "grantReferralRewardsOnApprovedDeposit", async () => undefined);
    let credits = 0;
    stub(financialOperations, "recordConfirmedDeposit", async () => {
        credits += 1;
        return {};
    });
    return { credits: () => credits };
}
let depositCounter = 0;
function fakeDeposit(overrides = {}) {
    depositCounter += 1;
    return {
        deposit_id: `dep-${depositCounter}`,
        user_id: "user-1",
        reference: "NX-7K29P4Q8",
        crypto_type: "BTC",
        amount: 0.5,
        tx_hash: null,
        received_amount: null,
        confirmation_count: 0,
        verification_result: null,
        network: "Bitcoin",
        deposit_wallet: null,
        detected_at: null,
        verified_at: null,
        reviewed_by: null,
        reviewed_at: null,
        approved_at: null,
        confirmed_at: null,
        detailed_status: "PENDING",
        status: "Pending",
        save: async () => undefined,
        ...overrides
    };
}
function uniqueViolation() {
    return new sequelize_1.UniqueConstraintError({
        fields: { tx_hash: "f".repeat(64) },
        errors: [
            {
                message: 'duplicate key value violates unique constraint "deposits_tx_hash_unique"'
            }
        ]
    });
}
(0, node_test_1.test)("a transaction hash already attached to another deposit is rejected with 409", async () => {
    const deposit = fakeDeposit();
    let lookups = 0;
    stub(Deposit, "findOne", async () => {
        lookups += 1;
        return lookups === 1 ? deposit : { deposit_id: "dep-other" };
    });
    await assert_1.default.rejects(() => (0, depositLifecycleService_1.submitDepositTransactionHash)({
        userId: "user-1",
        reference: "NX-7K29P4Q8",
        txHash: "f".repeat(64)
    }), (error) => {
        assert_1.default.ok(error instanceof depositLifecycleService_1.DepositCreationError);
        assert_1.default.equal(error.statusCode, 409);
        assert_1.default.equal(error.code, "TRANSACTION_ALREADY_USED");
        return true;
    });
});
(0, node_test_1.test)("simultaneous duplicate submissions are stopped by the unique index and return 409", async () => {
    const deposit = fakeDeposit();
    // Neither request sees the other during the pre-check: the race is real.
    let lookups = 0;
    stub(Deposit, "findOne", async () => {
        lookups += 1;
        return lookups === 1 ? deposit : null;
    });
    stub(Deposit, "findByPk", async () => deposit);
    stub(sequelize, "transaction", async (callback) => callback({ id: "tx-1" }));
    deposit.save = async () => {
        throw uniqueViolation();
    };
    routes = btcRoutes(process.env.BTC_DEPOSIT_ADDRESS, 50000000, 3);
    await assert_1.default.rejects(() => (0, depositLifecycleService_1.submitDepositTransactionHash)({
        userId: "user-1",
        reference: "NX-7K29P4Q8",
        txHash: "f".repeat(64)
    }), (error) => {
        assert_1.default.equal(error.statusCode, 409);
        assert_1.default.equal(error.code, "TRANSACTION_ALREADY_USED");
        return true;
    });
});
(0, node_test_1.test)("admin approval independently re-verifies and refuses a mismatched transaction", async () => {
    const deposit = fakeDeposit({
        tx_hash: "f".repeat(64),
        detailed_status: "AWAITING_ADMIN_APPROVAL"
    });
    stub(Deposit, "findByPk", async () => deposit);
    stub(Deposit, "findOne", async () => null);
    let credited = 0;
    stub(financialOperations, "recordConfirmedDeposit", async () => {
        credited += 1;
    });
    // On-chain the transfer went to somebody else.
    routes = btcRoutes("bc1qsomeoneelse000000000000000000000000000", 50000000, 3);
    await assert_1.default.rejects(() => (0, depositLifecycleService_1.approveDeposit)("admin-1", deposit.deposit_id, "looks fine"), (error) => {
        assert_1.default.equal(error.statusCode, 409);
        assert_1.default.equal(error.code, "VERIFICATION_FAILED");
        return true;
    });
    assert_1.default.equal(credited, 0);
});
(0, node_test_1.test)("admin approval credits the wallet exactly once across repeated approvals", async () => {
    const deposit = fakeDeposit({
        tx_hash: "f".repeat(64),
        detailed_status: "AWAITING_ADMIN_APPROVAL"
    });
    stub(Deposit, "findByPk", async () => deposit);
    stub(Deposit, "findOne", async () => null);
    stub(sequelize, "transaction", async (callback) => callback({ id: "tx-1" }));
    stub(AdminAuditLog, "create", async () => ({}));
    stub(Notification, "create", async () => ({}));
    stub(User, "findByPk", async () => null);
    stub(activityService, "trackUserActivity", async () => undefined);
    stub(referralService, "grantReferralRewardsOnApprovedDeposit", async () => undefined);
    let credited = 0;
    stub(financialOperations, "recordConfirmedDeposit", async () => {
        credited += 1;
        return {};
    });
    routes = btcRoutes(process.env.BTC_DEPOSIT_ADDRESS, 50000000, 3);
    const first = await (0, depositLifecycleService_1.approveDeposit)("admin-1", deposit.deposit_id, "verified");
    assert_1.default.equal(first.credited, true);
    assert_1.default.equal(credited, 1);
    assert_1.default.equal(deposit.detailed_status, "COMPLETED");
    const second = await (0, depositLifecycleService_1.approveDeposit)("admin-1", deposit.deposit_id, "again");
    assert_1.default.equal(second.credited, false);
    assert_1.default.equal(credited, 1);
});
(0, node_test_1.test)("admin approval refuses a Bitcoin transaction that is still unconfirmed", async () => {
    const deposit = fakeDeposit({
        tx_hash: "f".repeat(64),
        detailed_status: "AWAITING_ADMIN_APPROVAL"
    });
    stub(Deposit, "findByPk", async () => deposit);
    stub(Deposit, "findOne", async () => null);
    const approval = stubApprovalSideEffects();
    // Esplora: the transfer is in the mempool, so there is no block to count from.
    routes = btcRoutesUnconfirmed(process.env.BTC_DEPOSIT_ADDRESS, 50000000);
    await assert_1.default.rejects(() => (0, depositLifecycleService_1.approveDeposit)("admin-1", deposit.deposit_id, "looks fine"), (error) => {
        assert_1.default.equal(error.statusCode, 409);
        assert_1.default.equal(error.code, "VERIFICATION_FAILED");
        assert_1.default.match(String(error.message), /confirmations/i);
        return true;
    });
    // An unconfirmed transfer must never touch the wallet.
    assert_1.default.equal(approval.credits(), 0);
    assert_1.default.notEqual(deposit.detailed_status, "COMPLETED");
});
(0, node_test_1.test)("admin approval refuses a confirmed Bitcoin transaction below the minimum", async () => {
    const deposit = fakeDeposit({
        tx_hash: "f".repeat(64),
        detailed_status: "AWAITING_ADMIN_APPROVAL"
    });
    stub(Deposit, "findByPk", async () => deposit);
    stub(Deposit, "findOne", async () => null);
    const approval = stubApprovalSideEffects();
    // Mined, but only 1 confirmation while the platform requires 2.
    routes = btcRoutes(process.env.BTC_DEPOSIT_ADDRESS, 50000000, 1);
    await assert_1.default.rejects(() => (0, depositLifecycleService_1.approveDeposit)("admin-1", deposit.deposit_id, "looks fine"), (error) => {
        assert_1.default.equal(error.statusCode, 409);
        assert_1.default.equal(error.code, "VERIFICATION_FAILED");
        assert_1.default.match(String(error.message), /confirmations/i);
        return true;
    });
    assert_1.default.equal(approval.credits(), 0);
    assert_1.default.notEqual(deposit.detailed_status, "COMPLETED");
});
(0, node_test_1.test)("admin approval credits a Bitcoin transaction that meets the minimum confirmations", async () => {
    const deposit = fakeDeposit({
        tx_hash: "f".repeat(64),
        detailed_status: "AWAITING_ADMIN_APPROVAL"
    });
    stub(Deposit, "findByPk", async () => deposit);
    stub(Deposit, "findOne", async () => null);
    const approval = stubApprovalSideEffects();
    // Exactly at the configured minimum (BTC_MIN_CONFIRMATIONS=2).
    routes = btcRoutes(process.env.BTC_DEPOSIT_ADDRESS, 50000000, 2);
    const outcome = await (0, depositLifecycleService_1.approveDeposit)("admin-1", deposit.deposit_id, "verified");
    assert_1.default.equal(outcome.credited, true);
    assert_1.default.equal(approval.credits(), 1);
    assert_1.default.equal(deposit.detailed_status, "COMPLETED");
    assert_1.default.equal(deposit.confirmation_count, 2);
});
(0, node_test_1.test)("a simultaneous approval cannot bind a transaction already used by another deposit", async () => {
    const deposit = fakeDeposit({
        tx_hash: "f".repeat(64),
        detailed_status: "AWAITING_ADMIN_APPROVAL"
    });
    stub(Deposit, "findByPk", async () => deposit);
    // The other deposit grabbed the same hash between the pre-check and the lock.
    let lookups = 0;
    stub(Deposit, "findOne", async () => {
        lookups += 1;
        return lookups === 1 ? null : { deposit_id: "dep-other" };
    });
    stub(sequelize, "transaction", async (callback) => callback({ id: "tx-1" }));
    let credited = 0;
    stub(financialOperations, "recordConfirmedDeposit", async () => {
        credited += 1;
    });
    routes = btcRoutes(process.env.BTC_DEPOSIT_ADDRESS, 50000000, 3);
    await assert_1.default.rejects(() => (0, depositLifecycleService_1.approveDeposit)("admin-1", deposit.deposit_id, "verified"), (error) => {
        assert_1.default.equal(error.statusCode, 409);
        assert_1.default.equal(error.code, "TRANSACTION_ALREADY_USED");
        return true;
    });
    assert_1.default.equal(credited, 0);
});
