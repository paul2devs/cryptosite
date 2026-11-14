"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipBenefit = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const MembershipTier_1 = require("./MembershipTier");
class MembershipBenefit extends sequelize_1.Model {
}
exports.MembershipBenefit = MembershipBenefit;
MembershipBenefit.init({
    benefit_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    tier_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    code: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    available: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    requires_activation: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: sequelize_1.DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: { type: sequelize_1.DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, { sequelize: database_1.sequelize, tableName: "membership_benefits", timestamps: false, indexes: [{ fields: ["tier_id"] }, { fields: ["active"] }] });
MembershipTier_1.MembershipTier.hasMany(MembershipBenefit, { foreignKey: "tier_id", as: "benefitRows" });
MembershipBenefit.belongsTo(MembershipTier_1.MembershipTier, { foreignKey: "tier_id" });
