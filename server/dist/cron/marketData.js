"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleMarketDataRefresh = scheduleMarketDataRefresh;
const node_cron_1 = __importDefault(require("node-cron"));
const marketDataService_1 = require("../services/marketDataService");
let scheduled = false;
function scheduleMarketDataRefresh() {
    if (scheduled) {
        return;
    }
    scheduled = true;
    node_cron_1.default.schedule("*/15 * * * * *", async () => {
        await (0, marketDataService_1.refreshMarketData)();
    });
}
