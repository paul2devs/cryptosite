import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface UserAttributes {
  user_id: string;
  name: string;
  email: string;
  password: string;
  crypto_wallets: unknown;
  referral_code: string | null;
  referred_by: string | null;
  level: number;
  xp: number;
  streak: number;
  pending_earnings: unknown;
  seen_notifications: unknown;
  is_admin: boolean;
  last_activity_at?: Date | null;
  withdrawable_balance: number;
  locked_balance: number;
  last_withdrawal_at?: Date | null;
  bonus_blocked: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  | "user_id"
  | "crypto_wallets"
  | "referral_code"
  | "referred_by"
  | "level"
  | "xp"
  | "streak"
  | "pending_earnings"
  | "seen_notifications"
  | "is_admin"
  | "last_activity_at"
  | "withdrawable_balance"
  | "locked_balance"
  | "last_withdrawal_at"
  | "bonus_blocked"
  | "created_at"
  | "updated_at"
>;

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public user_id!: string;
  public name!: string;
  public email!: string;
  public password!: string;
  public crypto_wallets!: unknown;
  public referral_code!: string | null;
  public referred_by!: string | null;
  public level!: number;
  public xp!: number;
  public streak!: number;
  public pending_earnings!: unknown;
  public seen_notifications!: unknown;
  public is_admin!: boolean;
  public last_activity_at!: Date | null;
  public withdrawable_balance!: number;
  public locked_balance!: number;
  public last_withdrawal_at!: Date | null;
  public bonus_blocked!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

User.init(
  {
    user_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    crypto_wallets: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    referral_code: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    referred_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    xp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    streak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    pending_earnings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    seen_notifications: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    bonus_blocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    withdrawable_balance: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    locked_balance: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    last_withdrawal_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "users",
    timestamps: false
  }
);

