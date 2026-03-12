"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepositorsLeaderboard = getDepositorsLeaderboard;
exports.getEarningsLeaderboard = getEarningsLeaderboard;
exports.getStreaksLeaderboard = getStreaksLeaderboard;
exports.getGrowthLeaderboard = getGrowthLeaderboard;
const leaderboardService_1 = require("../services/leaderboardService");
async function getDepositorsLeaderboard(_req, res) {
    try {
        const data = await (0, leaderboardService_1.getTopDepositors)();
        res.status(200).json(data);
    }
    catch {
        res.status(200).json([]);
    }
}
async function getEarningsLeaderboard(_req, res) {
    try {
        const data = await (0, leaderboardService_1.getWeeklyTopEarnings)();
        res.status(200).json(data);
    }
    catch {
        res.status(200).json([]);
    }
}
async function getStreaksLeaderboard(_req, res) {
    try {
        const data = await (0, leaderboardService_1.getHighestStreaks)();
        res.status(200).json(data);
    }
    catch {
        res.status(200).json([]);
    }
}
async function getGrowthLeaderboard(_req, res) {
    try {
        const data = await (0, leaderboardService_1.getFastestGrowing)();
        res.status(200).json(data);
    }
    catch {
        res.status(200).json([]);
    }
}
