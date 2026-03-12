import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export type EarningsTickType = "hourly" | "daily";

export interface EarningsLogAttributes {
  earning_id: string;
  user_id: string;
  deposit_id: string;
  earned_amount: number;
  tick_type: EarningsTickType;
  timestamp?: Date;
}

export type EarningsLogCreationAttributes = Optional<
  EarningsLogAttributes,
  "earning_id" | "timestamp"
>;

export class EarningsLog
  extends Model<EarningsLogAttributes, EarningsLogCreationAttributes>
  implements EarningsLogAttributes
{
  public earning_id!: string;
  public user_id!: string;
  public deposit_id!: string;
  public earned_amount!: number;
  public tick_type!: EarningsTickType;
  public timestamp!: Date;
}

EarningsLog.init(
  {
    earning_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    deposit_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    earned_amount: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    tick_type: {
      type: DataTypes.ENUM("hourly", "daily"),
      allowNull: false
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "earnings_logs",
    timestamps: false,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["deposit_id"] },
      { fields: ["timestamp"] }
    ]
  }
);

