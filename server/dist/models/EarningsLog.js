"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EarningsLog = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class EarningsLog extends sequelize_1.Model {
}
exports.EarningsLog = EarningsLog;
EarningsLog.init({
    earning_id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    deposit_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    earned_amount: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false
    },
    tick_type: {
        type: sequelize_1.DataTypes.ENUM("hourly", "daily"),
        allowNull: false
    },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "earnings_logs",
    timestamps: false,
    indexes: [
        { fields: ["user_id"] },
        { fields: ["deposit_id"] },
        { fields: ["timestamp"] }
    ]
});
