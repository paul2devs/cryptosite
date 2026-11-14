import { api } from "./api";

export interface BonusEligibility {
  minMembershipTierId?: string | null;
  minInvestedAmount?: string | null;
  newUsersOnly?: boolean;
  requiredReferral?: boolean;
}

export interface BonusCampaignView {
  campaignId: string;
  name: string;
  description: string;
  percentage: string;
  minDeposit: string;
  maxBonus: string | null;
  eligibleAssets: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  priority: number;
  eligibility: BonusEligibility;
  createdAt?: string;
}

export interface BonusCreditView {
  creditId: string;
  userId: string;
  depositId: string;
  campaignName: string;
  percentage: string;
  qualifyingAmount: string;
  bonusAmount: string;
  asset: string;
  status: string;
  reference: string;
  createdAt: string;
}

export interface BonusAdminSummary {
  campaigns: BonusCampaignView[];
  recentCredits: BonusCreditView[];
  totals: {
    creditCount: number;
    totalCredited: string;
  };
}

export interface UserBonusHistoryEntry {
  creditId: string;
  campaignName: string;
  percentage: string;
  qualifyingAmount: string;
  bonusAmount: string;
  asset: string;
  status: string;
  reference: string;
  createdAt: string;
  depositId: string;
}

export interface UserBonusResponse {
  history: UserBonusHistoryEntry[];
  totals: { count: number; total: string };
}

export interface BonusReconciliationResult {
  scope: string;
  creditsChecked: number;
  depositsChecked: number;
  mismatched: number;
  issues: Array<{ code: string; reference: string; detail: string }>;
}

export interface BonusCampaignInput {
  campaignId?: string;
  name: string;
  description: string;
  percentage: string;
  minDeposit: string;
  maxBonus: string | null;
  eligibleAssets: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  priority: number;
  eligibility: BonusEligibility;
  reason: string;
}

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
  investmentAllocation: string;
  verifiedTradingActivity: string;
  dailyPerformance: string;
  profitRealised: string;
  withdrawalProcessing: string;
  withdrawalCompleted: string;
  rewardGranted: string;
  rewardRedeemed: string;
}

export interface PlatformFinancialSettings {
  bonus: BonusSettings;
  performance: PerformanceSettings;
  reconciliation: ReconciliationSettings;
  notifications: NotificationTemplates;
}

export interface PlatformSettingEntry {
  settingId: string;
  category: string;
  key: string;
  value: unknown;
  description: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface PlatformSettingsResponse {
  settings: PlatformFinancialSettings;
  entries: PlatformSettingEntry[];
}

export type PlatformSettingCategory =
  | "bonus"
  | "performance"
  | "reconciliation"
  | "notifications"
  | "reporting";

export async function fetchBonusSummary(): Promise<BonusAdminSummary> {
  const response = await api.get<BonusAdminSummary>("/operations/admin/bonus");
  return response.data;
}

export async function fetchBonusCampaigns(): Promise<BonusCampaignView[]> {
  const response = await api.get<BonusCampaignView[]>("/operations/admin/bonus/campaigns");
  return response.data;
}

export async function saveBonusCampaign(input: BonusCampaignInput): Promise<void> {
  await api.post("/operations/admin/bonus/campaigns", input);
}

export async function deactivateBonusCampaign(campaignId: string, reason: string): Promise<void> {
  await api.post(`/operations/admin/bonus/campaigns/${campaignId}/deactivate`, { reason });
}

export async function deleteBonusCampaign(campaignId: string): Promise<void> {
  await api.delete(`/operations/admin/bonus/campaigns/${campaignId}`);
}

export async function reconcileBonuses(userId?: string): Promise<BonusReconciliationResult> {
  const response = await api.post<BonusReconciliationResult>(
    "/operations/admin/bonus/reconcile",
    userId ? { userId } : {}
  );
  return response.data;
}

export async function fetchMyBonuses(): Promise<UserBonusResponse> {
  const response = await api.get<UserBonusResponse>("/operations/bonuses");
  return response.data;
}

export async function fetchPlatformFinancialSettings(): Promise<PlatformSettingsResponse> {
  const response = await api.get<PlatformSettingsResponse>("/operations/admin/settings");
  return response.data;
}

export async function savePlatformSetting(
  category: PlatformSettingCategory,
  key: string,
  value: unknown,
  reason: string,
  description?: string
): Promise<void> {
  await api.post("/operations/admin/settings", { category, key, value, reason, description });
}

export async function resetPlatformSettings(reason: string): Promise<PlatformFinancialSettings> {
  const response = await api.post<PlatformFinancialSettings>("/operations/admin/settings/reset", {
    reason
  });
  return response.data;
}
