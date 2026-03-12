"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivityEvent = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class UserActivityEvent extends sequelize_1.Model {
}
exports.UserActivityEvent = UserActivityEvent;
UserActivityEvent.init({
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
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    metadata: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    },
    timestamp: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "user_activity_events",
    timestamps: false,
    indexes: [
        {
            fields: ["user_id"]
        },
        {
            fields: ["timestamp"]
        },
        {
            fields: ["type"]
        }
    ]
});
User_1.User.hasMany(UserActivityEvent, { foreignKey: "user_id", as: "activityEvents" });
UserActivityEvent.belongsTo(User_1.User, { foreignKey: "user_id" });
