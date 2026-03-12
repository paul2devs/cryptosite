import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export type ReferralRewardStatus = "pending" | "earned" | "blocked";
export type ReferralRewardType = "referrer_multiplier" | "referee_boost";

export interface ReferralRewardAttributes {
  id: string;
  user_id: string;
  referred_user_id: string;
  reward_type: ReferralRewardType;
  reward_value: number;
  status: ReferralRewardStatus;
  created_at?: Date;
}

export type ReferralRewardCreationAttributes = Optional<
  ReferralRewardAttributes,
  "id" | "status" | "created_at"
>;

export class ReferralReward
  extends Model<ReferralRewardAttributes, ReferralRewardCreationAttributes>
  implements ReferralRewardAttributes
{
  public id!: string;
  public user_id!: string;
  public referred_user_id!: string;
  public reward_type!: ReferralRewardType;
  public reward_value!: number;
  public status!: ReferralRewardStatus;
  public created_at!: Date;
}

ReferralReward.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    referred_user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    reward_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    reward_value: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending"
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "referral_rewards",
    timestamps: false,
    indexes: [
      {
        fields: ["user_id"]
      },
      {
        fields: ["referred_user_id"]
      }
    ]
  }
);

User.hasMany(ReferralReward, { foreignKey: "user_id", as: "referralRewards" });
ReferralReward.belongsTo(User, { foreignKey: "user_id", as: "rewardUser" });

