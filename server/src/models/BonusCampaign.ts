import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface BonusEligibilityRules {
  minMembershipTierId?: string | null;
  minInvestedAmount?: string | null;
  newUsersOnly?: boolean;
  requiredReferral?: boolean;
}

export interface BonusCampaignAttributes {
  campaign_id: string;
  name: string;
  description: string;
  percentage: string;
  min_deposit: string;
  max_bonus: string | null;
  eligible_assets: string[] | null;
  starts_at: Date | null;
  ends_at: Date | null;
  active: boolean;
  priority: number;
  eligibility: BonusEligibilityRules;
  created_by: string | null;
  updated_by: string | null;
  created_at?: Date;
  updated_at?: Date;
}

export type BonusCampaignCreationAttributes = Optional<
  BonusCampaignAttributes,
  | "campaign_id"
  | "description"
  | "min_deposit"
  | "max_bonus"
  | "eligible_assets"
  | "starts_at"
  | "ends_at"
  | "active"
  | "priority"
  | "eligibility"
  | "created_by"
  | "updated_by"
  | "created_at"
  | "updated_at"
>;

export class BonusCampaign
  extends Model<BonusCampaignAttributes, BonusCampaignCreationAttributes>
  implements BonusCampaignAttributes
{
  public campaign_id!: string;
  public name!: string;
  public description!: string;
  public percentage!: string;
  public min_deposit!: string;
  public max_bonus!: string | null;
  public eligible_assets!: string[] | null;
  public starts_at!: Date | null;
  public ends_at!: Date | null;
  public active!: boolean;
  public priority!: number;
  public eligibility!: BonusEligibilityRules;
  public created_by!: string | null;
  public updated_by!: string | null;
  public readonly created_at!: Date;
  public updated_at!: Date;
}

BonusCampaign.init(
  {
    campaign_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    percentage: { type: DataTypes.DECIMAL(20, 6), allowNull: false, defaultValue: "0.000000" },
    min_deposit: { type: DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    max_bonus: { type: DataTypes.DECIMAL(36, 8), allowNull: true },
    eligible_assets: { type: DataTypes.JSONB, allowNull: true },
    starts_at: { type: DataTypes.DATE, allowNull: true },
    ends_at: { type: DataTypes.DATE, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    eligibility: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_by: { type: DataTypes.UUID, allowNull: true },
    updated_by: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "bonus_campaigns",
    timestamps: false,
    indexes: [{ fields: ["active"] }, { fields: ["priority"] }]
  }
);
