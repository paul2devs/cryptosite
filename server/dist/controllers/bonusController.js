"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveBonusesHandler = getActiveBonusesHandler;
const bonusService_1 = require("../services/bonusService");
async function getActiveBonusesHandler(_req, res) {
    try {
        const bonuses = await (0, bonusService_1.getPublicActiveBonuses)();
        res.status(200).json(bonuses);
    }
    catch {
        res.status(200).json([]);
    }
}
