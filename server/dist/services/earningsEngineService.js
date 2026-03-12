"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEarningsTick = processEarningsTick;
const sequelize_1 = require("sequelize");
const Deposit_1 = require("../models/Deposit");
const EarningsLog_1 = require("../models/EarningsLog");
const User_1 = require("../models/User");
const gamificationService_1 = require("./gamificationService");
const multiplierService_1 = require("./multiplierService");
const DEFAULT_MIN_HOLD_HOURS = 24;
const DEFAULT_MAX_EARNINGS_PER_LEVEL = 0.02;
function getMinHoldHours() {
    const raw = process.env.EARNINGS_MIN_HOLD_HOURS;
    const hours = raw ? Number(raw) : DEFAULT_MIN_HOLD_HOURS;
    if (!Number.isFinite(hours) || hours <= 0) {
        return DEFAULT_MIN_HOLD_HOURS;
    }
    return hours;
}
function getMaxEarningsRatePerLevel() {
    const raw = process.env.EARNINGS_MAX_PER_LEVEL;
    const val = raw ? Number(raw) : DEFAULT_MAX_EARNINGS_PER_LEVEL;
    if (!Number.isFinite(val) || val <= 0) {
        return DEFAULT_MAX_EARNINGS_PER_LEVEL;
    }
    return val;
}
async function processEarningsTick(tickType) {
    const now = new Date();
    const holdHours = getMinHoldHours();
    const deposits = await Deposit_1.Deposit.findAll({
        where: {
            status: "Approved",
            pending_earning: { [sequelize_1.Op.gt]: 0 },
            total_earned: {
                [sequelize_1.Op.lt]: { [sequelize_1.Op.col]: "pending_earning" }
            }
        }
    });
    for (const deposit of deposits) {
        const user = await User_1.User.findByPk(deposit.user_id);
        if (!user) {
            continue;
        }
        const approvedAt = deposit.approved_at || deposit.timestamp || deposit.get("timestamp");
        const approvedDate = approvedAt instanceof Date ? approvedAt : new Date(approvedAt);
        const hoursSinceApproval = (now.getTime() - approvedDate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceApproval < holdHours) {
            continue;
        }
        const level = await (0, gamificationService_1.getLevelForXp)(user.xp);
        const levelRate = getMaxEarningsRatePerLevel();
        const maxPerDay = deposit.amount * levelRate * level.level_id;
        const maxPerHour = maxPerDay / 24;
        const remaining = deposit.pending_earning - deposit.total_earned;
        if (remaining <= 0) {
            continue;
        }
        const growthFactor = tickType === "hourly" ? 1 / 24 : 1;
        const baseDelta = Math.min(remaining, maxPerHour * growthFactor);
        if (baseDelta <= 0) {
            continue;
        }
        const stackedMultiplier = await (0, multiplierService_1.getUserActiveMultiplierFactor)(user.user_id);
        const effectiveDelta = Math.min(remaining, baseDelta * stackedMultiplier);
        if (effectiveDelta <= 0) {
            continue;
        }
        deposit.total_earned += effectiveDelta;
        const canWithdraw = user.level >= (Number(process.env.WITHDRAWAL_MIN_LEVEL || 2) || 2);
        if (canWithdraw) {
            user.withdrawable_balance += effectiveDelta * 0.7;
            user.locked_balance += effectiveDelta * 0.3;
        }
        else {
            user.locked_balance += effectiveDelta;
        }
        await deposit.save();
        await user.save();
        await EarningsLog_1.EarningsLog.create({
            user_id: user.user_id,
            deposit_id: deposit.deposit_id,
            earned_amount: effectiveDelta,
            tick_type: tickType
        });
    }
}
