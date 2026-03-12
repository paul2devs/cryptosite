import { Sequelize } from "sequelize";
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

