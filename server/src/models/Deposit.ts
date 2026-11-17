import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { DepositDetailedStatus } from "../domain/depositStatus";
import { User } from "./User";

export type DepositStatus = "Pending" | "Approved" | "Rejected";

export interface DepositAttributes {
  deposit_id: string;
  reference?: string | null;
  user_id: string;
  crypto_type: string;
  amount: number;
  usd_amount?: number | null;
  tx_hash?: string | null;
  network?: string | null;
  deposit_wallet?: string | null;
  memo?: string | null;
  memo_label?: string | null;
  memo_required?: boolean;
  received_amount?: number | null;
  confirmation_count?: number;
  verification_result?: unknown;
  detailed_status?: DepositDetailedStatus;
  idempotency_key?: string | null;
  detected_at?: Date | null;
  verified_at?: Date | null;
  expires_at?: Date | null;
  confirmed_at?: Date | null;
  reviewed_by?: string | null;
  reviewed_at?: Date | null;
  rejection_reason?: string | null;
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
  | "reference"
  | "usd_amount"
  | "status"
  | "multiplier"
  | "pending_earning"
  | "timestamp"
  | "approved_at"
  | "total_earned"
  | "tx_hash"
  | "network"
  | "deposit_wallet"
  | "memo"
  | "memo_label"
  | "memo_required"
  | "received_amount"
  | "confirmation_count"
  | "verification_result"
  | "detailed_status"
  | "idempotency_key"
  | "detected_at"
  | "verified_at"
  | "expires_at"
  | "confirmed_at"
  | "reviewed_by"
  | "reviewed_at"
  | "rejection_reason"
>;

export class Deposit
  extends Model<DepositAttributes, DepositCreationAttributes>
  implements DepositAttributes
{
  public deposit_id!: string;
  public reference!: string | null;
  public user_id!: string;
  public crypto_type!: string;
  public amount!: number;
  public usd_amount!: number | null;
  public tx_hash!: string | null;
  public network!: string | null;
  public deposit_wallet!: string | null;
  public memo!: string | null;
  public memo_label!: string | null;
  public memo_required!: boolean;
  public received_amount!: number | null;
  public confirmation_count!: number;
  public verification_result!: unknown;
  public detailed_status!: DepositDetailedStatus;
  public idempotency_key!: string | null;
  public detected_at!: Date | null;
  public verified_at!: Date | null;
  public expires_at!: Date | null;
  public confirmed_at!: Date | null;
  public reviewed_by!: string | null;
  public reviewed_at!: Date | null;
  public rejection_reason!: string | null;
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
    reference: {
      // Uniqueness is enforced by the `deposits_reference_unique` index created
      // in reconcileDepositsSchema; it is declared here without `unique` so the
      // in-place `sequelize.sync` never attempts a destructive table rebuild.
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
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
    usd_amount: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: null
    },
    tx_hash: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    network: { type: DataTypes.STRING, allowNull: true },
    deposit_wallet: { type: DataTypes.STRING, allowNull: true },
    memo: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    memo_label: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
    memo_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    received_amount: {
      type: DataTypes.DOUBLE,
      allowNull: true,
      defaultValue: null
    },
    confirmation_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    verification_result: { type: DataTypes.JSONB, allowNull: true },
    detailed_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "PENDING"
    },
    idempotency_key: {
      // Uniqueness is enforced by the `deposits_idempotency_key_unique` index
      // created in reconcileDepositsSchema (see the note on `reference`).
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    detected_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    verified_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    expires_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    confirmed_at: { type: DataTypes.DATE, allowNull: true },
    reviewed_by: { type: DataTypes.UUID, allowNull: true, defaultValue: null },
    reviewed_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
    rejection_reason: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
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
