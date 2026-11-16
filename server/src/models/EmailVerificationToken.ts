import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export interface EmailVerificationTokenAttributes {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at?: Date;
}

export type EmailVerificationTokenCreationAttributes = Optional<
  EmailVerificationTokenAttributes,
  "id" | "used_at" | "created_at"
>;

/**
 * Stores the SHA-256 hash of a single-use email verification token.
 *
 * The raw token never touches the database: it is only ever sent to the user's
 * inbox. A record is considered valid while `used_at` is null and `expires_at`
 * is in the future.
 */
export class EmailVerificationToken
  extends Model<EmailVerificationTokenAttributes, EmailVerificationTokenCreationAttributes>
  implements EmailVerificationTokenAttributes
{
  public id!: string;
  public user_id!: string;
  public token_hash!: string;
  public expires_at!: Date;
  public used_at!: Date | null;
  public readonly created_at!: Date;
}

EmailVerificationToken.init(
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
    tableName: "email_verification_tokens",
    timestamps: false,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["token_hash"], unique: true },
      { fields: ["expires_at"] },
      { fields: ["used_at"] }
    ]
  }
);

EmailVerificationToken.belongsTo(User, { foreignKey: "user_id" });
User.hasMany(EmailVerificationToken, { foreignKey: "user_id" });
