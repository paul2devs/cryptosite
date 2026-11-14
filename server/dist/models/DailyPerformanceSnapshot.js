"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyPerformanceSnapshot = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class DailyPerformanceSnapshot extends sequelize_1.Model {
}
exports.DailyPerformanceSnapshot = DailyPerformanceSnapshot;
DailyPerformanceSnapshot.init({
    snapshot_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    position_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    snapshot_date: { type: sequelize_1.DataTypes.DATEONLY, allowNull: false },
    opening_valuation: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    closing_valuation: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: true },
    cash_flow: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    profit_loss: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: true },
    roi_percent: { type: sequelize_1.DataTypes.DECIMAL(20, 6), allowNull: true },
    strategy: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    data_source: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    verification_status: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    correction_of: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "daily_performance_snapshots",
    timestamps: false,
    indexes: [
        { fields: ["user_id", "snapshot_date"] },
        {
            unique: true,
            fields: ["position_id", "snapshot_date"],
            where: { verification_status: "verified", correction_of: null }
        }
    ]
});
