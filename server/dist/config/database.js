"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
exports.getDatabaseStatus = getDatabaseStatus;
exports.initDatabase = initDatabase;
const sequelize_1 = require("sequelize");
const env_1 = require("./env");
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
        await exports.sequelize.sync({ alter: shouldAlter });
        await reconcileUsersSchema();
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
async function reconcileUsersSchema() {
    const queryInterface = exports.sequelize.getQueryInterface();
    const usersDefinition = await queryInterface.describeTable("users");
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
