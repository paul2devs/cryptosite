import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export interface ReferralAttributes {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  created_at?: Date;
}

export type ReferralCreationAttributes = Optional<
  ReferralAttributes,
  "id" | "created_at"
>;

export class Referral
  extends Model<ReferralAttributes, ReferralCreationAttributes>
  implements ReferralAttributes
{
  public id!: string;
  public referrer_id!: string;
  public referred_user_id!: string;
  public created_at!: Date;
}

Referral.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    referrer_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    referred_user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "referrals",
    timestamps: false,
    indexes: [
      {
        fields: ["referrer_id"]
      },
      {
        fields: ["referred_user_id"],
        unique: true
      }
    ]
  }
);

User.hasMany(Referral, { foreignKey: "referrer_id", as: "referrals" });
Referral.belongsTo(User, { foreignKey: "referrer_id", as: "referrer" });
Referral.belongsTo(User, { foreignKey: "referred_user_id", as: "referredUser" });

