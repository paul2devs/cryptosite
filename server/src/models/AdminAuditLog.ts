import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface AdminAuditLogAttributes {
  audit_id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  metadata: unknown;
  created_at?: Date;
}

export type AdminAuditLogCreationAttributes = Optional<AdminAuditLogAttributes, "audit_id" | "metadata" | "created_at">;

export class AdminAuditLog
  extends Model<AdminAuditLogAttributes, AdminAuditLogCreationAttributes>
  implements AdminAuditLogAttributes
{
  public audit_id!: string;
  public admin_id!: string;
  public action!: string;
  public entity_type!: string;
  public entity_id!: string;
  public reason!: string;
  public metadata!: unknown;
  public readonly created_at!: Date;
}

AdminAuditLog.init(
  {
    audit_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    admin_id: { type: DataTypes.UUID, allowNull: false },
    action: { type: DataTypes.STRING, allowNull: false },
    entity_type: { type: DataTypes.STRING, allowNull: false },
    entity_id: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: "admin_audit_logs", timestamps: false, indexes: [{ fields: ["created_at"] }, { fields: ["admin_id"] }] }
);
