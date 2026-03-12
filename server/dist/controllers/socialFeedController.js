"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocialFeed = getSocialFeed;
const Deposit_1 = require("../models/Deposit");
const SocialFeedSeen_1 = require("../models/SocialFeedSeen");
const User_1 = require("../models/User");
async function getSocialFeed(req, res) {
    if (!req.user) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
    try {
        const deposits = await Deposit_1.Deposit.findAll({
            where: { status: "Approved" },
            order: [["timestamp", "DESC"]],
            limit: 20,
            include: [{ model: User_1.User }]
        });
        const seen = await SocialFeedSeen_1.SocialFeedSeen.findAll({
            where: { user_id: req.user.userId }
        });
        const seenIds = new Set(seen.map((s) => s.deposit_id));
        const unseenDeposits = deposits.filter((d) => d.user_id !== req.user?.userId && !seenIds.has(d.deposit_id));
        const feed = unseenDeposits.slice(0, 10).map((d) => {
            const name = d.User?.name || d.User?.email || "Trader";
            const alias = `${name.slice(0, 3)}***`;
            return {
                deposit_id: d.deposit_id,
                alias,
                amount: d.amount,
                crypto_type: d.crypto_type,
                timestamp: d.timestamp
            };
        });
        await Promise.all(feed.map((item) => SocialFeedSeen_1.SocialFeedSeen.create({
            user_id: req.user.userId,
            deposit_id: item.deposit_id
        })));
        res.status(200).json(feed);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to load social feed" });
    }
}
