"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSeenEvent = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class UserSeenEvent extends sequelize_1.Model {
}
exports.UserSeenEvent = UserSeenEvent;
UserSeenEvent.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    event_id: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    seen_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "user_seen_events",
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ["user_id", "event_id"]
        }
    ]
});
