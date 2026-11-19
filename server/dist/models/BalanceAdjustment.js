"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalanceAdjustment = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
// Permanent, auditable record of every administrator balance or investment adjustment.
// Rows are never updated to change an amount: a wrong adjustment is corrected by a new
// reversal row that links back through `reversal_of` / `reversed_by`.
class BalanceAdjustment extends sequelize_1.Model {
}
exports.BalanceAdjustment = BalanceAdjustment;
BalanceAdjustment.init({
    adjustment_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    admin_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    type: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    direction: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    asset: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "USD" },
    balance_before: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    balance_after: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    principal_before: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    principal_after: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    // Before/after snapshots for the newer adjustment categories. They stay null for
    // adjustments that do not touch valuations or earnings, so the audit row only carries
    // the values that actually changed.
    valuation_before: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: true, defaultValue: null },
    valuation_after: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: true, defaultValue: null },
    earnings_before: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: true, defaultValue: null },
    earnings_after: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: true, defaultValue: null },
    position_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    note: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    // Uniqueness is enforced by reconcileBalanceAdjustmentSchema indexes so the
    // in-place `sequelize.sync` never attempts a destructive table rebuild.
    reference: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    idempotency_key: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    reversal_of: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    reversed_by: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    status: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "applied" },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "balance_adjustments",
    timestamps: false,
    indexes: [
        { fields: ["user_id"] },
        { fields: ["admin_id"] },
        { fields: ["type"] },
        { fields: ["created_at"] }
    ]
});
User_1.User.hasMany(BalanceAdjustment, { foreignKey: "user_id" });
BalanceAdjustment.belongsTo(User_1.User, { foreignKey: "user_id" });
