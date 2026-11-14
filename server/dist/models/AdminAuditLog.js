"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuditLog = void 0;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
class AdminAuditLog extends sequelize_1.Model {
}
exports.AdminAuditLog = AdminAuditLog;
AdminAuditLog.init({
    audit_id: { type: sequelize_1.DataTypes.UUID, defaultValue: sequelize_1.DataTypes.UUIDV4, primaryKey: true },
    admin_id: { type: sequelize_1.DataTypes.UUID, allowNull: false },
    action: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    entity_type: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    entity_id: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    reason: { type: sequelize_1.DataTypes.TEXT, allowNull: false },
    metadata: { type: sequelize_1.DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: sequelize_1.DataTypes.DATE, allowNull: false, defaultValue: sequelize_1.DataTypes.NOW }
}, { sequelize: database_1.sequelize, tableName: "admin_audit_logs", timestamps: false, indexes: [{ fields: ["created_at"] }, { fields: ["admin_id"] }] });
