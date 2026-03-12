"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetToken = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
class PasswordResetToken extends sequelize_1.Model {
}
exports.PasswordResetToken = PasswordResetToken;
PasswordResetToken.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    token_hash: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    expires_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false
    },
    used_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },
    created_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "password_reset_tokens",
    timestamps: false,
    indexes: [
        { fields: ["user_id"] },
        { fields: ["token_hash"], unique: true },
        { fields: ["expires_at"] },
        { fields: ["used_at"] }
    ]
});
PasswordResetToken.belongsTo(User_1.User, { foreignKey: "user_id" });
User_1.User.hasMany(PasswordResetToken, { foreignKey: "user_id" });
