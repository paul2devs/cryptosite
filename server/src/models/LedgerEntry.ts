import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface LedgerEntryAttributes {
  entry_id: string;
  account_id: string;
  user_id: string;
  direction: "debit" | "credit";
  amount: string;
  asset: string;
  transaction_type: string;
  source_type: string;
  source_id: string;
  idempotency_key: string;
  created_at?: Date;
}

export type LedgerEntryCreationAttributes = Optional<LedgerEntryAttributes, "entry_id" | "created_at">;

export class LedgerEntry
  extends Model<LedgerEntryAttributes, LedgerEntryCreationAttributes>
  implements LedgerEntryAttributes
{
  public entry_id!: string;
  public account_id!: string;
  public user_id!: string;
  public direction!: "debit" | "credit";
  public amount!: string;
  public asset!: string;
  public transaction_type!: string;
  public source_type!: string;
  public source_id!: string;
  public idempotency_key!: string;
  public readonly created_at!: Date;
}

LedgerEntry.init(
  {
    entry_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    account_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    direction: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    asset: { type: DataTypes.STRING, allowNull: false },
    transaction_type: { type: DataTypes.STRING, allowNull: false },
    source_type: { type: DataTypes.STRING, allowNull: false },
    source_id: { type: DataTypes.STRING, allowNull: false },
    idempotency_key: { type: DataTypes.STRING, allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "ledger_entries",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { fields: ["source_type", "source_id"] }, { fields: ["created_at"] }]
  }
);
