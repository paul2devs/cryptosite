import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export type UserActivityType =
  | "login"
  | "logout"
  | "deposit"
  | "deposit_confirmed"
  | "deposit_submitted"
  | "deposit_rejected"
  | "withdrawal"
  | "withdrawal_reviewed"
  | "notification_click"
  | "password_reset_request"
  | "password_reset_complete"
  | "password_changed"
  | "email_verification_request"
  | "email_verified"
  | "membership_upgrade"
  | "configuration_change"
  | "performance_unavailable"
  | "investment_allocation"
  | "promotional_bonus"
  | "reward_granted"
  | "reward_redeemed"
  | "reward_revoked"
  | "admin_action";

export interface UserActivityEventAttributes {
  id: string;
  user_id: string;
  type: UserActivityType;
  metadata: unknown;
  timestamp?: Date;
}

export type UserActivityEventCreationAttributes = Optional<
  UserActivityEventAttributes,
  "id" | "metadata" | "timestamp"
>;

export class UserActivityEvent
  extends Model<UserActivityEventAttributes, UserActivityEventCreationAttributes>
  implements UserActivityEventAttributes
{
  public id!: string;
  public user_id!: string;
  public type!: UserActivityType;
  public metadata!: unknown;
  public timestamp!: Date;
}

UserActivityEvent.init(
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
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "user_activity_events",
    timestamps: false,
    indexes: [
      {
        fields: ["user_id"]
      },
      {
        fields: ["timestamp"]
      },
      {
        fields: ["type"]
      }
    ]
  }
);

User.hasMany(UserActivityEvent, { foreignKey: "user_id", as: "activityEvents" });
UserActivityEvent.belongsTo(User, { foreignKey: "user_id" });

