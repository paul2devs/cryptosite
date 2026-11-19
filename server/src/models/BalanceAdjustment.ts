import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import type { BalanceAdjustmentDirection, BalanceAdjustmentType } from "../domain/balanceAdjustmentRules";
import { User } from "./User";

export type BalanceAdjustmentStatus = "applied" | "reversed";

export interface BalanceAdjustmentAttributes {
  adjustment_id: string;
  user_id: string;
  admin_id: string;
  type: BalanceAdjustmentType;
  direction: BalanceAdjustmentDirection;
  amount: string;
  asset: string;
  balance_before: string;
  balance_after: string;
  principal_before: string;
  principal_after: string;
  valuation_before: string | null;
  valuation_after: string | null;
  earnings_before: string | null;
  earnings_after: string | null;
  position_id: string | null;
  reason: string;
  note: string | null;
  reference: string;
  idempotency_key: string | null;
  reversal_of: string | null;
  reversed_by: string | null;
  status: BalanceAdjustmentStatus;
  created_at?: Date;
}

export type BalanceAdjustmentCreationAttributes = Optional<
  BalanceAdjustmentAttributes,
  | "adjustment_id"
  | "asset"
  | "position_id"
  | "valuation_before"
  | "valuation_after"
  | "earnings_before"
  | "earnings_after"
  | "note"
  | "idempotency_key"
  | "reversal_of"
  | "reversed_by"
  | "status"
  | "created_at"
>;

// Permanent, auditable record of every administrator balance or investment adjustment.
// Rows are never updated to change an amount: a wrong adjustment is corrected by a new
// reversal row that links back through `reversal_of` / `reversed_by`.
export class BalanceAdjustment
  extends Model<BalanceAdjustmentAttributes, BalanceAdjustmentCreationAttributes>
  implements BalanceAdjustmentAttributes
{
  public adjustment_id!: string;
  public user_id!: string;
  public admin_id!: string;
  public type!: BalanceAdjustmentType;
  public direction!: BalanceAdjustmentDirection;
  public amount!: string;
  public asset!: string;
  public balance_before!: string;
  public balance_after!: string;
  public principal_before!: string;
  public principal_after!: string;
  public valuation_before!: string | null;
  public valuation_after!: string | null;
  public earnings_before!: string | null;
  public earnings_after!: string | null;
  public position_id!: string | null;
  public reason!: string;
  public note!: string | null;
  public reference!: string;
  public idempotency_key!: string | null;
  public reversal_of!: string | null;
  public reversed_by!: string | null;
  public status!: BalanceAdjustmentStatus;
  public readonly created_at!: Date;
}

BalanceAdjustment.init(
  {
    adjustment_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    admin_id: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    direction: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    asset: { type: DataTypes.STRING, allowNull: false, defaultValue: "USD" },
    balance_before: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    balance_after: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    principal_before: { type: DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    principal_after: { type: DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    // Before/after snapshots for the newer adjustment categories. They stay null for
    // adjustments that do not touch valuations or earnings, so the audit row only carries
    // the values that actually changed.
    valuation_before: { type: DataTypes.DECIMAL(36, 8), allowNull: true, defaultValue: null },
    valuation_after: { type: DataTypes.DECIMAL(36, 8), allowNull: true, defaultValue: null },
    earnings_before: { type: DataTypes.DECIMAL(36, 8), allowNull: true, defaultValue: null },
    earnings_after: { type: DataTypes.DECIMAL(36, 8), allowNull: true, defaultValue: null },
    position_id: { type: DataTypes.UUID, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true },
    // Uniqueness is enforced by reconcileBalanceAdjustmentSchema indexes so the
    // in-place `sequelize.sync` never attempts a destructive table rebuild.
    reference: { type: DataTypes.STRING, allowNull: false },
    idempotency_key: { type: DataTypes.STRING, allowNull: true },
    reversal_of: { type: DataTypes.UUID, allowNull: true },
    reversed_by: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "applied" },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "balance_adjustments",
    timestamps: false,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["admin_id"] },
      { fields: ["type"] },
      { fields: ["created_at"] }
    ]
  }
);

User.hasMany(BalanceAdjustment, { foreignKey: "user_id" });
BalanceAdjustment.belongsTo(User, { foreignKey: "user_id" });
