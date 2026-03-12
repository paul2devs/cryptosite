"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActiveMultiplier = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class ActiveMultiplier extends sequelize_1.Model {
}
exports.ActiveMultiplier = ActiveMultiplier;
ActiveMultiplier.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    type: {
        type: sequelize_1.DataTypes.ENUM("level", "streak", "time_limited", "referral", "loyalty", "retention", "risk_adjustment"),
        allowNull: false
    },
    value: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false
    },
    expires_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false
    },
    created_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "active_multipliers",
    timestamps: false,
    indexes: [
        { fields: ["user_id"] },
        { fields: ["expires_at"] }
    ]
});
User_1.User.hasMany(ActiveMultiplier, { foreignKey: "user_id" });
ActiveMultiplier.belongsTo(User_1.User, { foreignKey: "user_id" });
