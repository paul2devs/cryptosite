"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserInvestmentLevelBenefit = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
const InvestmentLevelBenefit_1 = require("./InvestmentLevelBenefit");
class UserInvestmentLevelBenefit extends sequelize_1.Model {
}
exports.UserInvestmentLevelBenefit = UserInvestmentLevelBenefit;
UserInvestmentLevelBenefit.init({
    user_id: { type: sequelize_1.DataTypes.UUID, primaryKey: true },
    benefit_id: { type: sequelize_1.DataTypes.UUID, primaryKey: true },
    activated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    note: { type: sequelize_1.DataTypes.TEXT, allowNull: false, defaultValue: "" }
}, {
    sequelize: database_1.sequelize,
    tableName: "user_investment_level_benefit_activations",
    timestamps: false,
    indexes: [{ fields: ["benefit_id"] }]
});
User_1.User.hasMany(UserInvestmentLevelBenefit, { foreignKey: "user_id", as: "investmentBenefitActivations" });
UserInvestmentLevelBenefit.belongsTo(User_1.User, { foreignKey: "user_id" });
UserInvestmentLevelBenefit.belongsTo(InvestmentLevelBenefit_1.InvestmentLevelBenefit, { foreignKey: "benefit_id" });
