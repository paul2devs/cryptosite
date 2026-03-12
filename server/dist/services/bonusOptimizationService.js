"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDynamicBonusFactor = getDynamicBonusFactor;
exports.runBonusOptimization = runBonusOptimization;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const Withdrawal_1 = require("../models/Withdrawal");
const cache_1 = require("../config/cache");
const BonusOptimizationLog_1 = require("../models/BonusOptimizationLog");
const DYNAMIC_BONUS_KEY = "bonuses:dynamic_factor";
async function getDynamicBonusFactor() {
    const cached = await (0, cache_1.getCachedJson)(DYNAMIC_BONUS_KEY);
    if (cached && Number.isFinite(cached.factor) && cached.factor > 0) {
        return cached.factor;
    }
    return 1;
}
async function setDynamicBonusFactor(factor) {
    await (0, cache_1.setCachedJson)(DYNAMIC_BONUS_KEY, { factor }, 6 * 60 * 60);
}
function clamp(x, min, max) {
    if (x < min)
        return min;
    if (x > max)
        return max;
    return x;
}
async function runBonusOptimization() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const deposits24 = await Deposit_1.Deposit.sum("amount", {
        where: { status: "Approved", timestamp: { [sequelize_1.Op.gte]: dayAgo } }
    });
    const deposits7d = await Deposit_1.Deposit.sum("amount", {
        where: { status: "Approved", timestamp: { [sequelize_1.Op.gte]: weekAgo } }
    });
    const withdrawals24 = await Withdrawal_1.Withdrawal.sum("amount", {
        where: { timestamp: { [sequelize_1.Op.gte]: dayAgo } }
    });
    const dep24 = Number(deposits24 || 0);
    const dep7 = Number(deposits7d || 0);
    const avgDaily = dep7 > 0 ? dep7 / 7 : dep24;
    const dropRatio = avgDaily > 0 ? clamp((avgDaily - dep24) / avgDaily, 0, 1) : 0;
    const withdrawalPressure = avgDaily > 0 ? clamp(Number(withdrawals24 || 0) / avgDaily, 0, 3) : 0;
    const current = await getDynamicBonusFactor();
    let next = current;
    let reason = "stable";
    if (dropRatio >= 0.25) {
        next = clamp(current + 0.05 + dropRatio * 0.1, 1, 1.25);
        reason = "deposits_down";
    }
    if (withdrawalPressure >= 0.9) {
        next = clamp(next - 0.08 * clamp(withdrawalPressure - 0.9, 0, 1.5), 0.85, 1.25);
        reason = reason === "stable" ? "withdrawals_up" : `${reason}+withdrawals_up`;
    }
    next = Math.round(next * 100) / 100;
    if (next !== current) {
        await setDynamicBonusFactor(next);
        await BonusOptimizationLog_1.BonusOptimizationLog.create({
            adjustment_type: "dynamic_bonus_factor",
            reason,
            impact: `factor ${current} -> ${next}`
        });
    }
}
