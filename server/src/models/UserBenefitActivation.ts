import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";
import { MembershipBenefit } from "./MembershipBenefit";

export interface UserBenefitActivationAttributes {
  user_id: string;
  benefit_id: string;
  activated_at: Date;
  note: string;
}

export type UserBenefitActivationCreationAttributes = Optional<
  UserBenefitActivationAttributes,
  "activated_at" | "note"
>;

export class UserBenefitActivation
  extends Model<UserBenefitActivationAttributes, UserBenefitActivationCreationAttributes>
  implements UserBenefitActivationAttributes
{
  public user_id!: string;
  public benefit_id!: string;
  public activated_at!: Date;
  public note!: string;
}

UserBenefitActivation.init(
  {
    user_id: { type: DataTypes.UUID, primaryKey: true },
    benefit_id: { type: DataTypes.UUID, primaryKey: true },
    activated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    note: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" }
  },
  {
    sequelize,
    tableName: "user_benefit_activations",
    timestamps: false,
    indexes: [{ fields: ["benefit_id"] }]
  }
);

User.hasMany(UserBenefitActivation, { foreignKey: "user_id", as: "benefitActivations" });
UserBenefitActivation.belongsTo(User, { foreignKey: "user_id" });
UserBenefitActivation.belongsTo(MembershipBenefit, { foreignKey: "benefit_id" });
