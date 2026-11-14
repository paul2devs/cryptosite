import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface PerformanceCalculationLogAttributes {
  log_id: string;
  position_id: string | null;
  snapshot_date: string;
  outcome: "verified" | "unavailable" | "failed" | "reconciliation";
  message: string;
  created_at?: Date;
}

export type PerformanceCalculationLogCreationAttributes = Optional<
  PerformanceCalculationLogAttributes,
  "log_id" | "position_id" | "created_at"
>;

export class PerformanceCalculationLog
  extends Model<PerformanceCalculationLogAttributes, PerformanceCalculationLogCreationAttributes>
  implements PerformanceCalculationLogAttributes
{
  public log_id!: string;
  public position_id!: string | null;
  public snapshot_date!: string;
  public outcome!: "verified" | "unavailable" | "failed" | "reconciliation";
  public message!: string;
  public readonly created_at!: Date;
}

PerformanceCalculationLog.init(
  {
    log_id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    position_id: { type: DataTypes.UUID, allowNull: true },
    snapshot_date: { type: DataTypes.DATEONLY, allowNull: false },
    outcome: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { sequelize, tableName: "performance_calculation_logs", timestamps: false, indexes: [{ fields: ["snapshot_date"] }] }
);
