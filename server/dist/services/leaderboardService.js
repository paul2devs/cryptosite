"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopDepositors = getTopDepositors;
exports.getWeeklyTopEarnings = getWeeklyTopEarnings;
exports.getHighestStreaks = getHighestStreaks;
exports.getFastestGrowing = getFastestGrowing;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const User_1 = require("../models/User");
const cache_1 = require("../config/cache");
const LEADERBOARD_CACHE_TTL_SECONDS = 30;
async function cacheOrLoad(key, loader) {
    const cached = await (0, cache_1.getCachedJson)(key);
    if (cached) {
        return cached;
    }
    const data = await loader();
    await (0, cache_1.setCachedJson)(key, data, LEADERBOARD_CACHE_TTL_SECONDS);
    return data;
}
function makeAlias(user) {
    const base = user.name || user.email;
    const prefix = base.slice(0, 3).toUpperCase();
    const suffix = user.user_id.slice(0, 2).toUpperCase();
    return `${prefix}${suffix}`;
}
async function getTopDepositors() {
    return cacheOrLoad("leaderboard:depositors", async () => {
        const rows = await Deposit_1.Deposit.findAll({
            attributes: [
                "user_id",
                [(0, sequelize_1.fn)("SUM", (0, sequelize_1.col)("amount")), "totalDeposited"]
            ],
            where: { status: "Approved" },
            group: ["Deposit.user_id", "User.user_id"],
            order: [[(0, sequelize_1.literal)("totalDeposited"), "DESC"]],
            limit: 20,
            include: [
                {
                    model: User_1.User,
                    attributes: ["user_id", "name", "email"]
                }
            ]
        });
        return rows.map((row) => {
            const user = row.User;
            return {
                userId: row.user_id,
                alias: makeAlias(user),
                value: Number(row.get("totalDeposited"))
            };
        });
    });
}
async function getWeeklyTopEarnings() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return cacheOrLoad("leaderboard:earnings", async () => {
        const rows = await Deposit_1.Deposit.findAll({
            attributes: [
                "user_id",
                [(0, sequelize_1.fn)("SUM", (0, sequelize_1.col)("pending_earning")), "totalEarnings"]
            ],
            where: {
                status: "Approved",
                timestamp: { [sequelize_1.Op.gte]: weekAgo }
            },
            group: ["Deposit.user_id", "User.user_id"],
            order: [[(0, sequelize_1.literal)("totalEarnings"), "DESC"]],
            limit: 20,
            include: [
                {
                    model: User_1.User,
                    attributes: ["user_id", "name", "email"]
                }
            ]
        });
        return rows.map((row) => {
            const user = row.User;
            return {
                userId: row.user_id,
                alias: makeAlias(user),
                value: Number(row.get("totalEarnings"))
            };
        });
    });
}
async function getHighestStreaks() {
    return cacheOrLoad("leaderboard:streaks", async () => {
        const users = await User_1.User.findAll({
            where: { streak: { [sequelize_1.Op.gt]: 0 } },
            order: [["streak", "DESC"]],
            limit: 20
        });
        return users.map((u) => ({
            userId: u.user_id,
            alias: makeAlias(u),
            value: u.streak
        }));
    });
}
async function getFastestGrowing() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return cacheOrLoad("leaderboard:growth", async () => {
        const rows = await Deposit_1.Deposit.findAll({
            attributes: [
                "user_id",
                [(0, sequelize_1.fn)("SUM", (0, sequelize_1.col)("pending_earning")), "growthScore"]
            ],
            where: {
                status: "Approved",
                timestamp: { [sequelize_1.Op.gte]: weekAgo }
            },
            group: ["Deposit.user_id", "User.user_id"],
            order: [[(0, sequelize_1.literal)("growthScore"), "DESC"]],
            limit: 20,
            include: [
                {
                    model: User_1.User,
                    attributes: ["user_id", "name", "email"]
                }
            ]
        });
        return rows.map((row) => {
            const user = row.User;
            return {
                userId: row.user_id,
                alias: makeAlias(user),
                value: Number(row.get("growthScore"))
            };
        });
    });
}
