import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface MembershipTierAttributes {
  tier_id: string;
  name: string;
  description: string;
  min_amount: string;
  max_amount: string | null;
  benefits: string[];
  icon: string;
  theme: { accent: string };
  sort_order: number;
  active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type MembershipTierCreationAttributes = Optional<
  MembershipTierAttributes,
  "tier_id" | "benefits" | "icon" | "theme" | "active" | "max_amount" | "created_at" | "updated_at"
>;

export class MembershipTier
  extends Model<MembershipTierAttributes, MembershipTierCreationAttributes>
  implements MembershipTierAttributes
{
  public tier_id!: string;
  public name!: string;
  public description!: string;
  public min_amount!: string;
  public max_amount!: string | null;
  public benefits!: string[];
  public icon!: string;
  public theme!: { accent: string };
  public sort_order!: number;
  public active!: boolean;
  public readonly created_at!: Date;
  public updated_at!: Date;
}

MembershipTier.init(
  {
    tier_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: false },
    min_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false },
    max_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
    benefits: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    icon: { type: DataTypes.STRING, allowNull: false, defaultValue: "tier" },
    theme: { type: DataTypes.JSONB, allowNull: false, defaultValue: { accent: "#C6A15B" } },
    sort_order: { type: DataTypes.INTEGER, allowNull: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: "membership_tiers", timestamps: false }
);
