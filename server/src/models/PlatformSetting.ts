import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export type PlatformSettingCategory = "bonus" | "performance" | "reconciliation" | "notifications" | "reporting";

export interface PlatformSettingAttributes {
  setting_id: string;
  category: PlatformSettingCategory;
  key: string;
  value: unknown;
  description: string;
  updated_by: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export type PlatformSettingCreationAttributes = Optional<
  PlatformSettingAttributes,
  "setting_id" | "value" | "description" | "updated_by" | "created_at" | "updated_at"
>;

export class PlatformSetting
  extends Model<PlatformSettingAttributes, PlatformSettingCreationAttributes>
  implements PlatformSettingAttributes
{
  public setting_id!: string;
  public category!: PlatformSettingCategory;
  public key!: string;
  public value!: unknown;
  public description!: string;
  public updated_by!: string | null;
  public readonly created_at!: Date;
  public updated_at!: Date;
}

PlatformSetting.init(
  {
    setting_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    category: { type: DataTypes.STRING, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "platform_settings",
    timestamps: false,
    indexes: [{ unique: true, fields: ["category", "key"] }]
  }
);
