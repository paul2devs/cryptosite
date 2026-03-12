import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export type ActiveMultiplierType =
  | "level"
  | "streak"
  | "time_limited"
  | "referral"
  | "loyalty"
  | "retention"
  | "risk_adjustment";

export interface ActiveMultiplierAttributes {
  id: string;
  user_id: string;
  type: ActiveMultiplierType;
  value: number;
  expires_at: Date;
  created_at?: Date;
}

export type ActiveMultiplierCreationAttributes = Optional<
  ActiveMultiplierAttributes,
  "id" | "created_at"
>;

export class ActiveMultiplier
  extends Model<ActiveMultiplierAttributes, ActiveMultiplierCreationAttributes>
  implements ActiveMultiplierAttributes
{
  public id!: string;
  public user_id!: string;
  public type!: ActiveMultiplierType;
  public value!: number;
  public expires_at!: Date;
  public created_at!: Date;
}

ActiveMultiplier.init(
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
      type: DataTypes.ENUM(
        "level",
        "streak",
        "time_limited",
        "referral",
        "loyalty",
        "retention",
        "risk_adjustment"
      ),
      allowNull: false
    },
    value: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    expires_at: {
      type: DataTypes.DATE,
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
    tableName: "active_multipliers",
    timestamps: false,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["expires_at"] }
    ]
  }
);

User.hasMany(ActiveMultiplier, { foreignKey: "user_id" });
ActiveMultiplier.belongsTo(User, { foreignKey: "user_id" });

