"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPortfolio = getPortfolio;
exports.getPortfolioOverviewHandler = getPortfolioOverviewHandler;
const portfolioService_1 = require("../services/portfolioService");
async function getPortfolio(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const summary = await (0, portfolioService_1.getPortfolioSummary)(req.user.userId);
        res.status(200).json(summary);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to load portfolio" });
    }
}
async function getPortfolioOverviewHandler(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const range = String(req.query.range || "30d");
        res.status(200).json(await (0, portfolioService_1.getPortfolioOverview)(req.user.userId, range));
    }
    catch (error) {
        res.status(500).json({ message: "Failed to load portfolio" });
    }
}
