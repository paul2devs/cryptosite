"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialFeedSeen = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class SocialFeedSeen extends sequelize_1.Model {
}
exports.SocialFeedSeen = SocialFeedSeen;
SocialFeedSeen.init({
    id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    deposit_id: {
        type: sequelize_1.DataTypes.UUID,
        allowNull: false
    },
    seen_at: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "social_feed_seen",
    timestamps: false,
    indexes: [
        {
            fields: ["user_id"]
        },
        {
            fields: ["deposit_id"]
        },
        {
            unique: true,
            fields: ["user_id", "deposit_id"]
        }
    ]
});
