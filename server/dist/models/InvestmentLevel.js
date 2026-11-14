"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestmentLevel = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class InvestmentLevel extends sequelize_1.Model {
}
exports.InvestmentLevel = InvestmentLevel;
InvestmentLevel.init({
    level_config_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    level_number: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    qualification_metric: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "invested_principal_usd" },
    qualification_threshold: { type: sequelize_1.DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: "0.00" },
    icon: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "level" },
    theme: { type: sequelize_1.DataTypes.JSONB, allowNull: false, defaultValue: { accent: "#C6A15B" } },
    sort_order: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    effective_from: { type: sequelize_1.DataTypes.DATE, allowNull: true, defaultValue: null },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "investment_levels",
    timestamps: false,
    indexes: [{ fields: ["active"] }, { fields: ["sort_order"] }]
});
