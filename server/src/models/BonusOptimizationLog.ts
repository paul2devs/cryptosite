import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface BonusOptimizationLogAttributes {
  id: string;
  timestamp?: Date;
  adjustment_type: string;
  reason: string;
  impact: string;
}

export type BonusOptimizationLogCreationAttributes = Optional<
  BonusOptimizationLogAttributes,
  "id" | "timestamp"
>;

export class BonusOptimizationLog
  extends Model<BonusOptimizationLogAttributes, BonusOptimizationLogCreationAttributes>
  implements BonusOptimizationLogAttributes
{
  public id!: string;
  public timestamp!: Date;
  public adjustment_type!: string;
  public reason!: string;
  public impact!: string;
}

BonusOptimizationLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    adjustment_type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: false
    },
    impact: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: "bonus_optimization_logs",
    timestamps: false
  }
);

