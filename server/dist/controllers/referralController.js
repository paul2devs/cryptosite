"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyReferralDashboard = getMyReferralDashboard;
const referralService_1 = require("../services/referralService");
async function getMyReferralDashboard(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const dashboard = await (0, referralService_1.getReferralDashboard)(req.user.userId);
        res.status(200).json(dashboard);
    }
    catch (error) {
        res.status(500).json({ message: error?.message || "Failed to load referral dashboard" });
    }
}
