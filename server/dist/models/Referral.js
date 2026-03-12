"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Referral = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class Referral extends sequelize_1.Model {
}
exports.Referral = Referral;
Referral.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    referrer_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    referred_user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    created_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "referrals",
    timestamps: false,
    indexes: [
        {
            fields: ["referrer_id"]
        },
        {
            fields: ["referred_user_id"],
            unique: true
        }
    ]
});
User_1.User.hasMany(Referral, { foreignKey: "referrer_id", as: "referrals" });
Referral.belongsTo(User_1.User, { foreignKey: "referrer_id", as: "referrer" });
Referral.belongsTo(User_1.User, { foreignKey: "referred_user_id", as: "referredUser" });
