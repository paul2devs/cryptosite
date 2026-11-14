"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BonusCampaign = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class BonusCampaign extends sequelize_1.Model {
}
exports.BonusCampaign = BonusCampaign;
BonusCampaign.init({
    campaign_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: false, defaultValue: "" },
    percentage: { type: sequelize_1.DataTypes.DECIMAL(20, 6), allowNull: false, defaultValue: "0.000000" },
    min_deposit: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    max_bonus: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: true },
    eligible_assets: { type: sequelize_1.DataTypes.JSONB, allowNull: true },
    starts_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    ends_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    priority: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    eligibility: { type: sequelize_1.DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_by: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    updated_by: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "bonus_campaigns",
    timestamps: false,
    indexes: [{ fields: ["active"] }, { fields: ["priority"] }]
});
