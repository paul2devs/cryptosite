import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface DailyPerformanceSnapshotAttributes {
  snapshot_id: string;
  user_id: string;
  position_id: string;
  snapshot_date: string;
  opening_valuation: string;
  closing_valuation: string | null;
  cash_flow: string;
  profit_loss: string | null;
  roi_percent: string | null;
  strategy: string;
  data_source: string;
  verification_status: "verified" | "unavailable" | "failed";
  correction_of: string | null;
  reason: string | null;
  created_at?: Date;
}

export type DailyPerformanceSnapshotCreationAttributes = Optional<
  DailyPerformanceSnapshotAttributes,
  "snapshot_id" | "closing_valuation" | "profit_loss" | "roi_percent" | "correction_of" | "reason" | "created_at"
>;

export class DailyPerformanceSnapshot
  extends Model<DailyPerformanceSnapshotAttributes, DailyPerformanceSnapshotCreationAttributes>
  implements DailyPerformanceSnapshotAttributes
{
  public snapshot_id!: string;
  public user_id!: string;
  public position_id!: string;
  public snapshot_date!: string;
  public opening_valuation!: string;
  public closing_valuation!: string | null;
  public cash_flow!: string;
  public profit_loss!: string | null;
  public roi_percent!: string | null;
  public strategy!: string;
  public data_source!: string;
  public verification_status!: "verified" | "unavailable" | "failed";
  public correction_of!: string | null;
  public reason!: string | null;
  public readonly created_at!: Date;
}

DailyPerformanceSnapshot.init(
  {
    snapshot_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    position_id: { type: DataTypes.UUID, allowNull: false },
    snapshot_date: { type: DataTypes.DATEONLY, allowNull: false },
    opening_valuation: { type: DataTypes.DECIMAL(36, 8), allowNull: false },
    closing_valuation: { type: DataTypes.DECIMAL(36, 8), allowNull: true },
    cash_flow: { type: DataTypes.DECIMAL(36, 8), allowNull: false, defaultValue: "0.00000000" },
    profit_loss: { type: DataTypes.DECIMAL(36, 8), allowNull: true },
    roi_percent: { type: DataTypes.DECIMAL(20, 6), allowNull: true },
    strategy: { type: DataTypes.STRING, allowNull: false },
    data_source: { type: DataTypes.STRING, allowNull: false },
    verification_status: { type: DataTypes.STRING, allowNull: false },
    correction_of: { type: DataTypes.UUID, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: "daily_performance_snapshots",
    timestamps: false,
    indexes: [
      { fields: ["user_id", "snapshot_date"] },
      {
        unique: true,
        fields: ["position_id", "snapshot_date"],
        where: { verification_status: "verified", correction_of: null }
      }
    ]
  }
);
