import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export type ChurnRiskLevel = "low" | "medium" | "high";

export interface ChurnPredictionAttributes {
  user_id: string;
  risk_level: ChurnRiskLevel;
  probability_score: number;
  last_detected?: Date;
}

export type ChurnPredictionCreationAttributes = Optional<
  ChurnPredictionAttributes,
  "risk_level" | "probability_score" | "last_detected"
>;

export class ChurnPrediction
  extends Model<ChurnPredictionAttributes, ChurnPredictionCreationAttributes>
  implements ChurnPredictionAttributes
{
  public user_id!: string;
  public risk_level!: ChurnRiskLevel;
  public probability_score!: number;
  public last_detected!: Date;
}

ChurnPrediction.init(
  {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      references: {
        model: "users",
        key: "user_id"
      },
      onDelete: "CASCADE"
    },
    risk_level: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "low"
    },
    probability_score: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    },
    last_detected: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "churn_predictions",
    timestamps: false
  }
);

User.hasOne(ChurnPrediction, { foreignKey: "user_id" });
ChurnPrediction.belongsTo(User, { foreignKey: "user_id" });

