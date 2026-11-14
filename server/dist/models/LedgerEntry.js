"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerEntry = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class LedgerEntry extends sequelize_1.Model {
}
exports.LedgerEntry = LedgerEntry;
LedgerEntry.init({
    entry_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    account_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    direction: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    asset: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    transaction_type: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    source_type: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    source_id: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    idempotency_key: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "ledger_entries",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { fields: ["source_type", "source_id"] }, { fields: ["created_at"] }]
});
