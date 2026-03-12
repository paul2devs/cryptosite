"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveBonuses = getActiveBonuses;
exports.getActiveBonusMultiplierForCrypto = getActiveBonusMultiplierForCrypto;
exports.getPublicActiveBonuses = getPublicActiveBonuses;
const sequelize_1 = require("sequelize");
const Bonus_1 = require("../models/Bonus");
const cache_1 = require("../config/cache");
const bonusOptimizationService_1 = require("./bonusOptimizationService");
const ACTIVE_BONUS_CACHE_KEY = "bonuses:active";
const ACTIVE_BONUS_TTL_SECONDS = 15;
async function getActiveBonuses() {
    const now = new Date();
    const cached = await (0, cache_1.getCachedJson)(ACTIVE_BONUS_CACHE_KEY);
    if (cached) {
        return cached.map(deserializeBonus);
    }
    const bonuses = await Bonus_1.Bonus.findAll({
        where: {
            start_time: { [sequelize_1.Op.lte]: now },
            end_time: { [sequelize_1.Op.gt]: now }
        },
        order: [["multiplier", "DESC"]]
    });
    await (0, cache_1.setCachedJson)(ACTIVE_BONUS_CACHE_KEY, bonuses.map(serializeBonus), ACTIVE_BONUS_TTL_SECONDS);
    return bonuses;
}
async function getActiveBonusMultiplierForCrypto(cryptoType) {
    const bonuses = await getActiveBonuses();
    if (bonuses.length === 0) {
        return 1;
    }
    const applicable = bonuses.filter((b) => {
        const conditions = b.conditions || {};
        const allowedAssets = conditions.assets;
        if (!allowedAssets || allowedAssets.length === 0) {
            return true;
        }
        return allowedAssets.includes(cryptoType);
    });
    if (applicable.length === 0) {
        return 1;
    }
    const base = applicable.reduce((acc, b) => acc * b.multiplier, 1);
    const dynamic = await (0, bonusOptimizationService_1.getDynamicBonusFactor)();
    return base * dynamic;
}
async function getPublicActiveBonuses() {
    const bonuses = await getActiveBonuses();
    return bonuses.map((b) => ({
        bonus_id: b.bonus_id,
        label: b.label,
        multiplier: b.multiplier,
        start_time: b.start_time.toISOString(),
        end_time: b.end_time.toISOString()
    }));
}
function serializeBonus(b) {
    return {
        bonus_id: b.bonus_id,
        type: b.type,
        label: b.label,
        multiplier: b.multiplier,
        start_time: b.start_time.toISOString(),
        end_time: b.end_time.toISOString(),
        conditions: b.conditions,
        is_active: b.is_active
    };
}
function deserializeBonus(attrs) {
    return Bonus_1.Bonus.build({
        bonus_id: attrs.bonus_id,
        type: attrs.type,
        label: attrs.label,
        multiplier: attrs.multiplier,
        start_time: new Date(attrs.start_time),
        end_time: new Date(attrs.end_time),
        conditions: attrs.conditions,
        is_active: attrs.is_active
    });
}
