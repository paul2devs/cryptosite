"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserActiveMultiplierFactor = getUserActiveMultiplierFactor;
exports.grantTemporaryMultiplier = grantTemporaryMultiplier;
exports.cleanExpiredMultipliers = cleanExpiredMultipliers;
const sequelize_1 = require("sequelize");
const ActiveMultiplier_1 = require("../models/ActiveMultiplier");
const DEFAULT_MAX_STACKED_MULTIPLIER = 2;
const DEFAULT_DIMINISHING_FACTOR = 0.5;
function getMaxStackedMultiplier() {
    const raw = process.env.MULTIPLIER_MAX_STACKED;
    if (!raw) {
        return DEFAULT_MAX_STACKED_MULTIPLIER;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_MAX_STACKED_MULTIPLIER;
    }
    return parsed;
}
function getDiminishingFactor() {
    const raw = process.env.MULTIPLIER_DIMINISHING_FACTOR;
    if (!raw) {
        return DEFAULT_DIMINISHING_FACTOR;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_DIMINISHING_FACTOR;
    }
    return parsed;
}
async function getUserActiveMultiplierFactor(userId) {
    const now = new Date();
    const multipliers = await ActiveMultiplier_1.ActiveMultiplier.findAll({
        where: {
            user_id: userId,
            expires_at: { [sequelize_1.Op.gt]: now }
        }
    });
    if (multipliers.length === 0) {
        return 1;
    }
    const sum = multipliers.reduce((acc, m) => acc + m.value, 0);
    if (sum <= 0) {
        return 1;
    }
    const diminishingFactor = getDiminishingFactor();
    const adjusted = sum / (1 + diminishingFactor * sum);
    const capped = Math.min(adjusted, getMaxStackedMultiplier() - 1);
    return 1 + Math.max(0, capped);
}
async function grantTemporaryMultiplier(params) {
    const expiresAt = new Date(Date.now() + params.durationMinutes * 60 * 1000);
    await ActiveMultiplier_1.ActiveMultiplier.create({
        user_id: params.user.user_id,
        type: params.type,
        value: params.value,
        expires_at: expiresAt
    });
}
async function cleanExpiredMultipliers() {
    const now = new Date();
    const result = await ActiveMultiplier_1.ActiveMultiplier.destroy({
        where: {
            expires_at: {
                [sequelize_1.Op.lte]: now
            }
        }
    });
    return result;
}
