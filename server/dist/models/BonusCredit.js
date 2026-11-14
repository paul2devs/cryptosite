"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BonusCredit = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const Deposit_1 = require("./Deposit");
const User_1 = require("./User");
class BonusCredit extends sequelize_1.Model {
}
exports.BonusCredit = BonusCredit;
BonusCredit.init({
    credit_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    deposit_id: { type: sequelize_1.DataTypes.UUID, allowNull: false, unique: true },
    campaign_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    campaign_name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    percentage: { type: sequelize_1.DataTypes.DECIMAL(20, 6), allowNull: false },
    qualifying_amount: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    bonus_amount: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    asset: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    status: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "credited" },
    reference: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    ledger_idempotency_key: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: false, defaultValue: "Automated promotional bonus on a verified deposit." },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "bonus_credits",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { fields: ["campaign_id"] }, { fields: ["created_at"] }]
});
User_1.User.hasMany(BonusCredit, { foreignKey: "user_id" });
BonusCredit.belongsTo(User_1.User, { foreignKey: "user_id" });
Deposit_1.Deposit.hasOne(BonusCredit, { foreignKey: "deposit_id" });
BonusCredit.belongsTo(Deposit_1.Deposit, { foreignKey: "deposit_id" });
