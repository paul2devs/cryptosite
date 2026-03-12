"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BonusOptimizationLog = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class BonusOptimizationLog extends sequelize_1.Model {
}
exports.BonusOptimizationLog = BonusOptimizationLog;
BonusOptimizationLog.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    },
    adjustment_type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    reason: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    impact: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "bonus_optimization_logs",
    timestamps: false
});
