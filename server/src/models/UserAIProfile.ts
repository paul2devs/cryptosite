import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export interface UserAIProfileAttributes {
  user_id: string;
  deposit_pattern_score: number;
  engagement_score: number;
  churn_risk_score: number;
  optimal_bonus_type: string | null;
  last_ai_update?: Date | null;
}

export type UserAIProfileCreationAttributes = Optional<
  UserAIProfileAttributes,
  "deposit_pattern_score" | "engagement_score" | "churn_risk_score" | "optimal_bonus_type" | "last_ai_update"
>;

export class UserAIProfile
  extends Model<UserAIProfileAttributes, UserAIProfileCreationAttributes>
  implements UserAIProfileAttributes
{
  public user_id!: string;
  public deposit_pattern_score!: number;
  public engagement_score!: number;
  public churn_risk_score!: number;
  public optimal_bonus_type!: string | null;
  public last_ai_update!: Date | null;
}

UserAIProfile.init(
  {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: {
        model: "users",
        key: "user_id"
      },
      onDelete: "CASCADE"
    },
    deposit_pattern_score: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    engagement_score: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    churn_risk_score: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    optimal_bonus_type: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    last_ai_update: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  },
  {
    sequelize,
    tableName: "user_ai_profile",
    timestamps: false
  }
);

User.hasOne(UserAIProfile, { foreignKey: "user_id" });
UserAIProfile.belongsTo(User, { foreignKey: "user_id" });

