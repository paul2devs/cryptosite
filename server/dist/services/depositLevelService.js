"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepositLevelDetailsFromTotal = getDepositLevelDetailsFromTotal;
exports.calculateDepositLevelForUser = calculateDepositLevelForUser;
exports.refreshUserDepositLevel = refreshUserDepositLevel;
const money_1 = require("../domain/money");
const investmentLevelRules_1 = require("../domain/investmentLevelRules");
const InvestmentLevel_1 = require("../models/InvestmentLevel");
const investmentLevelService_1 = require("./investmentLevelService");
function toRange(level) {
    return {
        id: level.level_config_id,
        levelNumber: level.level_number,
        thresholdCents: (0, money_1.parseDecimal)(String(level.qualification_threshold), 2),
        active: level.active,
        sortOrder: level.sort_order
    };
}
function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function getDepositLevelDetailsFromTotal(totalUsd, levels) {
    const safeTotal = Number.isFinite(totalUsd) && totalUsd > 0 ? totalUsd : 0;
    const amountCents = (0, money_1.parseDecimal)(safeTotal.toFixed(2), 2);
    const qualified = (0, investmentLevelRules_1.qualifyLevel)(amountCents, levels);
    const next = (0, investmentLevelRules_1.nextLevelAfter)(qualified ? qualified.levelNumber : null, levels);
    const nextRequiredTotal = next ? toNumber((0, money_1.formatDecimal)(next.thresholdCents, 2)) : null;
    const remainingToNext = next
        ? Math.max(0, toNumber((0, money_1.formatDecimal)(next.thresholdCents - amountCents, 2)))
        : null;
    return {
        totalDepositedUsd: safeTotal,
        level: qualified ? qualified.levelNumber : 0,
        currentLevelRequiredTotal: qualified ? toNumber((0, money_1.formatDecimal)(qualified.thresholdCents, 2)) : 0,
        nextLevel: next ? next.levelNumber : null,
        nextLevelRequiredTotal: nextRequiredTotal,
        remainingToNext
    };
}
async function calculateDepositLevelForUser(userId) {
    const [qualification, levels] = await Promise.all([
        (0, investmentLevelService_1.calculateQualifyingInvestment)(userId),
        InvestmentLevel_1.InvestmentLevel.findAll({ order: [["level_number", "ASC"]] })
    ]);
    const ranges = levels.map(toRange);
    // Surface the known USD value even when a volatile deposit could not be
    // valued, so a single unpriced asset never collapses the whole figure to zero.
    const totalUsd = qualification.amount !== null ? toNumber(qualification.amount) : 0;
    return getDepositLevelDetailsFromTotal(totalUsd, ranges);
}
async function refreshUserDepositLevel(user) {
    const stats = await calculateDepositLevelForUser(user.user_id);
    user.level = stats.level;
    await user.save();
    return stats;
}
