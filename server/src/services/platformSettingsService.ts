import { AdminAuditLog } from "../models/AdminAuditLog";
import { PlatformSetting, type PlatformSettingCategory } from "../models/PlatformSetting";

export interface BonusSettings {
  active: boolean;
  percentage: string;
  minDeposit: string;
  maxBonus: string | null;
  eligibleAssets: string[] | null;
  campaignDescription: string;
}

export interface PerformanceSettings {
  automaticDailyCalculation: boolean;
  illustrativeDailyRatePercent: string;
  illustrativeDisclaimer: string;
  requireVerifiedValuation: boolean;
}

export interface ReconciliationSettings {
  reconcileBonusesDaily: boolean;
  reconcilePerformanceDaily: boolean;
  toleranceAmount: string;
}

export interface NotificationTemplates {
  depositConfirmation: string;
  promotionalBonusCredited: string;
  rewardGranted: string;
  rewardRedeemed: string;
  investmentAllocation: string;
  verifiedTradingActivity: string;
  dailyPerformance: string;
  profitRealised: string;
  withdrawalProcessing: string;
  withdrawalCompleted: string;
}

export const PERFORMANCE_ILLUSTRATIVE_DISCLAIMER =
  "Projected figures only. A modelled daily percentage applied to invested principal is not a guaranteed or manufactured return and is never credited. Only independently verified valuations produce reportable performance.";

export const DEFAULT_BONUS_SETTINGS: BonusSettings = {
  active: true,
  percentage: "5.000000",
  minDeposit: "0.00000000",
  maxBonus: null,
  eligibleAssets: null,
  campaignDescription: "Standard 5% promotional bonus on independently verified deposits."
};

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
  automaticDailyCalculation: true,
  illustrativeDailyRatePercent: "3.000000",
  illustrativeDisclaimer: PERFORMANCE_ILLUSTRATIVE_DISCLAIMER,
  requireVerifiedValuation: true
};

export const DEFAULT_RECONCILIATION_SETTINGS: ReconciliationSettings = {
  reconcileBonusesDaily: true,
  reconcilePerformanceDaily: true,
  toleranceAmount: "0.00000000"
};

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplates = {
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

const RESERVED_KEYS: Array<{ category: PlatformSettingCategory; key: string; value: unknown; description: string }> = [
  { category: "bonus", key: "defaults", value: DEFAULT_BONUS_SETTINGS, description: "Default promotional bonus configuration." },
  { category: "performance", key: "settings", value: DEFAULT_PERFORMANCE_SETTINGS, description: "Daily investment performance engine configuration." },
  { category: "reconciliation", key: "settings", value: DEFAULT_RECONCILIATION_SETTINGS, description: "Financial reconciliation configuration." },
  { category: "notifications", key: "templates", value: DEFAULT_NOTIFICATION_TEMPLATES, description: "Notification message templates for financial events." }
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  return cleaned.length > 0 ? cleaned : null;
}

export async function ensurePlatformSettings(): Promise<void> {
  for (const reserved of RESERVED_KEYS) {
    const existing = await PlatformSetting.findOne({ where: { category: reserved.category, key: reserved.key } });
    if (existing) continue;
    await PlatformSetting.create(reserved);
  }
}

async function readSetting<T>(category: PlatformSettingCategory, key: string, fallback: T): Promise<T> {
  const row = await PlatformSetting.findOne({ where: { category, key } });
  if (!row) return fallback;
  return row.value as T;
}

export async function getBonusSettings(): Promise<BonusSettings> {
  const raw = asRecord(await readSetting<unknown>("bonus", "defaults", DEFAULT_BONUS_SETTINGS));
  return {
    active: asBoolean(raw.active, DEFAULT_BONUS_SETTINGS.active),
    percentage: asString(raw.percentage, DEFAULT_BONUS_SETTINGS.percentage),
    minDeposit: asString(raw.minDeposit, DEFAULT_BONUS_SETTINGS.minDeposit),
    maxBonus: asNullableString(raw.maxBonus),
    eligibleAssets: asStringArray(raw.eligibleAssets),
    campaignDescription: asString(raw.campaignDescription, DEFAULT_BONUS_SETTINGS.campaignDescription)
  };
}

export async function getPerformanceSettings(): Promise<PerformanceSettings> {
  const raw = asRecord(await readSetting<unknown>("performance", "settings", DEFAULT_PERFORMANCE_SETTINGS));
  return {
    automaticDailyCalculation: asBoolean(raw.automaticDailyCalculation, DEFAULT_PERFORMANCE_SETTINGS.automaticDailyCalculation),
    illustrativeDailyRatePercent: asString(raw.illustrativeDailyRatePercent, DEFAULT_PERFORMANCE_SETTINGS.illustrativeDailyRatePercent),
    illustrativeDisclaimer: asString(raw.illustrativeDisclaimer, DEFAULT_PERFORMANCE_SETTINGS.illustrativeDisclaimer),
    requireVerifiedValuation: asBoolean(raw.requireVerifiedValuation, DEFAULT_PERFORMANCE_SETTINGS.requireVerifiedValuation)
  };
}

export async function getReconciliationSettings(): Promise<ReconciliationSettings> {
  const raw = asRecord(await readSetting<unknown>("reconciliation", "settings", DEFAULT_RECONCILIATION_SETTINGS));
  return {
    reconcileBonusesDaily: asBoolean(raw.reconcileBonusesDaily, DEFAULT_RECONCILIATION_SETTINGS.reconcileBonusesDaily),
    reconcilePerformanceDaily: asBoolean(raw.reconcilePerformanceDaily, DEFAULT_RECONCILIATION_SETTINGS.reconcilePerformanceDaily),
    toleranceAmount: asString(raw.toleranceAmount, DEFAULT_RECONCILIATION_SETTINGS.toleranceAmount)
  };
}

export async function getNotificationTemplates(): Promise<NotificationTemplates> {
  const raw = asRecord(await readSetting<unknown>("notifications", "templates", DEFAULT_NOTIFICATION_TEMPLATES));
  return {
    depositConfirmation: asString(raw.depositConfirmation, DEFAULT_NOTIFICATION_TEMPLATES.depositConfirmation),
    promotionalBonusCredited: asString(raw.promotionalBonusCredited, DEFAULT_NOTIFICATION_TEMPLATES.promotionalBonusCredited),
    rewardGranted: asString(raw.rewardGranted, DEFAULT_NOTIFICATION_TEMPLATES.rewardGranted),
    rewardRedeemed: asString(raw.rewardRedeemed, DEFAULT_NOTIFICATION_TEMPLATES.rewardRedeemed),
    investmentAllocation: asString(raw.investmentAllocation, DEFAULT_NOTIFICATION_TEMPLATES.investmentAllocation),
    verifiedTradingActivity: asString(raw.verifiedTradingActivity, DEFAULT_NOTIFICATION_TEMPLATES.verifiedTradingActivity),
    dailyPerformance: asString(raw.dailyPerformance, DEFAULT_NOTIFICATION_TEMPLATES.dailyPerformance),
    profitRealised: asString(raw.profitRealised, DEFAULT_NOTIFICATION_TEMPLATES.profitRealised),
    withdrawalProcessing: asString(raw.withdrawalProcessing, DEFAULT_NOTIFICATION_TEMPLATES.withdrawalProcessing),
    withdrawalCompleted: asString(raw.withdrawalCompleted, DEFAULT_NOTIFICATION_TEMPLATES.withdrawalCompleted)
  };
}

export async function getPlatformSettings() {
  const [bonus, performance, reconciliation, notifications] = await Promise.all([
    getBonusSettings(),
    getPerformanceSettings(),
    getReconciliationSettings(),
    getNotificationTemplates()
  ]);
  return { bonus, performance, reconciliation, notifications };
}

export async function savePlatformSetting(
  adminId: string,
  category: PlatformSettingCategory,
  key: string,
  value: unknown,
  reason: string,
  description?: string
) {
  if (!reason.trim()) throw new Error("A reason is required to change a platform setting.");
  const [row, created] = await PlatformSetting.findOrCreate({
    where: { category, key },
    defaults: { category, key, value, description: description ?? "", updated_by: adminId }
  });
  if (!created) {
    row.value = value;
    row.updated_by = adminId;
    row.updated_at = new Date();
    if (description) row.description = description;
    await row.save();
  }
  await AdminAuditLog.create({
    admin_id: adminId,
    action: "platform_setting_updated",
    entity_type: "platform_setting",
    entity_id: row.setting_id,
    reason,
    metadata: { category, key, value }
  });
  return row;
}

export async function listPlatformSettings() {
  return PlatformSetting.findAll({ order: [["category", "ASC"], ["key", "ASC"]] });
}

export async function resetPlatformSettings(adminId: string, reason: string) {
  if (!reason.trim()) throw new Error("A reason is required to reset platform settings.");
  for (const reserved of RESERVED_KEYS) {
    const rows = await PlatformSetting.findAll({ where: { category: reserved.category, key: reserved.key } });
    if (rows.length === 0) continue;
    for (const row of rows) {
      row.value = reserved.value;
      row.updated_by = adminId;
      row.updated_at = new Date();
      await row.save();
    }
  }
  await AdminAuditLog.create({
    admin_id: adminId,
    action: "platform_settings_reset",
    entity_type: "platform_setting",
    entity_id: "all",
    reason,
    metadata: { keys: RESERVED_KEYS.map((entry) => `${entry.category}:${entry.key}`) }
  });
  return getPlatformSettings();
}
