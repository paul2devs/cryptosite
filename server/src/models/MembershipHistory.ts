import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export type MembershipHistorySource = "automatic" | "admin" | "recalculation";

export interface MembershipHistoryAttributes {
  history_id: string;
  user_id: string;
  from_tier_id: string | null;
  to_tier_id: string | null;
  qualifying_amount: string;
  reason: string;
  source: MembershipHistorySource;
  actor_admin_id: string | null;
  created_at?: Date;
}

export type MembershipHistoryCreationAttributes = Optional<
  MembershipHistoryAttributes,
  "history_id" | "from_tier_id" | "to_tier_id" | "created_at" | "source" | "actor_admin_id"
>;

export class MembershipHistory
  extends Model<MembershipHistoryAttributes, MembershipHistoryCreationAttributes>
  implements MembershipHistoryAttributes
{
  public history_id!: string;
  public user_id!: string;
  public from_tier_id!: string | null;
  public to_tier_id!: string | null;
  public qualifying_amount!: string;
  public reason!: string;
  public source!: MembershipHistorySource;
  public actor_admin_id!: string | null;
  public readonly created_at!: Date;
}

MembershipHistory.init(
  {
    history_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    from_tier_id: { type: DataTypes.UUID, allowNull: true },
    to_tier_id: { type: DataTypes.UUID, allowNull: true },
    qualifying_amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    source: { type: DataTypes.STRING, allowNull: false, defaultValue: "automatic" },
    actor_admin_id: { type: DataTypes.UUID, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "membership_histories",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { fields: ["created_at"] }]
  }
);
