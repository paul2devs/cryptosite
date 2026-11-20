"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDelivery = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class NotificationDelivery extends sequelize_1.Model {
}
exports.NotificationDelivery = NotificationDelivery;
NotificationDelivery.init({
    delivery_id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    idempotency_key: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    channel: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true
    },
    notification_type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: "sending"
    },
    attempts: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    last_error: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    sent_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },
    created_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    },
    updated_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "notification_deliveries",
    timestamps: false,
    indexes: [{ fields: ["idempotency_key"], unique: true }, { fields: ["user_id"] }]
});
NotificationDelivery.belongsTo(User_1.User, { foreignKey: "user_id" });
