"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleBonusWatcher = scheduleBonusWatcher;
const node_cron_1 = __importDefault(require("node-cron"));
const sequelize_1 = require("sequelize");
const Bonus_1 = require("../models/Bonus");
const User_1 = require("../models/User");
const Notification_1 = require("../models/Notification");
let scheduled = false;
function scheduleBonusWatcher() {
    if (scheduled) {
        return;
    }
    scheduled = true;
    node_cron_1.default.schedule("*/1 * * * *", async () => {
        const now = new Date();
        await Bonus_1.Bonus.update({ is_active: true }, {
            where: {
                start_time: { [sequelize_1.Op.lte]: now },
                end_time: { [sequelize_1.Op.gt]: now },
                is_active: false
            }
        });
        await Bonus_1.Bonus.update({ is_active: false }, {
            where: {
                end_time: { [sequelize_1.Op.lte]: now },
                is_active: true
            }
        });
        const soon = new Date(now.getTime() + 10 * 60 * 1000);
        const expiring = await Bonus_1.Bonus.findAll({
            where: {
                end_time: { [sequelize_1.Op.gt]: now, [sequelize_1.Op.lte]: soon }
            }
        });
        if (expiring.length === 0) {
            return;
        }
        const users = await User_1.User.findAll();
        await Promise.all(expiring.map(async (bonus) => {
            const conditions = bonus.conditions || {};
            if (conditions.expiryAlertSent) {
                return;
            }
            await Promise.all(users.map((user) => Notification_1.Notification.create({
                type: "bonus_expiring",
                message: `Bonus "${bonus.label}" ends soon`,
                user_id: user.user_id
            })));
            bonus.conditions = {
                ...conditions,
                expiryAlertSent: true
            };
            await bonus.save();
        }));
    });
}
