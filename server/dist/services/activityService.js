"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackUserActivity = trackUserActivity;
const UserActivityEvent_1 = require("../models/UserActivityEvent");
async function trackUserActivity(userId, type, metadata = {}) {
    await UserActivityEvent_1.UserActivityEvent.create({
        user_id: userId,
        type,
        metadata
    });
}
