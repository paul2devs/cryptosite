import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface LevelAttributes {
  level_id: number;
  level_name: string;
  required_xp: number;
  multiplier_base: number;
  unlocks: unknown;
}

export type LevelCreationAttributes = Optional<LevelAttributes, "unlocks">;

export class Level
  extends Model<LevelAttributes, LevelCreationAttributes>
  implements LevelAttributes
{
  public level_id!: number;
  public level_name!: string;
  public required_xp!: number;
  public multiplier_base!: number;
  public unlocks!: unknown;
}

Level.init(
  {
    level_id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },
    level_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    required_xp: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    multiplier_base: {
      type: DataTypes.DOUBLE,
      allowNull: false
    },
    unlocks: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  },
  {
    sequelize,
    tableName: "levels",
    timestamps: false
  }
);

