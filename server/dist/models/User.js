"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class User extends sequelize_1.Model {
}
exports.User = User;
User.init({
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    crypto_wallets: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    referral_code: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    referred_by: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: true
    },
    level: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    xp: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    streak: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    pending_earnings: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    },
    seen_notifications: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: []
    },
    is_admin: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    bonus_blocked: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    account_settings: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: {
            notifications: {
                deposit_updates: true,
                withdrawal_updates: true,
                rewards_bonuses: true,
                announcements: true
            },
            preferences: {
                language: "en"
            },
            withdrawal_wallets: []
        }
    },
    withdrawable_balance: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
    },
    locked_balance: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false,
        defaultValue: 0
    },
    last_withdrawal_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        defaultValue: null
    },
    last_activity_at: {
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
    tableName: "users",
    timestamps: false
});
