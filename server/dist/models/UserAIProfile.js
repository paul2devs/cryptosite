"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAIProfile = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class UserAIProfile extends sequelize_1.Model {
}
exports.UserAIProfile = UserAIProfile;
UserAIProfile.init({
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        references: {
            model: "users",
            key: "user_id"
        },
        onDelete: "CASCADE"
    },
    deposit_pattern_score: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
    },
    engagement_score: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
    },
    churn_risk_score: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
    },
    optimal_bonus_type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    last_ai_update: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "user_ai_profile",
    timestamps: false
});
User_1.User.hasOne(UserAIProfile, { foreignKey: "user_id" });
UserAIProfile.belongsTo(User_1.User, { foreignKey: "user_id" });
