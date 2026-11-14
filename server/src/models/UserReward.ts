import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";
import { Reward } from "./Reward";

export interface UserRewardAttributes {
  user_reward_id: string;
  user_id: string;
  reward_id: string | null;
  reward_name: string;
  category: string;
  amount: string;
  asset: string;
  status: string;
  reference: string;
  ledger_idempotency_key: string;
  grant_source: string;
  grant_reason: string;
  granted_by: string | null;
  granted_at: Date;
  expires_at: Date | null;
  redemption_reference: string | null;
  redemption_ledger_key: string | null;
  redeemed_at: Date | null;
  revoked_by: string | null;
  revoked_at: Date | null;
  revoke_reason: string | null;
  metadata: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

export type UserRewardCreationAttributes = Optional<
  UserRewardAttributes,
  | "user_reward_id"
  | "reward_id"
  | "status"
  | "grant_source"
  | "grant_reason"
  | "granted_by"
  | "granted_at"
  | "expires_at"
  | "redemption_reference"
  | "redemption_ledger_key"
  | "redeemed_at"
  | "revoked_by"
  | "revoked_at"
  | "revoke_reason"
  | "metadata"
  | "created_at"
  | "updated_at"
>;

export class UserReward
  extends Model<UserRewardAttributes, UserRewardCreationAttributes>
  implements UserRewardAttributes
{
  public user_reward_id!: string;
  public user_id!: string;
  public reward_id!: string | null;
  public reward_name!: string;
  public category!: string;
  public amount!: string;
  public asset!: string;
  public status!: string;
  public reference!: string;
  public ledger_idempotency_key!: string;
  public grant_source!: string;
  public grant_reason!: string;
  public granted_by!: string | null;
  public granted_at!: Date;
  public expires_at!: Date | null;
  public redemption_reference!: string | null;
  public redemption_ledger_key!: string | null;
  public redeemed_at!: Date | null;
  public revoked_by!: string | null;
  public revoked_at!: Date | null;
  public revoke_reason!: string | null;
  public metadata!: Record<string, unknown>;
  public readonly created_at!: Date;
  public updated_at!: Date;
}

UserReward.init(
  {
    user_reward_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    reward_id: { type: DataTypes.UUID, allowNull: true },
    reward_name: { type: DataTypes.STRING, allowNull: false },
    category: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    asset: { type: DataTypes.STRING, allowNull: false, defaultValue: "USDT" },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "available" },
    reference: { type: DataTypes.STRING, allowNull: false },
    ledger_idempotency_key: { type: DataTypes.STRING, allowNull: false, unique: true },
    grant_source: { type: DataTypes.STRING, allowNull: false, defaultValue: "automated" },
    grant_reason: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    granted_by: { type: DataTypes.UUID, allowNull: true },
    granted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    redemption_reference: { type: DataTypes.STRING, allowNull: true },
    redemption_ledger_key: { type: DataTypes.STRING, allowNull: true, unique: true },
    redeemed_at: { type: DataTypes.DATE, allowNull: true },
    revoked_by: { type: DataTypes.UUID, allowNull: true },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
    revoke_reason: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "user_rewards",
    timestamps: false,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["reward_id"] },
      { fields: ["status"] },
      { fields: ["created_at"] },
      { unique: true, fields: ["user_id", "reward_id"] }
    ]
  }
);

User.hasMany(UserReward, { foreignKey: "user_id" });
UserReward.belongsTo(User, { foreignKey: "user_id" });
Reward.hasMany(UserReward, { foreignKey: "reward_id" });
UserReward.belongsTo(Reward, { foreignKey: "reward_id" });
