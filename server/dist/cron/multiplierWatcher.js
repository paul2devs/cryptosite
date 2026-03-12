"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleMultiplierWatcher = scheduleMultiplierWatcher;
const node_cron_1 = __importDefault(require("node-cron"));
const sequelize_1 = require("sequelize");
const ActiveMultiplier_1 = require("../models/ActiveMultiplier");
const Notification_1 = require("../models/Notification");
const multiplierService_1 = require("../services/multiplierService");
function scheduleMultiplierWatcher() {
    node_cron_1.default.schedule("*/5 * * * *", async () => {
        try {
            const now = new Date();
            const soon = new Date(now.getTime() + 10 * 60 * 1000);
            const expiring = await ActiveMultiplier_1.ActiveMultiplier.findAll({
                where: {
                    expires_at: {
                        [sequelize_1.Op.gt]: now,
                        [sequelize_1.Op.lte]: soon
                    }
                }
            });
            await Promise.all(expiring.map((m) => Notification_1.Notification.create({
                type: "multiplier_expiring",
                message: `One of your multipliers (${m.type}) is ending soon`,
                user_id: m.user_id
            })));
            await (0, multiplierService_1.cleanExpiredMultipliers)();
        }
        catch {
            // ignore scheduler errors
        }
    });
}
