"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MembershipHistory = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class MembershipHistory extends sequelize_1.Model {
}
exports.MembershipHistory = MembershipHistory;
MembershipHistory.init({
    history_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    from_tier_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    to_tier_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    qualifying_amount: { type: sequelize_1.DataTypes.DECIMAL(20, 2), allowNull: false },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    source: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "automatic" },
    actor_admin_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "membership_histories",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { fields: ["created_at"] }]
});
