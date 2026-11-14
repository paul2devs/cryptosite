import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export type DepositStatus = "Pending" | "Approved" | "Rejected";

export interface DepositAttributes {
  deposit_id: string;
  user_id: string;
  crypto_type: string;
  amount: number;
  tx_hash?: string | null;
  network?: string | null;
  deposit_wallet?: string | null;
  confirmation_count?: number;
  verification_result?: unknown;
  confirmed_at?: Date | null;
  status: DepositStatus;
  multiplier: number;
  pending_earning: number;
  timestamp?: Date;
  approved_at?: Date | null;
  total_earned: number;
}

export type DepositCreationAttributes = Optional<
  DepositAttributes,
  | "deposit_id"
  | "status"
  | "multiplier"
  | "pending_earning"
  | "timestamp"
  | "approved_at"
  | "total_earned"
  | "tx_hash"
  | "network"
  | "deposit_wallet"
  | "confirmation_count"
  | "verification_result"
  | "confirmed_at"
>;

export class Deposit
  extends Model<DepositAttributes, DepositCreationAttributes>
  implements DepositAttributes
{
  public deposit_id!: string;
  public user_id!: string;
  public crypto_type!: string;
  public amount!: number;
  public tx_hash!: string | null;
  public network!: string | null;
  public deposit_wallet!: string | null;
  public confirmation_count!: number;
  public verification_result!: unknown;
  public confirmed_at!: Date | null;
  public status!: DepositStatus;
  public multiplier!: number;
  public pending_earning!: number;
  public timestamp!: Date;
  public approved_at!: Date | null;
  public total_earned!: number;
}

Deposit.init(
  {
    deposit_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    crypto_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    amount: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    tx_hash: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    network: { type: DataTypes.STRING, allowNull: true },
    deposit_wallet: { type: DataTypes.STRING, allowNull: true },
    confirmation_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    verification_result: { type: DataTypes.JSONB, allowNull: true },
    confirmed_at: { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Pending"
    },
    multiplier: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 1
    },
    pending_earning: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    total_earned: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "deposits",
    timestamps: false
  }
);

User.hasMany(Deposit, { foreignKey: "user_id" });
Deposit.belongsTo(User, { foreignKey: "user_id" });

