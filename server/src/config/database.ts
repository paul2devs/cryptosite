import { DataTypes, Sequelize } from "sequelize";
import { requireEnv } from "./env";

const databaseUrl = requireEnv("DATABASE_URL");

export const sequelize = new Sequelize(databaseUrl, {
  dialect: "postgres",
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30_000,
    idle: 10_000
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

let dbOk = false;
let dbError: string | null = null;

export function getDatabaseStatus(): { ok: boolean; error: string | null } {
  return { ok: dbOk, error: dbError };
}

export async function initDatabase(): Promise<void> {
  try {
    await sequelize.authenticate();
    const shouldAlter = String(process.env.DB_SYNC_ALTER || "").toLowerCase() === "true";
    await sequelize.sync({ alter: shouldAlter });
    await reconcileUsersSchema();
    dbOk = true;
    dbError = null;
    // eslint-disable-next-line no-console
    console.log("Database connected successfully");
  } catch (error: any) {
    dbOk = false;
    dbError = error?.message ? String(error.message) : "Unknown database error";
    const detail =
      error?.original?.message || error?.parent?.message || error?.message || String(error);
    throw new Error(`Database connection failed: ${detail}`);
  }
}

async function reconcileUsersSchema(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  const usersDefinition = await queryInterface.describeTable("users");

  if (!("bonus_blocked" in usersDefinition)) {
    await queryInterface.addColumn("users", "bonus_blocked", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
  }

  if (!("account_settings" in usersDefinition)) {
    await queryInterface.addColumn("users", "account_settings", {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        notifications: {
          deposit_updates: true,
          withdrawal_updates: true,
          rewards_bonuses: true,
          announcements: true
        },
        preferences: {
          language: "en"
        },
        withdrawal_wallets: []
      }
    });
  }

  if (!("withdrawable_balance" in usersDefinition)) {
    await queryInterface.addColumn("users", "withdrawable_balance", {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    });
  }

  if (!("locked_balance" in usersDefinition)) {
    await queryInterface.addColumn("users", "locked_balance", {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0
    });
  }

  if (!("last_withdrawal_at" in usersDefinition)) {
    await queryInterface.addColumn("users", "last_withdrawal_at", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });
  }

  if (!("last_activity_at" in usersDefinition)) {
    await queryInterface.addColumn("users", "last_activity_at", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });
  }
}

