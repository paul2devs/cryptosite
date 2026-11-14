"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformSetting = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class PlatformSetting extends sequelize_1.Model {
}
exports.PlatformSetting = PlatformSetting;
PlatformSetting.init({
    setting_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    category: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    key: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    value: { type: sequelize_1.DataTypes.JSONB, allowNull: false, defaultValue: {} },
    description: { type: sequelize_1.DataTypes.TEXT, allowNull: false, defaultValue: "" },
    updated_by: { type: sequelize_1.DataTypes.UUID, allowNull: true },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW },
    updated_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, {
    sequelize: database_1.sequelize,
    tableName: "platform_settings",
    timestamps: false,
    indexes: [{ unique: true, fields: ["category", "key"] }]
});
