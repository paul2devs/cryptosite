import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { Deposit } from "./Deposit";
import { User } from "./User";

export interface BonusCreditAttributes {
  credit_id: string;
  user_id: string;
  deposit_id: string;
  campaign_id: string | null;
  campaign_name: string;
  percentage: string;
  qualifying_amount: string;
  bonus_amount: string;
  asset: string;
  status: "credited" | "reversed";
  reference: string;
  ledger_idempotency_key: string;
  reason: string;
  created_at?: Date;
}

export type BonusCreditCreationAttributes = Optional<
  BonusCreditAttributes,
  "credit_id" | "campaign_id" | "status" | "reason" | "created_at"
>;

export class BonusCredit
  extends Model<BonusCreditAttributes, BonusCreditCreationAttributes>
  implements BonusCreditAttributes
{
  public credit_id!: string;
  public user_id!: string;
  public deposit_id!: string;
  public campaign_id!: string | null;
  public campaign_name!: string;
  public percentage!: string;
  public qualifying_amount!: string;
  public bonus_amount!: string;
  public asset!: string;
  public status!: "credited" | "reversed";
  public reference!: string;
  public ledger_idempotency_key!: string;
  public reason!: string;
  public readonly created_at!: Date;
}

BonusCredit.init(
  {
    credit_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    deposit_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    campaign_id: { type: DataTypes.UUID, allowNull: true },
    campaign_name: { type: DataTypes.STRING, allowNull: false },
    percentage: { type: DataTypes.DECIMAL(20, 6), allowNull: false },
    qualifying_amount: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    bonus_amount: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    asset: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "credited" },
    reference: { type: DataTypes.STRING, allowNull: false },
    ledger_idempotency_key: { type: DataTypes.STRING, allowNull: false, unique: true },
    reason: { type: DataTypes.TEXT, allowNull: false, defaultValue: "Automated promotional bonus on a verified deposit." },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "bonus_credits",
    timestamps: false,
    indexes: [{ fields: ["user_id"] }, { fields: ["campaign_id"] }, { fields: ["created_at"] }]
  }
);

User.hasMany(BonusCredit, { foreignKey: "user_id" });
BonusCredit.belongsTo(User, { foreignKey: "user_id" });
Deposit.hasOne(BonusCredit, { foreignKey: "deposit_id" });
BonusCredit.belongsTo(Deposit, { foreignKey: "deposit_id" });
