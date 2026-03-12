"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminOverview = getAdminOverview;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const Withdrawal_1 = require("../models/Withdrawal");
const User_1 = require("../models/User");
const bonusOptimizationService_1 = require("./bonusOptimizationService");
const ChurnPrediction_1 = require("../models/ChurnPrediction");
const Referral_1 = require("../models/Referral");
async function getAdminOverview(days) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateExpr = (c) => (0, sequelize_1.fn)("DATE", (0, sequelize_1.col)(c));
    const deposits = (await Deposit_1.Deposit.findAll({
        where: { timestamp: { [sequelize_1.Op.gte]: since }, status: "Approved" },
        attributes: [
            [dateExpr("timestamp"), "date"],
            [(0, sequelize_1.fn)("SUM", (0, sequelize_1.col)("amount")), "volume"],
            [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("deposit_id")), "count"]
        ],
        group: [(0, sequelize_1.literal)("date")],
        order: [[(0, sequelize_1.literal)("date"), "ASC"]]
    }));
    const withdrawals = (await Withdrawal_1.Withdrawal.findAll({
        where: { timestamp: { [sequelize_1.Op.gte]: since } },
        attributes: [
            [dateExpr("timestamp"), "date"],
            [(0, sequelize_1.fn)("SUM", (0, sequelize_1.col)("amount")), "volume"],
            [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("withdrawal_id")), "count"]
        ],
        group: [(0, sequelize_1.literal)("date")],
        order: [[(0, sequelize_1.literal)("date"), "ASC"]]
    }));
    const newUsers = (await User_1.User.findAll({
        where: { created_at: { [sequelize_1.Op.gte]: since } },
        attributes: [[dateExpr("created_at"), "date"], [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("user_id")), "count"]],
        group: [(0, sequelize_1.literal)("date")],
        order: [[(0, sequelize_1.literal)("date"), "ASC"]]
    }));
    const activeUsers = (await User_1.User.findAll({
        where: { last_activity_at: { [sequelize_1.Op.gte]: since } },
        attributes: [[dateExpr("last_activity_at"), "date"], [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("user_id")), "count"]],
        group: [(0, sequelize_1.literal)("date")],
        order: [[(0, sequelize_1.literal)("date"), "ASC"]]
    }));
    const churnRows = await ChurnPrediction_1.ChurnPrediction.findAll();
    const churnBuckets = churnRows.reduce((acc, r) => {
        acc[r.risk_level] += 1;
        return acc;
    }, { low: 0, medium: 0, high: 0 });
    const referralTop = (await Referral_1.Referral.findAll({
        attributes: [
            ["referrer_id", "referrer_id"],
            [(0, sequelize_1.fn)("COUNT", (0, sequelize_1.col)("id")), "invited"]
        ],
        group: ["referrer_id"],
        order: [[(0, sequelize_1.literal)("invited"), "DESC"]],
        limit: 20
    }));
    return {
        dynamicBonusFactor: await (0, bonusOptimizationService_1.getDynamicBonusFactor)(),
        deposits: deposits.map((r) => ({
            date: new Date(r.get("date")).toISOString().slice(0, 10),
            volume: Number(r.get("volume") || 0),
            count: Number(r.get("count") || 0)
        })),
        withdrawals: withdrawals.map((r) => ({
            date: new Date(r.get("date")).toISOString().slice(0, 10),
            volume: Number(r.get("volume") || 0),
            count: Number(r.get("count") || 0)
        })),
        newUsers: newUsers.map((r) => ({
            date: new Date(r.get("date")).toISOString().slice(0, 10),
            count: Number(r.get("count") || 0)
        })),
        activeUsers: activeUsers.map((r) => ({
            date: new Date(r.get("date")).toISOString().slice(0, 10),
            count: Number(r.get("count") || 0)
        })),
        churnBuckets,
        referralTop: referralTop.map((r) => ({
            referrer_id: String(r.get("referrer_id")),
            invited: Number(r.get("invited") || 0)
        }))
    };
}
