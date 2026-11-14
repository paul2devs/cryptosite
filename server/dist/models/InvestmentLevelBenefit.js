"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestmentLevelBenefit = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const InvestmentLevel_1 = require("./InvestmentLevel");
class InvestmentLevelBenefit extends sequelize_1.Model {
}
exports.InvestmentLevelBenefit = InvestmentLevelBenefit;
InvestmentLevelBenefit.init({
    benefit_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    level_config_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    code: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    category: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "tools" },
    available: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    requires_activation: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "investment_level_benefits",
    timestamps: false,
    indexes: [{ fields: ["level_config_id"] }, { fields: ["active"] }]
});
InvestmentLevel_1.InvestmentLevel.hasMany(InvestmentLevelBenefit, { foreignKey: "level_config_id", as: "benefitRows" });
InvestmentLevelBenefit.belongsTo(InvestmentLevel_1.InvestmentLevel, { foreignKey: "level_config_id" });
