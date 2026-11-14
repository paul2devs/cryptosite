"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runScheduledFinancialCycle = runScheduledFinancialCycle;
exports.schedulePerformanceEngine = schedulePerformanceEngine;
const node_cron_1 = __importDefault(require("node-cron"));
const User_1 = require("../models/User");
const bonusEngineService_1 = require("../services/bonusEngineService");
const performanceEngineService_1 = require("../services/performanceEngineService");
const platformSettingsService_1 = require("../services/platformSettingsService");
function previousDayKey(reference = new Date()) {
    const date = new Date(reference.getTime());
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}
async function resolveSystemAdminId() {
    const admin = await User_1.User.findOne({ where: { is_admin: true }, order: [["created_at", "ASC"]] });
    return admin ? admin.user_id : null;
}
async function runScheduledFinancialCycle(snapshotDate) {
    const performanceSettings = await (0, platformSettingsService_1.getPerformanceSettings)();
    if (performanceSettings.automaticDailyCalculation) {
        await (0, performanceEngineService_1.runDailyPerformanceCycle)(snapshotDate);
    }
    const reconciliationSettings = await (0, platformSettingsService_1.getReconciliationSettings)();
    if (!reconciliationSettings.reconcileBonusesDaily && !reconciliationSettings.reconcilePerformanceDaily) {
        return;
    }
    const adminId = await resolveSystemAdminId();
    if (!adminId)
        return;
    if (reconciliationSettings.reconcileBonusesDaily) {
        await (0, bonusEngineService_1.reconcileBonuses)(adminId);
    }
    if (reconciliationSettings.reconcilePerformanceDaily) {
        await (0, performanceEngineService_1.reconcilePerformanceAgainstLedger)(adminId, snapshotDate);
    }
}
function schedulePerformanceEngine() {
    node_cron_1.default.schedule("15 0 * * *", async () => {
        try {
            await runScheduledFinancialCycle(previousDayKey());
        }
        catch {
            // swallow to avoid crashing the scheduler
        }
    });
}
