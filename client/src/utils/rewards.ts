import { api } from "./api";
import type { Tone } from "../components/dashboard/primitives";

export type RewardCategory = "loyalty" | "promotional" | "referral" | "special";

export type RewardRequirementType =
  | "manual"
  | "deposit_total"
  | "invest_total"
  | "membership_tier"
  | "referral_count";

export type RewardStatus = "available" | "pending" | "redeemed" | "expired" | "revoked";

export type RewardRequirementUnit = "amount" | "count" | "tier";

export interface RewardRequirementProgress {
  type: RewardRequirementType;
  unit: RewardRequirementUnit;
  current: string;
  required: string;
  remaining: string | null;
  met: boolean;
  progressPercent: number;
  currentLabel: string | null;
  requiredLabel: string | null;
}

export interface RewardItemView {
  id: string;
  rewardId: string | null;
  userRewardId: string | null;
  name: string;
  description: string;
  category: RewardCategory;
  categoryLabel: string;
  amount: string;
  asset: string;
  status: RewardStatus;
  statusLabel: string;
  requirementType: RewardRequirementType;
  requirementLabel: string;
  requirementUnit: RewardRequirementUnit;
  progress: RewardRequirementProgress;
  reference: string | null;
  grantedAt: string | null;
  redeemedAt: string | null;
  grantedByAdmin: boolean;
  expiresAt: string | null;
  canRedeem: boolean;
}

export interface RewardHistoryEntry {
  id: string;
  name: string;
  category: RewardCategory;
  categoryLabel: string;
  amount: string;
  asset: string;
  status: RewardStatus;
  statusLabel: string;
  dateEarned: string | null;
  dateRedeemed: string | null;
  reference: string;
  grantSource: string;
}

export interface RewardCategorySummary {
  id: RewardCategory;
  label: string;
  description: string;
  grantedCount: number;
  availableCount: number;
  totalAmount: string;
}

export interface RewardSummary {
  availableAmount: string;
  pendingAmount: string;
  redeemedAmount: string;
  totalEarned: string;
  availableCount: number;
  redeemedCount: number;
  totalCount: number;
}

export interface RewardMilestone {
  rewardId: string;
  name: string;
  amount: string;
  asset: string;
  category: RewardCategory;
  categoryLabel: string;
  requirementLabel: string;
  requirementUnit: RewardRequirementUnit;
  progressPercent: number;
  remaining: string | null;
}

export interface RewardEligibilityView {
  depositTotal: string;
  depositTotalVerified: boolean;
  investTotal: string;
  membershipTierName: string | null;
  referralCount: number;
}

export interface RewardRules {
  fundingModel: string;
  redemptionModel: string;
  eligibilityModel: string;
  expiryModel: string;
}

export interface RewardDashboard {
  summary: RewardSummary;
  categories: RewardCategorySummary[];
  rewards: RewardItemView[];
  locked: RewardItemView[];
  upcoming: RewardItemView[];
  history: RewardHistoryEntry[];
  eligibility: RewardEligibilityView;
  balance: { promotionalCredits: string; withdrawable: string };
  rules: RewardRules;
}

export interface RewardRedemptionResult {
  userRewardId: string;
  name: string;
  amount: string;
  asset: string;
  reference: string;
  status: RewardStatus;
}

export interface RewardCatalogEntry {
  rewardId: string;
  name: string;
  description: string;
  category: RewardCategory;
  categoryLabel: string;
  amount: string;
  asset: string;
  requirementType: RewardRequirementType;
  requirementLabel: string;
  requirementAmount: string;
  requirementCount: number;
  requirementTierId: string | null;
  requirementTierName: string | null;
  maxRedemptions: number | null;
  active: boolean;
  priority: number;
  expiresAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RewardCatalogInput {
  rewardId?: string | null;
  name: string;
  description: string;
  category: RewardCategory;
  amount: string;
  asset: string;
  requirementType: RewardRequirementType;
  requirementAmount: string | null;
  requirementCount: number | null;
  requirementTierId: string | null;
  maxRedemptions: number | null;
  active: boolean;
  priority: number;
  expiresAt: string | null;
  reason: string;
}

export interface RewardGrantInput {
  userId: string;
  rewardId?: string | null;
  name?: string | null;
  category?: RewardCategory | null;
  amount?: string | null;
  asset?: string | null;
  expiresAt?: string | null;
  reason: string;
  countAsInvestmentEarnings?: boolean;
}

export interface RewardCampaignPerformance {
  rewardId: string;
  name: string;
  category: RewardCategory;
  categoryLabel: string;
  active: boolean;
  grantedCount: number;
  grantedTotal: string;
  redeemedCount: number;
  redeemedTotal: string;
}

export interface RewardAdminSummary {
  catalogCount: number;
  activeCount: number;
  userCount: number;
  grantCount: number;
  redemptionCount: number;
  totals: { granted: string; redeemed: string; pending: string; available: string };
  byCategory: Array<{
    id: RewardCategory;
    label: string;
    grantedCount: number;
    grantedTotal: string;
    redeemedTotal: string;
  }>;
  campaignPerformance: RewardCampaignPerformance[];
  recent: RewardHistoryEntry[];
  catalog: RewardCatalogEntry[];
}

export interface AdminUserRewardEntry extends RewardHistoryEntry {
  userId: string;
  userName: string;
  userEmail: string;
  grantReason: string;
  grantSource: string;
  revokeReason: string | null;
  redemptionReference: string | null;
}

export interface AdminRewardGrantPage {
  page: number;
  pageSize: number;
  total: number;
  rewards: AdminUserRewardEntry[];
}

export const REWARD_CATEGORIES: RewardCategory[] = ["loyalty", "promotional", "referral", "special"];

export const REWARD_CATEGORY_LABEL: Record<RewardCategory, string> = {
  loyalty: "Loyalty",
  promotional: "Promotional",
  referral: "Referral",
  special: "Special"
};

export const REWARD_REQUIREMENT_LABEL: Record<RewardRequirementType, string> = {
  manual: "Issued by the platform",
  deposit_total: "Confirmed, verified deposits",
  invest_total: "Verified invested principal",
  membership_tier: "Membership tier",
  referral_count: "Referred accounts"
};

const STATUS_TONE: Record<RewardStatus, Tone> = {
  available: "positive",
  pending: "gold",
  redeemed: "neutral",
  expired: "negative",
  revoked: "negative"
};

const CATEGORY_TONE: Record<RewardCategory, Tone> = {
  loyalty: "gold",
  promotional: "positive",
  referral: "gold",
  special: "neutral"
};

export function rewardStatusTone(status: RewardStatus): Tone {
  return STATUS_TONE[status] ?? "neutral";
}

export function rewardCategoryTone(category: RewardCategory): Tone {
  return CATEGORY_TONE[category] ?? "neutral";
}

export function rewardRequirementLabel(type: RewardRequirementType): string {
  return REWARD_REQUIREMENT_LABEL[type] ?? "Requirement";
}

export async function fetchRewardDashboard(): Promise<RewardDashboard> {
  const response = await api.get<RewardDashboard>("/operations/rewards");
  return response.data;
}

export async function redeemUserReward(userRewardId: string): Promise<RewardRedemptionResult> {
  const response = await api.post<RewardRedemptionResult>(
    `/operations/rewards/${userRewardId}/redeem`
  );
  return response.data;
}

export async function fetchRewardAdminSummary(): Promise<RewardAdminSummary> {
  const response = await api.get<RewardAdminSummary>("/operations/admin/rewards");
  return response.data;
}

export async function fetchRewardCatalog(): Promise<RewardCatalogEntry[]> {
  const response = await api.get<{ rewards: RewardCatalogEntry[] }>(
    "/operations/admin/rewards/catalog"
  );
  return response.data.rewards;
}

export async function saveRewardCatalog(input: RewardCatalogInput): Promise<RewardCatalogEntry> {
  const response = await api.post<RewardCatalogEntry>("/operations/admin/rewards/catalog", input);
  return response.data;
}

export async function deactivateRewardCatalog(
  rewardId: string,
  reason: string
): Promise<RewardCatalogEntry> {
  const response = await api.post<RewardCatalogEntry>(
    `/operations/admin/rewards/catalog/${rewardId}/deactivate`,
    { reason }
  );
  return response.data;
}

export async function deleteRewardCatalog(rewardId: string, reason: string): Promise<void> {
  await api.delete(`/operations/admin/rewards/catalog/${rewardId}`, { data: { reason } });
}

export async function fetchAdminRewardGrants(
  query: { page?: number; pageSize?: number; userId?: string; status?: string; category?: string } = {}
): Promise<AdminRewardGrantPage> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.userId) params.set("userId", query.userId);
  if (query.status) params.set("status", query.status);
  if (query.category) params.set("category", query.category);
  const response = await api.get<AdminRewardGrantPage>(
    `/operations/admin/rewards/grants?${params.toString()}`
  );
  return response.data;
}

export async function grantRewardToUser(input: RewardGrantInput): Promise<void> {
  await api.post("/operations/admin/rewards/grants", input);
}

export async function revokeUserRewardGrant(userRewardId: string, reason: string): Promise<void> {
  await api.post(`/operations/admin/rewards/grants/${userRewardId}/revoke`, { reason });
}
