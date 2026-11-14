import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";
import { MembershipTier } from "./MembershipTier";

export interface UserMembershipAttributes {
  user_id: string;
  tier_id: string | null;
  qualifying_amount: string;
  achieved_at: Date;
  reason: string;
  manual_tier_id: string | null;
  manual_reason: string | null;
  manual_set_at: Date | null;
  updated_at?: Date;
}

export type UserMembershipCreationAttributes = Optional<
  UserMembershipAttributes,
  "tier_id" | "updated_at" | "manual_tier_id" | "manual_reason" | "manual_set_at"
>;

export class UserMembership
  extends Model<UserMembershipAttributes, UserMembershipCreationAttributes>
  implements UserMembershipAttributes
{
  public user_id!: string;
  public tier_id!: string | null;
  public qualifying_amount!: string;
  public achieved_at!: Date;
  public reason!: string;
  public manual_tier_id!: string | null;
  public manual_reason!: string | null;
  public manual_set_at!: Date | null;
  public updated_at!: Date;
}

UserMembership.init(
  {
    user_id: { type: DataTypes.UUID, primaryKey: true },
    tier_id: { type: DataTypes.UUID, allowNull: true },
    qualifying_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false, defaultValue: "0.00" },
    achieved_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reason: { type: DataTypes.TEXT, allowNull: false },
    manual_tier_id: { type: DataTypes.UUID, allowNull: true },
    manual_reason: { type: DataTypes.TEXT, allowNull: true },
    manual_set_at: { type: DataTypes.DATE, allowNull: true },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: "user_memberships", timestamps: false }
);

User.hasOne(UserMembership, { foreignKey: "user_id" });
UserMembership.belongsTo(User, { foreignKey: "user_id" });
UserMembership.belongsTo(MembershipTier, { foreignKey: "tier_id" });
