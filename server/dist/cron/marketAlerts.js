"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleMarketAlerts = scheduleMarketAlerts;
const node_cron_1 = __importDefault(require("node-cron"));
const marketDataService_1 = require("../services/marketDataService");
const User_1 = require("../models/User");
const Notification_1 = require("../models/Notification");
let scheduled = false;
let lastAlertKey = null;
function scheduleMarketAlerts() {
    if (scheduled) {
        return;
    }
    scheduled = true;
    node_cron_1.default.schedule("*/5 * * * *", async () => {
        const prices = await (0, marketDataService_1.getAllMarketPrices)();
        const btc = prices.BTC;
        const eth = prices.ETH;
        if (!btc || !eth) {
            return;
        }
        const alerts = [];
        if (btc.change24h >= 5) {
            alerts.push(`BTC is up ${btc.change24h.toFixed(1)}% in the last 24h`);
        }
        else if (btc.change24h <= -5) {
            alerts.push(`BTC is down ${btc.change24h.toFixed(1)}% in the last 24h`);
        }
        if (eth.change24h >= 5) {
            alerts.push(`ETH is up ${eth.change24h.toFixed(1)}% in the last 24h`);
        }
        else if (eth.change24h <= -5) {
            alerts.push(`ETH is down ${eth.change24h.toFixed(1)}% in the last 24h`);
        }
        if (alerts.length === 0) {
            return;
        }
        const key = alerts.join("|");
        if (key === lastAlertKey) {
            return;
        }
        lastAlertKey = key;
        const users = await User_1.User.findAll();
        await Promise.all(users.map((user) => Promise.all(alerts.map((message) => Notification_1.Notification.create({
            type: "market_alert",
            message,
            user_id: user.user_id
        })))));
    });
}
