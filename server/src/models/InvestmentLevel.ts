import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface InvestmentLevelAttributes {
  level_config_id: string;
  level_number: number;
  name: string;
  description: string;
  qualification_metric: string;
  qualification_threshold: string;
  icon: string;
  theme: { accent: string };
  sort_order: number;
  active: boolean;
  effective_from: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export type InvestmentLevelCreationAttributes = Optional<
  InvestmentLevelAttributes,
  | "level_config_id"
  | "qualification_metric"
  | "icon"
  | "theme"
  | "sort_order"
  | "active"
  | "effective_from"
  | "created_at"
  | "updated_at"
>;

export class InvestmentLevel
  extends Model<InvestmentLevelAttributes, InvestmentLevelCreationAttributes>
  implements InvestmentLevelAttributes
{
  public level_config_id!: string;
  public level_number!: number;
  public name!: string;
  public description!: string;
  public qualification_metric!: string;
  public qualification_threshold!: string;
  public icon!: string;
  public theme!: { accent: string };
  public sort_order!: number;
  public active!: boolean;
  public effective_from!: Date | null;
  public readonly created_at!: Date;
  public updated_at!: Date;
}

InvestmentLevel.init(
  {
    level_config_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    level_number: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    qualification_metric: { type: DataTypes.STRING, allowNull: false, defaultValue: "invested_principal_usd" },
    qualification_threshold: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: "0.00" },
    icon: { type: DataTypes.STRING, allowNull: false, defaultValue: "level" },
    theme: { type: DataTypes.JSONB, allowNull: false, defaultValue: { accent: "#C6A15B" } },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    effective_from: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "investment_levels",
    timestamps: false,
    indexes: [{ fields: ["active"] }, { fields: ["sort_order"] }]
  }
);
