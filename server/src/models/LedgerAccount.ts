import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export type LedgerAccountCode =
  | "confirmed_deposits"
  | "available_balance"
  | "invested_principal"
  | "locked_principal"
  | "realized_earnings"
  | "pending_settlement"
  | "withdrawals"
  | "fees"
  | "adjustments"
  | "promotional_credits";

export interface LedgerAccountAttributes {
  account_id: string;
  user_id: string;
  code: LedgerAccountCode;
  asset: string;
  created_at?: Date;
}

export type LedgerAccountCreationAttributes = Optional<LedgerAccountAttributes, "account_id" | "created_at">;

export class LedgerAccount
  extends Model<LedgerAccountAttributes, LedgerAccountCreationAttributes>
  implements LedgerAccountAttributes
{
  public account_id!: string;
  public user_id!: string;
  public code!: LedgerAccountCode;
  public asset!: string;
  public readonly created_at!: Date;
}

LedgerAccount.init(
  {
    account_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    asset: { type: DataTypes.STRING, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "ledger_accounts",
    timestamps: false,
    indexes: [{ unique: true, fields: ["user_id", "code", "asset"] }]
  }
);
