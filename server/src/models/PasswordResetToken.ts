import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export interface PasswordResetTokenAttributes {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at?: Date;
}

export type PasswordResetTokenCreationAttributes = Optional<
  PasswordResetTokenAttributes,
  "id" | "used_at" | "created_at"
>;

export class PasswordResetToken
  extends Model<PasswordResetTokenAttributes, PasswordResetTokenCreationAttributes>
  implements PasswordResetTokenAttributes
{
  public id!: string;
  public user_id!: string;
  public token_hash!: string;
  public expires_at!: Date;
  public used_at!: Date | null;
  public readonly created_at!: Date;
}

PasswordResetToken.init(
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
    token_hash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "password_reset_tokens",
    timestamps: false,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["token_hash"], unique: true },
      { fields: ["expires_at"] },
      { fields: ["used_at"] }
    ]
  }
);

PasswordResetToken.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(PasswordResetToken, { foreignKey: "user_id" });

