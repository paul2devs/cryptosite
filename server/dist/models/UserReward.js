"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserReward = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
const Reward_1 = require("./Reward");
class UserReward extends sequelize_1.Model {
}
exports.UserReward = UserReward;
UserReward.init({
    user_reward_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    reward_id: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    reward_name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    category: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    amount: { type: sequelize_1.DataTypes.DECIMAL(36, 8), allowNull: false },
    asset: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "USDT" },
    status: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "available" },
    reference: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    ledger_idempotency_key: { type: sequelize_1.DataTypes.STRING, allowNull: false, unique: true },
    grant_source: { type: sequelize_1.DataTypes.STRING, allowNull: false, defaultValue: "automated" },
    grant_reason: { type: sequelize_1.DataTypes.TEXT, allowNull: false, defaultValue: "" },
    granted_by: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    granted_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    expires_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    redemption_reference: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    redemption_ledger_key: { type: sequelize_1.DataTypes.STRING, allowNull: true, unique: true },
    redeemed_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    revoked_by: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    revoked_at: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    revoke_reason: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    metadata: { type: sequelize_1.DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "user_rewards",
    timestamps: false,
    indexes: [
        { fields: ["user_id"] },
        { fields: ["reward_id"] },
        { fields: ["status"] },
        { fields: ["created_at"] },
        { unique: true, fields: ["user_id", "reward_id"] }
    ]
});
User_1.User.hasMany(UserReward, { foreignKey: "user_id" });
UserReward.belongsTo(User_1.User, { foreignKey: "user_id" });
Reward_1.Reward.hasMany(UserReward, { foreignKey: "reward_id" });
UserReward.belongsTo(Reward_1.Reward, { foreignKey: "reward_id" });
