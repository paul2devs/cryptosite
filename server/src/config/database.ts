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
    await reconcileWithdrawalsSchema();
    await reconcileMembershipSchema();
    await reconcileInvestmentLevelSchema();
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

async function reconcileWithdrawalsSchema(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  let definition: Record<string, unknown>;
  try {
    definition = await queryInterface.describeTable("withdrawals");
  } catch {
    return;
  }

  if (!("idempotency_key" in definition)) {
    await queryInterface.addColumn("withdrawals", "idempotency_key", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    });
    try {
      await queryInterface.addIndex("withdrawals", ["idempotency_key"], {
        unique: true,
        name: "withdrawals_idempotency_key_unique"
      });
    } catch {
      // The unique index already exists or the parallel sync created it.
    }
  }
}

async function reconcileMembershipSchema(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  let membershipColumns: Record<string, unknown>;
  let historyColumns: Record<string, unknown>;
  try {
    membershipColumns = await queryInterface.describeTable("user_memberships");
    historyColumns = await queryInterface.describeTable("membership_histories");
  } catch {
    return;
  }

  if (!("manual_tier_id" in membershipColumns)) {
    await queryInterface.addColumn("user_memberships", "manual_tier_id", {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null
    });
  }
  if (!("manual_reason" in membershipColumns)) {
    await queryInterface.addColumn("user_memberships", "manual_reason", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    });
  }
  if (!("manual_set_at" in membershipColumns)) {
    await queryInterface.addColumn("user_memberships", "manual_set_at", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });
  }
  if (!("source" in historyColumns)) {
    await queryInterface.addColumn("membership_histories", "source", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "automatic"
    });
  }
  if (!("actor_admin_id" in historyColumns)) {
    await queryInterface.addColumn("membership_histories", "actor_admin_id", {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null
    });
  }
}

async function reconcileInvestmentLevelSchema(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  let userLevelColumns: Record<string, unknown>;
  let historyColumns: Record<string, unknown>;
  let benefitColumns: Record<string, unknown>;
  try {
    userLevelColumns = await queryInterface.describeTable("user_investment_levels");
    historyColumns = await queryInterface.describeTable("investment_level_histories");
    benefitColumns = await queryInterface.describeTable("investment_level_benefits");
  } catch {
    return;
  }

  if (!("manual_level_id" in userLevelColumns)) {
    await queryInterface.addColumn("user_investment_levels", "manual_level_id", {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null
    });
  }
  if (!("manual_reason" in userLevelColumns)) {
    await queryInterface.addColumn("user_investment_levels", "manual_reason", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    });
  }
  if (!("manual_set_at" in userLevelColumns)) {
    await queryInterface.addColumn("user_investment_levels", "manual_set_at", {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    });
  }
  if (!("source" in historyColumns)) {
    await queryInterface.addColumn("investment_level_histories", "source", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "automatic"
    });
  }
  if (!("actor_admin_id" in historyColumns)) {
    await queryInterface.addColumn("investment_level_histories", "actor_admin_id", {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null
    });
  }
  if (!("category" in benefitColumns)) {
    await queryInterface.addColumn("investment_level_benefits", "category", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "tools"
    });
  }
}

