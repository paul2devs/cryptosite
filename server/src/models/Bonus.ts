import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export type BonusType = "multiplier";

export interface BonusAttributes {
  bonus_id: string;
  type: BonusType;
  label: string;
  multiplier: number;
  start_time: Date;
  end_time: Date;
  conditions: unknown;
  is_active: boolean;
}

export type BonusCreationAttributes = Optional<
  BonusAttributes,
  "bonus_id" | "conditions" | "is_active"
>;

export class Bonus
  extends Model<BonusAttributes, BonusCreationAttributes>
  implements BonusAttributes
{
  public bonus_id!: string;
  public type!: BonusType;
  public label!: string;
  public multiplier!: number;
  public start_time!: Date;
  public end_time!: Date;
  public conditions!: unknown;
  public is_active!: boolean;
}

Bonus.init(
  {
    bonus_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false
    },
    multiplier: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    conditions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    sequelize,
    tableName: "bonuses",
    timestamps: false
  }
);

