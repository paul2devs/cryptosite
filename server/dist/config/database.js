"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
exports.getDatabaseStatus = getDatabaseStatus;
exports.initDatabase = initDatabase;
const sequelize_1 = require("sequelize");
const env_1 = require("./env");
const databaseUrl = (0, env_1.requireEnv)("DATABASE_URL");
exports.sequelize = new sequelize_1.Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});
let dbOk = false;
let dbError = null;
function getDatabaseStatus() {
    return { ok: dbOk, error: dbError };
}
async function initDatabase() {
    try {
        await exports.sequelize.authenticate();
        const shouldAlter = String(process.env.DB_SYNC_ALTER || "").toLowerCase() === "true";
        await exports.sequelize.sync({ alter: shouldAlter });
        dbOk = true;
        dbError = null;
        // eslint-disable-next-line no-console
        console.log("Database connected successfully");
    }
    catch (error) {
        dbOk = false;
        dbError = error?.message ? String(error.message) : "Unknown database error";
        const detail = error?.original?.message || error?.parent?.message || error?.message || String(error);
        throw new Error(`Database connection failed: ${detail}`);
    }
}
