import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import type { RewardCategory, RewardRequirementType } from "../domain/rewardRules";

export interface RewardAttributes {
  reward_id: string;
  name: string;
  description: string;
  category: RewardCategory;
  amount: string;
  asset: string;
  requirement_type: RewardRequirementType;
  requirement_amount: string;
  requirement_count: number;
  requirement_tier_id: string | null;
  max_redemptions: number | null;
  active: boolean;
  priority: number;
  expires_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export type RewardCreationAttributes = Optional<
  RewardAttributes,
  | "reward_id"
  | "description"
  | "amount"
  | "asset"
  | "requirement_amount"
  | "requirement_count"
  | "requirement_tier_id"
  | "max_redemptions"
  | "active"
  | "priority"
  | "expires_at"
  | "created_by"
  | "updated_by"
  | "created_at"
  | "updated_at"
>;

export class Reward extends Model<RewardAttributes, RewardCreationAttributes> implements RewardAttributes {
  public reward_id!: string;
  public name!: string;
  public description!: string;
  public category!: RewardCategory;
  public amount!: string;
  public asset!: string;
  public requirement_type!: RewardRequirementType;
  public requirement_amount!: string;
  public requirement_count!: number;
  public requirement_tier_id!: string | null;
  public max_redemptions!: number | null;
  public active!: boolean;
  public priority!: number;
  public expires_at!: Date | null;
  public created_by!: string | null;
  public updated_by!: string | null;
  public readonly created_at!: Date;
  public updated_at!: Date;
}

Reward.init(
  {
    reward_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    category: { type: DataTypes.STRING, allowNull: false, defaultValue: "promotional" },
    amount: { type: DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    asset: { type: DataTypes.STRING, allowNull: false, defaultValue: "USDT" },
    requirement_type: { type: DataTypes.STRING, allowNull: false, defaultValue: "manual" },
    requirement_amount: { type: DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    requirement_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    requirement_tier_id: { type: DataTypes.UUID, allowNull: true },
    max_redemptions: { type: DataTypes.INTEGER, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "rewards",
    timestamps: false,
    indexes: [{ fields: ["active"] }, { fields: ["category"] }, { fields: ["priority"] }]
  }
);
