"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleMarketDataRefresh = scheduleMarketDataRefresh;
const node_cron_1 = __importDefault(require("node-cron"));
const marketDataService_1 = require("../services/marketDataService");
let scheduled = false;
/**
 * Collapse the configured refresh interval (milliseconds) into a cron
 * expression. `refreshMarketData` gates on the same interval internally, so an
 * accidental extra trigger can never increase upstream provider traffic.
 */
function cronExpressionForInterval(intervalMs) {
    const seconds = Math.max(5, Math.round(intervalMs / 1000));
    if (seconds < 60) {
        return `*/${seconds} * * * * *`;
    }
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `*/${minutes} * * * *`;
}
/**
 * Start the single central refresh used by every instance. It runs on a fixed
 * schedule (not per visitor) so provider rate limits are respected, and primes
 * once at startup so the first request does not wait on a cold cache.
 */
function scheduleMarketDataRefresh() {
    if (scheduled) {
        return;
    }
    scheduled = true;
    node_cron_1.default.schedule(cronExpressionForInterval((0, marketDataService_1.getMarketRefreshIntervalMs)()), () => {
        void (0, marketDataService_1.refreshMarketData)();
    });
    void (0, marketDataService_1.refreshMarketData)(true);
}
