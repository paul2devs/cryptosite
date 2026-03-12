"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleEarningsEngine = scheduleEarningsEngine;
const node_cron_1 = __importDefault(require("node-cron"));
const earningsEngineService_1 = require("../services/earningsEngineService");
function scheduleEarningsEngine() {
    node_cron_1.default.schedule("0 * * * *", async () => {
        try {
            await (0, earningsEngineService_1.processEarningsTick)("hourly");
        }
        catch {
            // swallow to avoid crashing scheduler
        }
    });
    node_cron_1.default.schedule("0 0 * * *", async () => {
        try {
            await (0, earningsEngineService_1.processEarningsTick)("daily");
        }
        catch {
            // swallow to avoid crashing scheduler
        }
    });
}
