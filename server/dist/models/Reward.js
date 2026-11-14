"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reward = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Reward extends sequelize_1.Model {
}
exports.Reward = Reward;
Reward.init({
    reward_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: false, defaultValue: "" },
    category: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "promotional" },
    amount: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    asset: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "USDT" },
    requirement_type: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "manual" },
    requirement_amount: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    requirement_count: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    requirement_tier_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    max_redemptions: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    priority: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    expires_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    created_by: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    updated_by: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "rewards",
    timestamps: false,
    indexes: [{ fields: ["active"] }, { fields: ["category"] }, { fields: ["priority"] }]
});
