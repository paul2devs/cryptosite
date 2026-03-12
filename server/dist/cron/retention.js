"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleRetentionEngine = scheduleRetentionEngine;
const node_cron_1 = __importDefault(require("node-cron"));
const Deposit_1 = require("../models/Deposit");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const gamificationService_1 = require("../services/gamificationService");
const multiplierService_1 = require("../services/multiplierService");
function scheduleRetentionEngine() {
    node_cron_1.default.schedule("0 * * * *", async () => {
        try {
            const now = new Date();
            const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            const users = await User_1.User.findAll();
            for (const user of users) {
                const progression = await (0, gamificationService_1.getUserProgression)(user);
                const lastActivity = user.last_activity_at;
                const lastDeposit = await Deposit_1.Deposit.findOne({
                    where: { user_id: user.user_id, status: "Approved" },
                    order: [["timestamp", "DESC"]]
                });
                const inactive = !lastActivity || lastActivity < threeDaysAgo || !lastDeposit;
                const closeToNext = progression.xpToNext !== null && progression.xpToNext <= 50;
                if (inactive) {
                    await (0, multiplierService_1.grantTemporaryMultiplier)({
                        user,
                        type: "retention",
                        value: 0.1,
                        durationMinutes: 60 * 24
                    });
                    await Notification_1.Notification.create({
                        type: "retention_bonus",
                        message: "Welcome back bonus: limited-time earnings boost active for the next 24 hours.",
                        user_id: user.user_id
                    });
                    continue;
                }
                if (closeToNext && lastActivity && lastActivity >= dayAgo) {
                    await (0, multiplierService_1.grantTemporaryMultiplier)({
                        user,
                        type: "retention",
                        value: 0.05,
                        durationMinutes: 60 * 6
                    });
                    await Notification_1.Notification.create({
                        type: "retention_nudge",
                        message: "You are very close to the next level. A temporary XP boost is active on your next deposits.",
                        user_id: user.user_id
                    });
                }
            }
        }
        catch {
            // swallow errors so the scheduler keeps running
        }
    });
}
