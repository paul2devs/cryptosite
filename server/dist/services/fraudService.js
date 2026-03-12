"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFraudSweep = runFraudSweep;
const sequelize_1 = require("sequelize");
const Notification_1 = require("../models/Notification");
const Referral_1 = require("../models/Referral");
const User_1 = require("../models/User");
const Deposit_1 = require("../models/Deposit");
function normalizeWallets(wallets) {
    if (!Array.isArray(wallets))
        return [];
    return wallets
        .map((w) => String(w?.address || "").trim().toLowerCase())
        .filter(Boolean);
}
async function runFraudSweep() {
    const users = await User_1.User.findAll();
    const addressMap = new Map();
    for (const u of users) {
        const addrs = normalizeWallets(u.crypto_wallets);
        for (const addr of addrs) {
            const arr = addressMap.get(addr) || [];
            arr.push(u.user_id);
            addressMap.set(addr, arr);
        }
    }
    const duplicated = Array.from(addressMap.entries()).filter(([, ids]) => ids.length >= 2);
    for (const [addr, ids] of duplicated) {
        for (const id of ids) {
            const u = users.find((x) => x.user_id === id);
            if (u && !u.bonus_blocked) {
                u.bonus_blocked = true;
                await u.save();
                await Notification_1.Notification.create({
                    type: "fraud_flag",
                    message: "Bonus eligibility restricted due to wallet duplication checks.",
                    user_id: null
                });
            }
        }
        await Notification_1.Notification.create({
            type: "fraud_wallet_duplicate",
            message: `Duplicate wallet address detected: ${addr}`,
            user_id: null
        });
    }
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReferrals = await Referral_1.Referral.findAll({
        where: { created_at: { [sequelize_1.Op.gte]: dayAgo } }
    });
    const byReferrer = new Map();
    for (const r of recentReferrals) {
        const arr = byReferrer.get(r.referrer_id) || [];
        arr.push(r.referred_user_id);
        byReferrer.set(r.referrer_id, arr);
    }
    for (const [referrerId, referredIds] of byReferrer.entries()) {
        if (referredIds.length < 6)
            continue;
        const approvedDepositsCount = await Deposit_1.Deposit.count({
            where: {
                user_id: { [sequelize_1.Op.in]: referredIds },
                status: "Approved"
            }
        });
        const conversion = referredIds.length > 0 ? approvedDepositsCount / referredIds.length : 0;
        if (conversion < 0.15) {
            const referrer = users.find((u) => u.user_id === referrerId);
            if (referrer && !referrer.bonus_blocked) {
                referrer.bonus_blocked = true;
                await referrer.save();
            }
            await Notification_1.Notification.create({
                type: "fraud_referral_abuse",
                message: `Referral abuse suspected for referrer ${referrerId} (low conversion).`,
                user_id: null
            });
        }
    }
}
