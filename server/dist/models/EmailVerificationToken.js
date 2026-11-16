"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailVerificationToken = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const User_1 = require("./User");
/**
 * Stores the SHA-256 hash of a single-use email verification token.
 *
 * The raw token never touches the database: it is only ever sent to the user's
 * inbox. A record is considered valid while `used_at` is null and `expires_at`
 * is in the future.
 */
class EmailVerificationToken extends sequelize_1.Model {
}
exports.EmailVerificationToken = EmailVerificationToken;
EmailVerificationToken.init({
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
    tableName: "email_verification_tokens",
    timestamps: false,
    indexes: [
        { fields: ["user_id"] },
        { fields: ["token_hash"], unique: true },
        { fields: ["expires_at"] },
        { fields: ["used_at"] }
    ]
});
EmailVerificationToken.belongsTo(User_1.User, { foreignKey: "user_id" });
User_1.User.hasMany(EmailVerificationToken, { foreignKey: "user_id" });
