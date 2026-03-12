import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface SocialFeedSeenAttributes {
  id: string;
  user_id: string;
  deposit_id: string;
  seen_at?: Date;
}

export type SocialFeedSeenCreationAttributes = Optional<
  SocialFeedSeenAttributes,
  "id" | "seen_at"
>;

export class SocialFeedSeen
  extends Model<SocialFeedSeenAttributes, SocialFeedSeenCreationAttributes>
  implements SocialFeedSeenAttributes
{
  public id!: string;
  public user_id!: string;
  public deposit_id!: string;
  public seen_at!: Date;
}

SocialFeedSeen.init(
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
    deposit_id: {
      type: DataTypes.UUID,
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
    tableName: "social_feed_seen",
    timestamps: false,
    indexes: [
      {
        fields: ["user_id"]
      },
      {
        fields: ["deposit_id"]
      },
      {
        unique: true,
        fields: ["user_id", "deposit_id"]
      }
    ]
  }
);

