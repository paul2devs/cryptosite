"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInvestmentLevel = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
const InvestmentLevel_1 = require("./InvestmentLevel");
class UserInvestmentLevel extends sequelize_1.Model {
}
exports.UserInvestmentLevel = UserInvestmentLevel;
UserInvestmentLevel.init({
    user_id: { type: sequelize_1.DataTypes.UUID, primaryKey: true },
    level_config_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    qualifying_amount: { type: sequelize_1.DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: "0.00" },
    achieved_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    manual_level_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    manual_reason: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    manual_set_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, { sequelize: database_1.sequelize, tableName: "user_investment_levels", timestamps: false });
User_1.User.hasOne(UserInvestmentLevel, { foreignKey: "user_id" });
UserInvestmentLevel.belongsTo(User_1.User, { foreignKey: "user_id" });
UserInvestmentLevel.belongsTo(InvestmentLevel_1.InvestmentLevel, { foreignKey: "level_config_id" });
