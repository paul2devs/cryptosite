import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export type WithdrawalStatus = "Pending" | "Approved" | "Rejected";

export interface WithdrawalAttributes {
  withdrawal_id: string;
  user_id: string;
  amount: number;
  status: WithdrawalStatus;
  asset?: string | null;
  destination_address?: string | null;
  network?: string | null;
  network_fee?: string;
  platform_fee?: string;
  tx_hash?: string | null;
  review_reason?: string | null;
  detailed_status?: string;
  idempotency_key?: string | null;
  processed_at?: Date | null;
  timestamp?: Date;
}

export type WithdrawalCreationAttributes = Optional<
  WithdrawalAttributes,
  | "withdrawal_id"
  | "status"
  | "timestamp"
  | "asset"
  | "destination_address"
  | "network"
  | "network_fee"
  | "platform_fee"
  | "tx_hash"
  | "review_reason"
  | "detailed_status"
  | "idempotency_key"
  | "processed_at"
>;

export class Withdrawal
  extends Model<WithdrawalAttributes, WithdrawalCreationAttributes>
  implements WithdrawalAttributes
{
  public withdrawal_id!: string;
  public user_id!: string;
  public amount!: number;
  public status!: WithdrawalStatus;
  public asset!: string | null;
  public destination_address!: string | null;
  public network!: string | null;
  public network_fee!: string;
  public platform_fee!: string;
  public tx_hash!: string | null;
  public review_reason!: string | null;
  public detailed_status!: string;
  public idempotency_key!: string | null;
  public processed_at!: Date | null;
  public timestamp!: Date;
}

Withdrawal.init(
  {
    withdrawal_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    amount: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Pending"
    },
    asset: { type: DataTypes.STRING, allowNull: true },
    destination_address: { type: DataTypes.STRING, allowNull: true },
    network: { type: DataTypes.STRING, allowNull: true },
    network_fee: { type: DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    platform_fee: { type: DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    tx_hash: { type: DataTypes.STRING, allowNull: true },
    review_reason: { type: DataTypes.TEXT, allowNull: true },
    detailed_status: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    idempotency_key: { type: DataTypes.STRING, allowNull: true, unique: true },
    processed_at: { type: DataTypes.DATE, allowNull: true },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "withdrawals",
    timestamps: false
  }
);

User.hasMany(Withdrawal, { foreignKey: "user_id" });
Withdrawal.belongsTo(User, { foreignKey: "user_id" });

