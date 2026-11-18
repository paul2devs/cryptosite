import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface InvestmentPositionAttributes {
  position_id: string;
  user_id: string;
  deposit_id: string | null;
  asset: string;
  principal: string;
  strategy: string;
  status: "active" | "closed";
  verification_status: "unavailable" | "verified";
  current_valuation: string | null;
  last_calculated_at: Date | null;
  created_at?: Date;
}

export type InvestmentPositionCreationAttributes = Optional<
  InvestmentPositionAttributes,
  "position_id" | "deposit_id" | "status" | "verification_status" | "current_valuation" | "last_calculated_at" | "created_at"
>;

export class InvestmentPosition
  extends Model<InvestmentPositionAttributes, InvestmentPositionCreationAttributes>
  implements InvestmentPositionAttributes
{
  public position_id!: string;
  public user_id!: string;
  public deposit_id!: string | null;
  public asset!: string;
  public principal!: string;
  public strategy!: string;
  public status!: "active" | "closed";
  public verification_status!: "unavailable" | "verified";
  public current_valuation!: string | null;
  public last_calculated_at!: Date | null;
  public readonly created_at!: Date;
}

InvestmentPosition.init(
  {
    position_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    // Nullable so an administrator can allocate principal into a new position without a
    // deposit. Deposit-backed positions still set it and the unique index is preserved.
    deposit_id: { type: DataTypes.UUID, allowNull: true, unique: true },
    asset: { type: DataTypes.STRING, allowNull: false },
    principal: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    strategy: { type: DataTypes.STRING, allowNull: false, defaultValue: "custody_hold" },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: "active" },
    verification_status: { type: DataTypes.STRING, allowNull: false, defaultValue: "unavailable" },
    current_valuation: { type: DataTypes.DECIMAL(36, 8), allowNull: true },
    last_calculated_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: "investment_positions", timestamps: false, indexes: [{ fields: ["user_id"] }] }
);
