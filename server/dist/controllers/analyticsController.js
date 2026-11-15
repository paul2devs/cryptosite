"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminAnalyticsOverview = getAdminAnalyticsOverview;
exports.getAdminActivityHeatmap = getAdminActivityHeatmap;
const analyticsService_1 = require("../services/analyticsService");
const heatmapService_1 = require("../services/heatmapService");
function parseDays(req, fallback) {
    const raw = String(req.query.days || "");
    const parsed = raw ? Number(raw) : fallback;
    if (!Number.isFinite(parsed) || parsed <= 0)
        return fallback;
    return Math.min(180, Math.max(1, Math.floor(parsed)));
}
async function getAdminAnalyticsOverview(req, res, next) {
    try {
        const days = parseDays(req, 30);
        const data = await (0, analyticsService_1.getAdminOverview)(days);
        res.status(200).json({ days, ...data });
    }
    catch (error) {
        next(error);
    }
}
async function getAdminActivityHeatmap(req, res, next) {
    try {
        const days = parseDays(req, 30);
        const heatmap = await (0, heatmapService_1.getActivityHeatmap)(days);
        res.status(200).json({ days, heatmap });
    }
    catch (error) {
        next(error);
    }
}
