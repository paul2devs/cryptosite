"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleBonusOptimization = scheduleBonusOptimization;
const node_cron_1 = __importDefault(require("node-cron"));
const bonusOptimizationService_1 = require("../services/bonusOptimizationService");
function scheduleBonusOptimization() {
    node_cron_1.default.schedule("*/30 * * * *", async () => {
        await (0, bonusOptimizationService_1.runBonusOptimization)();
    });
}
