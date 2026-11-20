"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_NOTIFICATION_TEMPLATES = exports.DEFAULT_RECONCILIATION_SETTINGS = exports.DEFAULT_PERFORMANCE_SETTINGS = exports.DEFAULT_BONUS_SETTINGS = exports.PERFORMANCE_ILLUSTRATIVE_DISCLAIMER = void 0;
exports.ensurePlatformSettings = ensurePlatformSettings;
exports.getBonusSettings = getBonusSettings;
exports.getPerformanceSettings = getPerformanceSettings;
exports.getReconciliationSettings = getReconciliationSettings;
exports.getNotificationTemplates = getNotificationTemplates;
exports.getPlatformSettings = getPlatformSettings;
exports.savePlatformSetting = savePlatformSetting;
exports.listPlatformSettings = listPlatformSettings;
exports.resetPlatformSettings = resetPlatformSettings;
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const PlatformSetting_1 = require("../models/PlatformSetting");
const earningsRules_1 = require("../domain/earningsRules");
exports.PERFORMANCE_ILLUSTRATIVE_DISCLAIMER = "Projected figures only. A modelled daily percentage applied to invested principal is not a guaranteed or manufactured return and is never credited. Only independently verified valuations produce reportable performance.";
exports.DEFAULT_BONUS_SETTINGS = {
    active: true,
    percentage: "5.000000",
    minDeposit: "0.00000000",
    maxBonus: null,
    eligibleAssets: null,
    campaignDescription: "Standard 5% promotional bonus on independently verified deposits."
};
exports.DEFAULT_PERFORMANCE_SETTINGS = {
    automaticDailyCalculation: true,
    illustrativeDailyRatePercent: "3.000000",
    illustrativePeriodDays: earningsRules_1.DEFAULT_EARNINGS_PERIOD_DAYS,
    illustrativeDisclaimer: exports.PERFORMANCE_ILLUSTRATIVE_DISCLAIMER,
    requireVerifiedValuation: true
};
exports.DEFAULT_RECONCILIATION_SETTINGS = {
    reconcileBonusesDaily: true,
    reconcilePerformanceDaily: true,
    toleranceAmount: "0.00000000"
};
exports.DEFAULT_NOTIFICATION_TEMPLATES = {
    depositConfirmation: "Deposit {amount} {asset} confirmed. Reference {reference}.",
    promotionalBonusCredited: "Promotional bonus of {amount} {asset} credited from campaign {campaign}. Reference {reference}.",
    rewardGranted: "Reward {reward} of {amount} {asset} granted to your account. Reference {reference}.",
    rewardRedeemed: "Reward {reward} of {amount} {asset} redeemed into your available balance. Reference {reference}.",
    investmentAllocation: "Investment allocation of {amount} {asset} recorded against verified position {position}. Reference {reference}.",
    verifiedTradingActivity: "Verified trading activity recorded for {asset}: {detail}. Reference {reference}.",
    dailyPerformance: "Daily performance for {date}: {detail}. Source {source}. Reference {reference}.",
    profitRealised: "Realised earnings of {amount} {asset} credited to your withdrawable balance. Reference {reference}.",
    withdrawalProcessing: "Withdrawal {amount} {asset} is processing. Reference {reference}.",
    withdrawalCompleted: "Withdrawal {amount} {asset} completed. Reference {reference}."
};
const RESERVED_KEYS = [
    { category: "bonus", key: "defaults", value: exports.DEFAULT_BONUS_SETTINGS, description: "Default promotional bonus configuration." },
    { category: "performance", key: "settings", value: exports.DEFAULT_PERFORMANCE_SETTINGS, description: "Daily investment performance engine configuration." },
    { category: "reconciliation", key: "settings", value: exports.DEFAULT_RECONCILIATION_SETTINGS, description: "Financial reconciliation configuration." },
    { category: "notifications", key: "templates", value: exports.DEFAULT_NOTIFICATION_TEMPLATES, description: "Notification message templates for financial events." }
];
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function asString(value, fallback) {
    return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
function asBoolean(value, fallback) {
    return typeof value === "boolean" ? value : fallback;
}
function asNullableString(value) {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function asStringArray(value) {
    if (!Array.isArray(value))
        return null;
    const cleaned = value.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
    return cleaned.length > 0 ? cleaned : null;
}
async function ensurePlatformSettings() {
    for (const reserved of RESERVED_KEYS) {
        const existing = await PlatformSetting_1.PlatformSetting.findOne({ where: { category: reserved.category, key: reserved.key } });
        if (existing)
            continue;
        await PlatformSetting_1.PlatformSetting.create(reserved);
    }
}
async function readSetting(category, key, fallback) {
    const row = await PlatformSetting_1.PlatformSetting.findOne({ where: { category, key } });
    if (!row)
        return fallback;
    return row.value;
}
async function getBonusSettings() {
    const raw = asRecord(await readSetting("bonus", "defaults", exports.DEFAULT_BONUS_SETTINGS));
    return {
        active: asBoolean(raw.active, exports.DEFAULT_BONUS_SETTINGS.active),
        percentage: asString(raw.percentage, exports.DEFAULT_BONUS_SETTINGS.percentage),
        minDeposit: asString(raw.minDeposit, exports.DEFAULT_BONUS_SETTINGS.minDeposit),
        maxBonus: asNullableString(raw.maxBonus),
        eligibleAssets: asStringArray(raw.eligibleAssets),
        campaignDescription: asString(raw.campaignDescription, exports.DEFAULT_BONUS_SETTINGS.campaignDescription)
    };
}
async function getPerformanceSettings() {
    const raw = asRecord(await readSetting("performance", "settings", exports.DEFAULT_PERFORMANCE_SETTINGS));
    return {
        automaticDailyCalculation: asBoolean(raw.automaticDailyCalculation, exports.DEFAULT_PERFORMANCE_SETTINGS.automaticDailyCalculation),
        illustrativeDailyRatePercent: asString(raw.illustrativeDailyRatePercent, exports.DEFAULT_PERFORMANCE_SETTINGS.illustrativeDailyRatePercent),
        illustrativePeriodDays: (0, earningsRules_1.earningsPeriodDays)(raw.illustrativePeriodDays),
        illustrativeDisclaimer: asString(raw.illustrativeDisclaimer, exports.DEFAULT_PERFORMANCE_SETTINGS.illustrativeDisclaimer),
        requireVerifiedValuation: asBoolean(raw.requireVerifiedValuation, exports.DEFAULT_PERFORMANCE_SETTINGS.requireVerifiedValuation)
    };
}
async function getReconciliationSettings() {
    const raw = asRecord(await readSetting("reconciliation", "settings", exports.DEFAULT_RECONCILIATION_SETTINGS));
    return {
        reconcileBonusesDaily: asBoolean(raw.reconcileBonusesDaily, exports.DEFAULT_RECONCILIATION_SETTINGS.reconcileBonusesDaily),
        reconcilePerformanceDaily: asBoolean(raw.reconcilePerformanceDaily, exports.DEFAULT_RECONCILIATION_SETTINGS.reconcilePerformanceDaily),
        toleranceAmount: asString(raw.toleranceAmount, exports.DEFAULT_RECONCILIATION_SETTINGS.toleranceAmount)
    };
}
async function getNotificationTemplates() {
    const raw = asRecord(await readSetting("notifications", "templates", exports.DEFAULT_NOTIFICATION_TEMPLATES));
    return {
        depositConfirmation: asString(raw.depositConfirmation, exports.DEFAULT_NOTIFICATION_TEMPLATES.depositConfirmation),
        promotionalBonusCredited: asString(raw.promotionalBonusCredited, exports.DEFAULT_NOTIFICATION_TEMPLATES.promotionalBonusCredited),
        rewardGranted: asString(raw.rewardGranted, exports.DEFAULT_NOTIFICATION_TEMPLATES.rewardGranted),
        rewardRedeemed: asString(raw.rewardRedeemed, exports.DEFAULT_NOTIFICATION_TEMPLATES.rewardRedeemed),
        investmentAllocation: asString(raw.investmentAllocation, exports.DEFAULT_NOTIFICATION_TEMPLATES.investmentAllocation),
        verifiedTradingActivity: asString(raw.verifiedTradingActivity, exports.DEFAULT_NOTIFICATION_TEMPLATES.verifiedTradingActivity),
        dailyPerformance: asString(raw.dailyPerformance, exports.DEFAULT_NOTIFICATION_TEMPLATES.dailyPerformance),
        profitRealised: asString(raw.profitRealised, exports.DEFAULT_NOTIFICATION_TEMPLATES.profitRealised),
        withdrawalProcessing: asString(raw.withdrawalProcessing, exports.DEFAULT_NOTIFICATION_TEMPLATES.withdrawalProcessing),
        withdrawalCompleted: asString(raw.withdrawalCompleted, exports.DEFAULT_NOTIFICATION_TEMPLATES.withdrawalCompleted)
    };
}
async function getPlatformSettings() {
    const [bonus, performance, reconciliation, notifications] = await Promise.all([
        getBonusSettings(),
        getPerformanceSettings(),
        getReconciliationSettings(),
        getNotificationTemplates()
    ]);
    return { bonus, performance, reconciliation, notifications };
}
async function savePlatformSetting(adminId, category, key, value, reason, description) {
    if (!reason.trim())
        throw new Error("A reason is required to change a platform setting.");
    const [row, created] = await PlatformSetting_1.PlatformSetting.findOrCreate({
        where: { category, key },
        defaults: { category, key, value, description: description ?? "", updated_by: adminId }
    });
    if (!created) {
        row.value = value;
        row.updated_by = adminId;
        row.updated_at = new Date();
        if (description)
            row.description = description;
        await row.save();
    }
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: "platform_setting_updated",
        entity_type: "platform_setting",
        entity_id: row.setting_id,
        reason,
        metadata: { category, key, value }
    });
    return row;
}
async function listPlatformSettings() {
    return PlatformSetting_1.PlatformSetting.findAll({ order: [["category", "ASC"], ["key", "ASC"]] });
}
async function resetPlatformSettings(adminId, reason) {
    if (!reason.trim())
        throw new Error("A reason is required to reset platform settings.");
    for (const reserved of RESERVED_KEYS) {
        const rows = await PlatformSetting_1.PlatformSetting.findAll({ where: { category: reserved.category, key: reserved.key } });
        if (rows.length === 0)
            continue;
        for (const row of rows) {
            row.value = reserved.value;
            row.updated_by = adminId;
            row.updated_at = new Date();
            await row.save();
        }
    }
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: "platform_settings_reset",
        entity_type: "platform_setting",
        entity_id: "all",
        reason,
        metadata: { keys: RESERVED_KEYS.map((entry) => `${entry.category}:${entry.key}`) }
    });
    return getPlatformSettings();
}
