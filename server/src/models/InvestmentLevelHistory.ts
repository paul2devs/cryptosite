import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export type InvestmentLevelHistorySource = "automatic" | "admin" | "recalculation";

export interface InvestmentLevelHistoryAttributes {
  history_id: string;
  user_id: string;
  from_level_id: string | null;
  to_level_id: string | null;
  from_level_number: number | null;
  to_level_number: number | null;
  from_level_name: string | null;
  to_level_name: string | null;
  qualifying_amount: string;
  reason: string;
  source: InvestmentLevelHistorySource;
  actor_admin_id: string | null;
  created_at?: Date;
}

export type InvestmentLevelHistoryCreationAttributes = Optional<
  InvestmentLevelHistoryAttributes,
  | "history_id"
  | "from_level_id"
  | "to_level_id"
  | "from_level_number"
  | "to_level_number"
  | "from_level_name"
  | "to_level_name"
  | "created_at"
  | "source"
  | "actor_admin_id"
>;

export class InvestmentLevelHistory
  extends Model<InvestmentLevelHistoryAttributes, InvestmentLevelHistoryCreationAttributes>
  implements InvestmentLevelHistoryAttributes
{
  public history_id!: string;
  public user_id!: string;
  public from_level_id!: string | null;
  public to_level_id!: string | null;
  public from_level_number!: number | null;
  public to_level_number!: number | null;
  public from_level_name!: string | null;
  public to_level_name!: string | null;
  public qualifying_amount!: string;
  public reason!: string;
  public source!: InvestmentLevelHistorySource;
  public actor_admin_id!: string | null;
  public readonly created_at!: Date;
}

InvestmentLevelHistory.init(
  {
    history_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    from_level_id: { type: DataTypes.UUID, allowNull: true },
    to_level_id: { type: DataTypes.UUID, allowNull: true },
    from_level_number: { type: DataTypes.INTEGER, allowNull: true },
    to_level_number: { type: DataTypes.INTEGER, allowNull: true },
    from_level_name: { type: DataTypes.STRING, allowNull: true },
    to_level_name: { type: DataTypes.STRING, allowNull: true },
    qualifying_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    source: { type: DataTypes.STRING, allowNull: false, defaultValue: "automatic" },
    actor_admin_id: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "investment_level_histories",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { fields: ["created_at"] }]
  }
);
