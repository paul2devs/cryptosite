"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Level = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Level extends sequelize_1.Model {
}
exports.Level = Level;
Level.init({
    level_id: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true
    },
    level_name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    required_xp: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false
    },
    multiplier_base: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false
    },
    unlocks: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "levels",
    timestamps: false
});
