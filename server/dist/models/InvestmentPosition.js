"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestmentPosition = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class InvestmentPosition extends sequelize_1.Model {
}
exports.InvestmentPosition = InvestmentPosition;
InvestmentPosition.init({
    position_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    // Nullable so an administrator can allocate principal into a new position without a
    // deposit. Deposit-backed positions still set it and the unique index is preserved.
    deposit_id: { type: sequelize_1.DataTypes.UUID, allowNull: true, unique: true },
    asset: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    principal: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    strategy: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "custody_hold" },
    status: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "active" },
    verification_status: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "unavailable" },
    current_valuation: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: true },
    last_calculated_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, { sequelize: database_1.sequelize, tableName: "investment_positions", timestamps: false, indexes: [{ fields: ["user_id"] }] });
