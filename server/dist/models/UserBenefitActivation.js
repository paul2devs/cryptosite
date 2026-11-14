"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserBenefitActivation = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
const MembershipBenefit_1 = require("./MembershipBenefit");
class UserBenefitActivation extends sequelize_1.Model {
}
exports.UserBenefitActivation = UserBenefitActivation;
UserBenefitActivation.init({
    user_id: { type: sequelize_1.DataTypes.UUID, primaryKey: true },
    benefit_id: { type: sequelize_1.DataTypes.UUID, primaryKey: true },
    activated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    note: { type: sequelize_1.DataTypes.TEXT, allowNull: false, defaultValue: "" }
}, {
    sequelize: database_1.sequelize,
    tableName: "user_benefit_activations",
    timestamps: false,
    indexes: [{ fields: ["benefit_id"] }]
});
User_1.User.hasMany(UserBenefitActivation, { foreignKey: "user_id", as: "benefitActivations" });
UserBenefitActivation.belongsTo(User_1.User, { foreignKey: "user_id" });
UserBenefitActivation.belongsTo(MembershipBenefit_1.MembershipBenefit, { foreignKey: "benefit_id" });
