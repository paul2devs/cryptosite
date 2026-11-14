"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestmentLevelHistory = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class InvestmentLevelHistory extends sequelize_1.Model {
}
exports.InvestmentLevelHistory = InvestmentLevelHistory;
InvestmentLevelHistory.init({
    history_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    from_level_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    to_level_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    from_level_number: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    to_level_number: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    from_level_name: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    to_level_name: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    qualifying_amount: { type: sequelize_1.DataTypes.DECIMAL(20, 2), allowNull: false },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    source: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "automatic" },
    actor_admin_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "investment_level_histories",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { fields: ["created_at"] }]
});
