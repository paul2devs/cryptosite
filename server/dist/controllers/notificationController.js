"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserNotifications = getUserNotifications;
exports.getUnseenNotifications = getUnseenNotifications;
exports.markNotificationSeen = markNotificationSeen;
exports.trackNotificationClick = trackNotificationClick;
exports.createBroadcastNotification = createBroadcastNotification;
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const activityService_1 = require("../services/activityService");
async function getUserNotifications(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const notifications = await Notification_1.Notification.findAll({
            where: { user_id: req.user.userId },
            order: [["timestamp", "DESC"]]
        });
        res.status(200).json(notifications);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
}
async function getUnseenNotifications(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const notifications = await Notification_1.Notification.findAll({
            where: { user_id: req.user.userId, seen: false },
            order: [["timestamp", "DESC"]]
        });
        await Notification_1.Notification.update({ seen: true }, {
            where: {
                user_id: req.user.userId,
                seen: false
            }
        });
        res.status(200).json(notifications);
    }
    catch (error) {
        res.status(200).json([]);
    }
}
async function markNotificationSeen(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { id } = req.params;
    try {
        const notification = await Notification_1.Notification.findByPk(id);
        if (!notification || notification.user_id !== req.user.userId) {
            res.status(404).json({ message: "Notification not found" });
            return;
        }
        notification.seen = true;
        await notification.save();
        res.status(200).json(notification);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update notification" });
    }
}
async function trackNotificationClick(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    const { id } = req.params;
    try {
        const notification = await Notification_1.Notification.findByPk(id);
        if (!notification || notification.user_id !== req.user.userId) {
            res.status(404).json({ message: "Notification not found" });
            return;
        }
        await (0, activityService_1.trackUserActivity)(req.user.userId, "notification_click", {
            notification_id: id,
            type: notification.type
        });
        res.status(204).send();
    }
    catch {
        res.status(500).json({ message: "Failed to track click" });
    }
}
async function createBroadcastNotification(req, res) {
    const { type, message } = req.body;
    if (!type || !message) {
        res.status(400).json({ message: "Type and message are required" });
        return;
    }
    try {
        const users = await User_1.User.findAll();
        await Promise.all(users.map((user) => Notification_1.Notification.create({
            type,
            message,
            user_id: user.user_id
        })));
        res.status(201).json({ created: users.length });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create broadcast" });
    }
}
