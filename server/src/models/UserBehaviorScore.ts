import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export type BehaviorRiskLevel = "low" | "medium" | "high";

export interface UserBehaviorScoreAttributes {
  id: string;
  user_id: string;
  score: number;
  risk_level: BehaviorRiskLevel;
  updated_at?: Date;
}

export type UserBehaviorScoreCreationAttributes = Optional<
  UserBehaviorScoreAttributes,
  "id" | "score" | "risk_level" | "updated_at"
>;

export class UserBehaviorScore
  extends Model<UserBehaviorScoreAttributes, UserBehaviorScoreCreationAttributes>
  implements UserBehaviorScoreAttributes
{
  public id!: string;
  public user_id!: string;
  public score!: number;
  public risk_level!: BehaviorRiskLevel;
  public updated_at!: Date;
}

UserBehaviorScore.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    score: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 50
    },
    risk_level: {
      type: DataTypes.ENUM("low", "medium", "high"),
      allowNull: false,
      defaultValue: "low"
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "user_behavior_score",
    timestamps: false,
    indexes: [{ fields: ["risk_level"] }]
  }
);

User.hasOne(UserBehaviorScore, { foreignKey: "user_id" });
UserBehaviorScore.belongsTo(User, { foreignKey: "user_id" });

