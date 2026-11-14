"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipTier = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class MembershipTier extends sequelize_1.Model {
}
exports.MembershipTier = MembershipTier;
MembershipTier.init({
    tier_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    min_amount: { type: sequelize_1.DataTypes.DECIMAL(20, 2), allowNull: false },
    max_amount: { type: sequelize_1.DataTypes.DECIMAL(20, 2), allowNull: true },
    benefits: { type: sequelize_1.DataTypes.JSONB, allowNull: false, defaultValue: [] },
    icon: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "tier" },
    theme: { type: sequelize_1.DataTypes.JSONB, allowNull: false, defaultValue: { accent: "#C6A15B" } },
    sort_order: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, { sequelize: database_1.sequelize, tableName: "membership_tiers", timestamps: false });
