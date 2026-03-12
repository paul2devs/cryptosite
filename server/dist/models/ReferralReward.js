"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralReward = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class ReferralReward extends sequelize_1.Model {
}
exports.ReferralReward = ReferralReward;
ReferralReward.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    referred_user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    reward_type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    reward_value: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false
    },
    status: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending"
    },
    created_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "referral_rewards",
    timestamps: false,
    indexes: [
        {
            fields: ["user_id"]
        },
        {
            fields: ["referred_user_id"]
        }
    ]
});
User_1.User.hasMany(ReferralReward, { foreignKey: "user_id", as: "referralRewards" });
ReferralReward.belongsTo(User_1.User, { foreignKey: "user_id", as: "rewardUser" });
