import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";
import { User } from "./User";

export type WithdrawalStatus = "Pending" | "Approved" | "Rejected";

export interface WithdrawalAttributes {
  withdrawal_id: string;
  user_id: string;
  amount: number;
  status: WithdrawalStatus;
  timestamp?: Date;
}

export type WithdrawalCreationAttributes = Optional<
  WithdrawalAttributes,
  "withdrawal_id" | "status" | "timestamp"
>;

export class Withdrawal
  extends Model<WithdrawalAttributes, WithdrawalCreationAttributes>
  implements WithdrawalAttributes
{
  public withdrawal_id!: string;
  public user_id!: string;
  public amount!: number;
  public status!: WithdrawalStatus;
  public timestamp!: Date;
}

Withdrawal.init(
  {
    withdrawal_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    amount: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Pending"
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: "withdrawals",
    timestamps: false
  }
);

User.hasMany(Withdrawal, { foreignKey: "user_id" });
Withdrawal.belongsTo(User, { foreignKey: "user_id" });

