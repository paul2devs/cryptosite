import cron from "node-cron";
import { User } from "../models/User";
import { reconcileBonuses } from "../services/bonusEngineService";
import { reconcilePerformanceAgainstLedger, runDailyPerformanceCycle } from "../services/performanceEngineService";
import { getPerformanceSettings, getReconciliationSettings } from "../services/platformSettingsService";

function previousDayKey(reference: Date = new Date()): string {
  const date = new Date(reference.getTime());
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function resolveSystemAdminId(): Promise<string | null> {
  const admin = await User.findOne({ where: { is_admin: true }, order: [["created_at", "ASC"]] });
  return admin ? admin.user_id : null;
}

export async function runScheduledFinancialCycle(snapshotDate: string): Promise<void> {
  const performanceSettings = await getPerformanceSettings();
  if (performanceSettings.automaticDailyCalculation) {
    await runDailyPerformanceCycle(snapshotDate);
  }
  const reconciliationSettings = await getReconciliationSettings();
  if (!reconciliationSettings.reconcileBonusesDaily && !reconciliationSettings.reconcilePerformanceDaily) {
    return;
  }
  const adminId = await resolveSystemAdminId();
  if (!adminId) return;
  if (reconciliationSettings.reconcileBonusesDaily) {
    await reconcileBonuses(adminId);
  }
  if (reconciliationSettings.reconcilePerformanceDaily) {
    await reconcilePerformanceAgainstLedger(adminId, snapshotDate);
  }
}

export function schedulePerformanceEngine(): void {
  cron.schedule("15 0 * * *", async () => {
    try {
      await runScheduledFinancialCycle(previousDayKey());
    } catch {
      // swallow to avoid crashing the scheduler
    }
  });
}
