"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerAccount = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class LedgerAccount extends sequelize_1.Model {
}
exports.LedgerAccount = LedgerAccount;
LedgerAccount.init({
    account_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    code: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    asset: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "ledger_accounts",
    timestamps: false,
    indexes: [{ unique: true, fields: ["user_id", "code", "asset"] }]
});
