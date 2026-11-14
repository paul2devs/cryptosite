"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Withdrawal = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class Withdrawal extends sequelize_1.Model {
}
exports.Withdrawal = Withdrawal;
Withdrawal.init({
    withdrawal_id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    amount: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false
    },
    status: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: "Pending"
    },
    asset: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    destination_address: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    network: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    network_fee: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    platform_fee: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    tx_hash: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    review_reason: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    detailed_status: { type: sequelize_1.DataTypes.STRING, allowNull: true, defaultValue: null },
    idempotency_key: { type: sequelize_1.DataTypes.STRING, allowNull: true, unique: true },
    processed_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "withdrawals",
    timestamps: false
});
User_1.User.hasMany(Withdrawal, { foreignKey: "user_id" });
Withdrawal.belongsTo(User_1.User, { foreignKey: "user_id" });
