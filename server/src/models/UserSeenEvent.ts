import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface UserSeenEventAttributes {
  id: string;
  user_id: string;
  event_id: string;
  seen_at?: Date;
}

export type UserSeenEventCreationAttributes = Optional<
  UserSeenEventAttributes,
  "id" | "seen_at"
>;

export class UserSeenEvent
  extends Model<UserSeenEventAttributes, UserSeenEventCreationAttributes>
  implements UserSeenEventAttributes
{
  public id!: string;
  public user_id!: string;
  public event_id!: string;
  public seen_at!: Date;
}

UserSeenEvent.init(
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
    event_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "user_seen_events",
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "event_id"]
      }
    ]
  }
);

