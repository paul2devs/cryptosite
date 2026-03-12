"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bonus = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class Bonus extends sequelize_1.Model {
}
exports.Bonus = Bonus;
Bonus.init({
    bonus_id: {
        type: sequelize_1.DataTypes.UUID,
        defaultValue: sequelize_1.DataTypes.UUIDV4,
        primaryKey: true
    },
    type: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    label: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false
    },
    multiplier: {
        type: sequelize_1.DataTypes.DOUBLE,
        allowNull: false
    },
    start_time: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false
    },
    end_time: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false
    },
    conditions: {
        type: sequelize_1.DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    },
    is_active: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    sequelize: database_1.sequelize,
    tableName: "bonuses",
    timestamps: false
});
