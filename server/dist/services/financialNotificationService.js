"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderTemplate = renderTemplate;
exports.notificationEnabled = notificationEnabled;
exports.notifyFinancialEvent = notifyFinancialEvent;
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const platformSettingsService_1 = require("./platformSettingsService");
const NOTIFICATION_FLAG = {
    deposit_confirmed: "deposit_updates",
    promotional_bonus_credited: "rewards_bonuses",
    reward_granted: "rewards_bonuses",
    reward_redeemed: "rewards_bonuses",
    investment_allocation: "investment_updates",
    verified_trading_activity: "investment_updates",
    daily_performance: "performance_updates",
    profit_realised: "performance_updates",
    withdrawal_processing: "withdrawal_updates",
    withdrawal_completed: "withdrawal_updates"
};
function renderTemplate(template, variables) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        const value = variables[key];
        return value === undefined ? match : value;
    });
}
// Financial events are opt-out: an explicit `false` disables them, but a missing
// flag keeps the required disclosure enabled so users always receive an accurate
// record of money moving on their account.
function notificationEnabled(settings, type) {
    if (!settings || typeof settings !== "object")
        return true;
    const notifications = settings.notifications;
    if (!notifications || typeof notifications !== "object")
        return true;
    const value = notifications[NOTIFICATION_FLAG[type]];
    return typeof value === "boolean" ? value : true;
}
async function notifyFinancialEvent(input) {
    const user = await User_1.User.findByPk(input.userId);
    if (!user)
        return null;
    if (!notificationEnabled(user.account_settings, input.type))
        return null;
    const templates = await (0, platformSettingsService_1.getNotificationTemplates)();
    const template = templates[input.templateKey] || input.fallbackMessage;
    const message = renderTemplate(template, input.variables).slice(0, 500);
    const existing = await Notification_1.Notification.findOne({
        where: { user_id: input.userId, type: input.type, message }
    });
    if (existing)
        return existing;
    return Notification_1.Notification.create({ user_id: input.userId, type: input.type, message });
}
