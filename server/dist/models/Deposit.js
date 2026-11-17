"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deposit = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class Deposit extends sequelize_1.Model {
}
exports.Deposit = Deposit;
Deposit.init({
    deposit_id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    reference: {
        // Uniqueness is enforced by the `deposits_reference_unique` index created
        // in reconcileDepositsSchema; it is declared here without `unique` so the
        // in-place `sequelize.sync` never attempts a destructive table rebuild.
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    crypto_type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false
    },
    usd_amount: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: true,
        defaultValue: null
    },
    tx_hash: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    network: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    deposit_wallet: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    memo: { type: sequelize_1.DataTypes.STRING, allowNull: true, defaultValue: null },
    memo_label: { type: sequelize_1.DataTypes.STRING, allowNull: true, defaultValue: null },
    memo_required: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    received_amount: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: true,
        defaultValue: null
    },
    confirmation_count: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    verification_result: { type: sequelize_1.DataTypes.JSONB, allowNull: true },
    detailed_status: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: "PENDING"
    },
    idempotency_key: {
        // Uniqueness is enforced by the `deposits_idempotency_key_unique` index
        // created in reconcileDepositsSchema (see the note on `reference`).
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    detected_at: { type: sequelize_1.DataTypes.DATE, allowNull: true, defaultValue: null },
    verified_at: { type: sequelize_1.DataTypes.DATE, allowNull: true, defaultValue: null },
    expires_at: { type: sequelize_1.DataTypes.DATE, allowNull: true, defaultValue: null },
    confirmed_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    reviewed_by: { type: sequelize_1.DataTypes.UUID, allowNull: true, defaultValue: null },
    reviewed_at: { type: sequelize_1.DataTypes.DATE, allowNull: true, defaultValue: null },
    rejection_reason: { type: sequelize_1.DataTypes.TEXT, allowNull: true, defaultValue: null },
    status: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: "Pending"
    },
    multiplier: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 1
    },
    pending_earning: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
    },
    approved_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },
    total_earned: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
    },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "deposits",
    timestamps: false
});
User_1.User.hasMany(Deposit, { foreignKey: "user_id" });
Deposit.belongsTo(User_1.User, { foreignKey: "user_id" });
