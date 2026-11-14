"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceCalculationLog = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class PerformanceCalculationLog extends sequelize_1.Model {
}
exports.PerformanceCalculationLog = PerformanceCalculationLog;
PerformanceCalculationLog.init({
    log_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    position_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    snapshot_date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    outcome: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    message: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, { sequelize: database_1.sequelize, tableName: "performance_calculation_logs", timestamps: false, indexes: [{ fields: ["snapshot_date"] }] });
