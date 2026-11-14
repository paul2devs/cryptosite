import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";
import { InvestmentLevelBenefit } from "./InvestmentLevelBenefit";

export interface UserInvestmentLevelBenefitAttributes {
  user_id: string;
  benefit_id: string;
  activated_at: Date;
  note: string;
}

export type UserInvestmentLevelBenefitCreationAttributes = Optional<
  UserInvestmentLevelBenefitAttributes,
  "activated_at" | "note"
>;

export class UserInvestmentLevelBenefit
  extends Model<UserInvestmentLevelBenefitAttributes, UserInvestmentLevelBenefitCreationAttributes>
  implements UserInvestmentLevelBenefitAttributes
{
  public user_id!: string;
  public benefit_id!: string;
  public activated_at!: Date;
  public note!: string;
}

UserInvestmentLevelBenefit.init(
  {
    user_id: { type: DataTypes.UUID, primaryKey: true },
    benefit_id: { type: DataTypes.UUID, primaryKey: true },
    activated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    note: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" }
  },
  {
    sequelize,
    tableName: "user_investment_level_benefit_activations",
    timestamps: false,
    indexes: [{ fields: ["benefit_id"] }]
  }
);

User.hasMany(UserInvestmentLevelBenefit, { foreignKey: "user_id", as: "investmentBenefitActivations" });
UserInvestmentLevelBenefit.belongsTo(User, { foreignKey: "user_id" });
UserInvestmentLevelBenefit.belongsTo(InvestmentLevelBenefit, { foreignKey: "benefit_id" });
