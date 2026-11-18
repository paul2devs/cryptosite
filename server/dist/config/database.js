"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
exports.getDatabaseStatus = getDatabaseStatus;
exports.initDatabase = initDatabase;
exports.hasDepositsTxHashUniqueIndex = hasDepositsTxHashUniqueIndex;
const sequelize_1 = require("sequelize");
const env_1 = require("./env");
const depositReference_1 = require("../domain/depositReference");
const databaseUrl = (0, env_1.requireEnv)("DATABASE_URL");
exports.sequelize = new sequelize_1.Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});
let dbOk = false;
let dbError = null;
function getDatabaseStatus() {
    return { ok: dbOk, error: dbError };
}
async function initDatabase() {
    try {
        await exports.sequelize.authenticate();
        const shouldAlter = String(process.env.DB_SYNC_ALTER || "").toLowerCase() === "true";
        // Capture whether the email verification column already existed *before* the
        // sync, so legacy accounts can be backfilled as verified exactly once.
        const usersHadEmailVerified = await hasEmailVerifiedColumn();
        await exports.sequelize.sync({ alter: shouldAlter });
        await reconcileUsersSchema({ backfillEmailVerified: !usersHadEmailVerified });
        await reconcileWithdrawalsSchema();
        await reconcileDepositsSchema();
        await reconcileMembershipSchema();
        await reconcileInvestmentLevelSchema();
        await reconcileInvestmentPositionsSchema();
        await reconcileBalanceAdjustmentSchema();
        dbOk = true;
        dbError = null;
        // eslint-disable-next-line no-console
        console.log("Database connected successfully");
    }
    catch (error) {
        dbOk = false;
        dbError = error?.message ? String(error.message) : "Unknown database error";
        const detail = error?.original?.message || error?.parent?.message || error?.message || String(error);
        throw new Error(`Database connection failed: ${detail}`);
    }
}
async function hasEmailVerifiedColumn() {
    try {
        const definition = await exports.sequelize.getQueryInterface().describeTable("users");
        return "email_verified" in definition;
    }
    catch {
        // The table does not exist yet (fresh database): nothing to backfill.
        return true;
    }
}
async function reconcileUsersSchema(options) {
    const queryInterface = exports.sequelize.getQueryInterface();
    const usersDefinition = await queryInterface.describeTable("users");
    if (!("email_verified" in usersDefinition)) {
        await queryInterface.addColumn("users", "email_verified", {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    }
    if (!("email_verified_at" in usersDefinition)) {
        await queryInterface.addColumn("users", "email_verified_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
    // Accounts that existed before email verification was introduced keep their
    // full access: they are treated as verified. Only accounts created after this
    // migration start unverified.
    if (options.backfillEmailVerified) {
        await exports.sequelize.query(`UPDATE users SET email_verified = true, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE email_verified = false`);
    }
    if (!("bonus_blocked" in usersDefinition)) {
        await queryInterface.addColumn("users", "bonus_blocked", {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    }
    if (!("account_settings" in usersDefinition)) {
        await queryInterface.addColumn("users", "account_settings", {
            type: sequelize_1.DataTypes.JSONB,
            allowNull: false,
            defaultValue: {
                notifications: {
                    deposit_updates: true,
                    withdrawal_updates: true,
                    rewards_bonuses: true,
                    announcements: true
                },
                preferences: {
                    language: "en"
                },
                withdrawal_wallets: []
            }
        });
    }
    if (!("withdrawable_balance" in usersDefinition)) {
        await queryInterface.addColumn("users", "withdrawable_balance", {
            type: sequelize_1.DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: 0
        });
    }
    if (!("locked_balance" in usersDefinition)) {
        await queryInterface.addColumn("users", "locked_balance", {
            type: sequelize_1.DataTypes.DOUBLE,
            allowNull: false,
            defaultValue: 0
        });
    }
    if (!("last_withdrawal_at" in usersDefinition)) {
        await queryInterface.addColumn("users", "last_withdrawal_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("last_activity_at" in usersDefinition)) {
        await queryInterface.addColumn("users", "last_activity_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
}
async function reconcileWithdrawalsSchema() {
    const queryInterface = exports.sequelize.getQueryInterface();
    let definition;
    try {
        definition = await queryInterface.describeTable("withdrawals");
    }
    catch {
        return;
    }
    if (!("idempotency_key" in definition)) {
        await queryInterface.addColumn("withdrawals", "idempotency_key", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        });
        try {
            await queryInterface.addIndex("withdrawals", ["idempotency_key"], {
                unique: true,
                name: "withdrawals_idempotency_key_unique"
            });
        }
        catch {
            // The unique index already exists or the parallel sync created it.
        }
    }
}
/**
 * Bring the `deposits` table in line with the crypto deposit model without
 * dropping or resetting anything:
 *
 *  - add the unique deposit `reference` (NX-XXXXXXXX) used to identify a request,
 *  - add the memo/destination-tag, received-amount and fine-grained status
 *    columns used by the deposit verification lifecycle,
 *  - add the `idempotency_key` used to make deposit creation safe against
 *    double-clicks and retries,
 *  - backfill references for existing rows and reconcile legacy coarse statuses
 *    onto the detailed status model.
 */
async function reconcileDepositsSchema() {
    const queryInterface = exports.sequelize.getQueryInterface();
    let definition;
    try {
        definition = await queryInterface.describeTable("deposits");
    }
    catch {
        return;
    }
    if (!("reference" in definition)) {
        await queryInterface.addColumn("deposits", "reference", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("usd_amount" in definition)) {
        await queryInterface.addColumn("deposits", "usd_amount", {
            type: sequelize_1.DataTypes.DOUBLE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("memo" in definition)) {
        await queryInterface.addColumn("deposits", "memo", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("memo_label" in definition)) {
        await queryInterface.addColumn("deposits", "memo_label", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("memo_required" in definition)) {
        await queryInterface.addColumn("deposits", "memo_required", {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    }
    if (!("received_amount" in definition)) {
        await queryInterface.addColumn("deposits", "received_amount", {
            type: sequelize_1.DataTypes.DOUBLE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("detailed_status" in definition)) {
        await queryInterface.addColumn("deposits", "detailed_status", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            defaultValue: "PENDING"
        });
    }
    if (!("idempotency_key" in definition)) {
        await queryInterface.addColumn("deposits", "idempotency_key", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("detected_at" in definition)) {
        await queryInterface.addColumn("deposits", "detected_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("verified_at" in definition)) {
        await queryInterface.addColumn("deposits", "verified_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("expires_at" in definition)) {
        await queryInterface.addColumn("deposits", "expires_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("reviewed_by" in definition)) {
        await queryInterface.addColumn("deposits", "reviewed_by", {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("reviewed_at" in definition)) {
        await queryInterface.addColumn("deposits", "reviewed_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("rejection_reason" in definition)) {
        await queryInterface.addColumn("deposits", "rejection_reason", {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            defaultValue: null
        });
    }
    // Ensure the uniqueness guarantees exist even when `sequelize.sync` created
    // the columns first. Both indexes tolerate multiple NULLs, so legacy rows stay
    // valid until they are backfilled below.
    try {
        await queryInterface.addIndex("deposits", ["reference"], {
            unique: true,
            name: "deposits_reference_unique"
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("[database] deposits_reference_unique could not be created:", error instanceof Error ? error.message : String(error));
    }
    try {
        await queryInterface.addIndex("deposits", ["idempotency_key"], {
            unique: true,
            name: "deposits_idempotency_key_unique"
        });
    }
    catch (error) {
        // eslint-disable-next-line no-console
        console.error("[database] deposits_idempotency_key_unique could not be created:", error instanceof Error ? error.message : String(error));
    }
    // One on-chain transaction may fund at most one deposit. This index is the
    // database-level authority behind the application's duplicate-hash checks, so
    // its creation is verified rather than assumed.
    await ensureDepositsTxHashUniqueIndex();
    // Backfill a unique, never-reused reference for every pre-existing deposit.
    const unreferenced = await exports.sequelize.query("SELECT deposit_id FROM deposits WHERE reference IS NULL", { type: sequelize_1.QueryTypes.SELECT });
    for (const row of unreferenced) {
        await exports.sequelize.query("UPDATE deposits SET reference = :reference WHERE deposit_id = :depositId AND reference IS NULL", { replacements: { reference: (0, depositReference_1.generateDepositReference)(), depositId: row.deposit_id } });
    }
    // Reconcile coarse legacy statuses onto the detailed status model exactly
    // once, so historical approved/rejected deposits report the right step.
    await exports.sequelize.query("UPDATE deposits SET detailed_status = 'COMPLETED' WHERE status = 'Approved' AND detailed_status = 'PENDING'");
    await exports.sequelize.query("UPDATE deposits SET detailed_status = 'FAILED' WHERE status = 'Rejected' AND detailed_status = 'PENDING'");
}
/**
 * Whether the partial unique index guarding `deposits(tx_hash)` currently
 * exists. Used at startup and by operational checks: the database must be the
 * final authority that stops one on-chain transaction funding two deposits.
 */
async function hasDepositsTxHashUniqueIndex() {
    const rows = await exports.sequelize.query("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'deposits' AND indexname = 'deposits_tx_hash_unique'", { type: sequelize_1.QueryTypes.SELECT });
    return rows.length > 0;
}
/**
 * Create the partial unique index on `deposits(tx_hash)` and verify it landed.
 *
 * Failures are never swallowed: a duplicate-key violation from pre-existing
 * data is reported loudly (an operator must deduplicate before the database can
 * enforce the rule) while any other failure aborts startup so the platform
 * never runs believing a guarantee exists when it does not.
 */
async function ensureDepositsTxHashUniqueIndex() {
    if (await hasDepositsTxHashUniqueIndex()) {
        return;
    }
    try {
        await exports.sequelize.query("CREATE UNIQUE INDEX IF NOT EXISTS deposits_tx_hash_unique ON deposits (tx_hash) WHERE tx_hash IS NOT NULL");
    }
    catch (error) {
        const sqlState = error?.original?.code ||
            error?.parent?.code;
        if (sqlState === "23505") {
            // eslint-disable-next-line no-console
            console.error("[database] deposits_tx_hash_unique could NOT be created because existing rows share a tx_hash. " +
                "Deduplicate those deposits; until then duplicate protection only holds at the application layer.");
            return;
        }
        throw new Error(`Failed to create deposits_tx_hash_unique: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!(await hasDepositsTxHashUniqueIndex())) {
        throw new Error("deposits_tx_hash_unique is missing after creation; duplicate transaction protection is not enforced by the database.");
    }
}
async function reconcileMembershipSchema() {
    const queryInterface = exports.sequelize.getQueryInterface();
    let membershipColumns;
    let historyColumns;
    try {
        membershipColumns = await queryInterface.describeTable("user_memberships");
        historyColumns = await queryInterface.describeTable("membership_histories");
    }
    catch {
        return;
    }
    if (!("manual_tier_id" in membershipColumns)) {
        await queryInterface.addColumn("user_memberships", "manual_tier_id", {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("manual_reason" in membershipColumns)) {
        await queryInterface.addColumn("user_memberships", "manual_reason", {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("manual_set_at" in membershipColumns)) {
        await queryInterface.addColumn("user_memberships", "manual_set_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("source" in historyColumns)) {
        await queryInterface.addColumn("membership_histories", "source", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            defaultValue: "automatic"
        });
    }
    if (!("actor_admin_id" in historyColumns)) {
        await queryInterface.addColumn("membership_histories", "actor_admin_id", {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            defaultValue: null
        });
    }
}
async function reconcileInvestmentLevelSchema() {
    const queryInterface = exports.sequelize.getQueryInterface();
    let userLevelColumns;
    let historyColumns;
    let benefitColumns;
    try {
        userLevelColumns = await queryInterface.describeTable("user_investment_levels");
        historyColumns = await queryInterface.describeTable("investment_level_histories");
        benefitColumns = await queryInterface.describeTable("investment_level_benefits");
    }
    catch {
        return;
    }
    if (!("manual_level_id" in userLevelColumns)) {
        await queryInterface.addColumn("user_investment_levels", "manual_level_id", {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("manual_reason" in userLevelColumns)) {
        await queryInterface.addColumn("user_investment_levels", "manual_reason", {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("manual_set_at" in userLevelColumns)) {
        await queryInterface.addColumn("user_investment_levels", "manual_set_at", {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("source" in historyColumns)) {
        await queryInterface.addColumn("investment_level_histories", "source", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            defaultValue: "automatic"
        });
    }
    if (!("actor_admin_id" in historyColumns)) {
        await queryInterface.addColumn("investment_level_histories", "actor_admin_id", {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true,
            defaultValue: null
        });
    }
    if (!("category" in benefitColumns)) {
        await queryInterface.addColumn("investment_level_benefits", "category", {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            defaultValue: "tools"
        });
    }
}
/**
 * Relax `investment_positions.deposit_id` to nullable so an administrator can
 * allocate principal into a new position that has no originating deposit. The
 * column keeps its unique constraint, so deposit-backed positions stay 1:1 and
 * the change is purely additive: no rows are dropped or rewritten.
 */
async function reconcileInvestmentPositionsSchema() {
    const queryInterface = exports.sequelize.getQueryInterface();
    let definition;
    try {
        definition = await queryInterface.describeTable("investment_positions");
    }
    catch {
        return;
    }
    if (definition.deposit_id && definition.deposit_id.allowNull === false) {
        await queryInterface.changeColumn("investment_positions", "deposit_id", {
            type: sequelize_1.DataTypes.UUID,
            allowNull: true
        });
    }
}
/**
 * Ensure the administrator balance ledger table has its uniqueness guarantees.
 * `reference` is a permanent human-readable id; `idempotency_key` stops a
 * double-submitted adjustment from ever being applied twice.
 */
async function reconcileBalanceAdjustmentSchema() {
    const queryInterface = exports.sequelize.getQueryInterface();
    try {
        await queryInterface.describeTable("balance_adjustments");
    }
    catch {
        return;
    }
    const indexes = [
        {
            name: "balance_adjustments_reference_unique",
            statement: "CREATE UNIQUE INDEX IF NOT EXISTS balance_adjustments_reference_unique ON balance_adjustments (reference)"
        },
        {
            name: "balance_adjustments_idempotency_key_unique",
            statement: "CREATE UNIQUE INDEX IF NOT EXISTS balance_adjustments_idempotency_key_unique ON balance_adjustments (idempotency_key) WHERE idempotency_key IS NOT NULL"
        },
        {
            name: "balance_adjustments_user_created_idx",
            statement: "CREATE INDEX IF NOT EXISTS balance_adjustments_user_created_idx ON balance_adjustments (user_id, created_at)"
        }
    ];
    for (const index of indexes) {
        try {
            await exports.sequelize.query(index.statement);
        }
        catch (error) {
            const sqlState = error?.original?.code ||
                error?.parent?.code;
            if (sqlState === "23505") {
                // eslint-disable-next-line no-console
                console.error(`[database] ${index.name} could NOT be created because existing rows are not unique. ` +
                    "Deduplicate those rows; until then duplicate protection only holds at the application layer.");
                continue;
            }
            throw new Error(`Failed to create ${index.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
