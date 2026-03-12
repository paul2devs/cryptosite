"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChurnPrediction = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class ChurnPrediction extends sequelize_1.Model {
}
exports.ChurnPrediction = ChurnPrediction;
ChurnPrediction.init({
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
    risk_level: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: "low"
    },
    probability_score: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
    },
    last_detected: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "churn_predictions",
    timestamps: false
});
User_1.User.hasOne(ChurnPrediction, { foreignKey: "user_id" });
ChurnPrediction.belongsTo(User_1.User, { foreignKey: "user_id" });
