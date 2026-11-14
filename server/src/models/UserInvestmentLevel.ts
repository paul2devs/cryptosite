import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";
import { InvestmentLevel } from "./InvestmentLevel";

export interface UserInvestmentLevelAttributes {
  user_id: string;
  level_config_id: string | null;
  qualifying_amount: string;
  achieved_at: Date;
  reason: string;
  manual_level_id: string | null;
  manual_reason: string | null;
  manual_set_at: Date | null;
  updated_at?: Date;
}

export type UserInvestmentLevelCreationAttributes = Optional<
  UserInvestmentLevelAttributes,
  "level_config_id" | "updated_at" | "manual_level_id" | "manual_reason" | "manual_set_at"
>;

export class UserInvestmentLevel
  extends Model<UserInvestmentLevelAttributes, UserInvestmentLevelCreationAttributes>
  implements UserInvestmentLevelAttributes
{
  public user_id!: string;
  public level_config_id!: string | null;
  public qualifying_amount!: string;
  public achieved_at!: Date;
  public reason!: string;
  public manual_level_id!: string | null;
  public manual_reason!: string | null;
  public manual_set_at!: Date | null;
  public updated_at!: Date;
}

UserInvestmentLevel.init(
  {
    user_id: { type: DataTypes.UUID, primaryKey: true },
    level_config_id: { type: DataTypes.UUID, allowNull: true },
    qualifying_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: "0.00" },
    achieved_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reason: { type: DataTypes.TEXT, allowNull: false },
    manual_level_id: { type: DataTypes.UUID, allowNull: true },
    manual_reason: { type: DataTypes.TEXT, allowNull: true },
    manual_set_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: "user_investment_levels", timestamps: false }
);

User.hasOne(UserInvestmentLevel, { foreignKey: "user_id" });
UserInvestmentLevel.belongsTo(User, { foreignKey: "user_id" });
UserInvestmentLevel.belongsTo(InvestmentLevel, { foreignKey: "level_config_id" });
