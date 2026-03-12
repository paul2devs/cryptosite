"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleStreakReset = scheduleStreakReset;
const node_cron_1 = __importDefault(require("node-cron"));
const sequelize_1 = require("sequelize");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
function scheduleStreakReset() {
    node_cron_1.default.schedule("15 2 * * *", async () => {
        const now = new Date();
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const users = await User_1.User.findAll({
            where: {
                streak: { [sequelize_1.Op.gt]: 0 },
                last_activity_at: {
                    [sequelize_1.Op.or]: [
                        { [sequelize_1.Op.lt]: yesterday },
                        {
                            [sequelize_1.Op.is]: null
                        }
                    ]
                }
            }
        });
        for (const user of users) {
            user.streak = 0;
            await user.save();
            await Notification_1.Notification.create({
                type: "streak_reset",
                message: "Your streak has reset. Come back today to start again.",
                user_id: user.user_id
            });
        }
    });
}
