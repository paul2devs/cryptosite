"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserBehaviorScore = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class UserBehaviorScore extends sequelize_1.Model {
}
exports.UserBehaviorScore = UserBehaviorScore;
UserBehaviorScore.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false,
        unique: true
    },
    score: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 50
    },
    risk_level: {
        type: sequelize_1.DataTypes.ENUM("low", "medium", "high"),
        allowNull: false,
        defaultValue: "low"
    },
    updated_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "user_behavior_score",
    timestamps: false,
    indexes: [{ fields: ["risk_level"] }]
});
User_1.User.hasOne(UserBehaviorScore, { foreignKey: "user_id" });
UserBehaviorScore.belongsTo(User_1.User, { foreignKey: "user_id" });
