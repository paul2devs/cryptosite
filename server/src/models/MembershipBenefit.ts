import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { MembershipTier } from "./MembershipTier";

export interface MembershipBenefitAttributes {
  benefit_id: string;
  tier_id: string;
  code: string;
  name: string;
  description: string;
  available: boolean;
  requires_activation: boolean;
  sort_order: number;
  active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type MembershipBenefitCreationAttributes = Optional<
  MembershipBenefitAttributes,
  "benefit_id" | "available" | "requires_activation" | "sort_order" | "active" | "created_at" | "updated_at"
>;

export class MembershipBenefit
  extends Model<MembershipBenefitAttributes, MembershipBenefitCreationAttributes>
  implements MembershipBenefitAttributes
{
  public benefit_id!: string;
  public tier_id!: string;
  public code!: string;
  public name!: string;
  public description!: string;
  public available!: boolean;
  public requires_activation!: boolean;
  public sort_order!: number;
  public active!: boolean;
  public readonly created_at!: Date;
  public updated_at!: Date;
}

MembershipBenefit.init(
  {
    benefit_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tier_id: { type: DataTypes.UUID, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    available: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    requires_activation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: "membership_benefits", timestamps: false, indexes: [{ fields: ["tier_id"] }, { fields: ["active"] }] }
);

MembershipTier.hasMany(MembershipBenefit, { foreignKey: "tier_id", as: "benefitRows" });
MembershipBenefit.belongsTo(MembershipTier, { foreignKey: "tier_id" });
