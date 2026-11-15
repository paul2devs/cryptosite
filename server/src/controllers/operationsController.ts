import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthenticatedRequest } from "../middleware/auth";
import { categorizeError } from "../middleware/errorHandler";
import {
  adminOverview,
  adminPerformance,
  listDeposits,
  listActivity,
  listLedger,
  listUsers,
  listWithdrawals,
  markMissingPerformance,
  recordVerifiedValuation,
  reviewWithdrawal,
  userPerformance,
  userProfile
} from "../services/financialOperationsService";
import {
  activateMembershipBenefit,
  adminAdjustMembership,
  clearMembershipOverride,
  deactivateTier,
  deleteMembershipBenefit,
  deleteTier,
  getMembershipRules,
  getMembershipView,
  membershipAdminSummary,
  membershipAdminUsers,
  saveMembershipBenefit,
  saveMembershipTier
} from "../services/membershipService";
import { deleteUserAccount } from "../services/userAccountService";
import {
  activateInvestmentLevelBenefit,
  adminAdjustInvestmentLevel,
  clearInvestmentLevelOverride,
  deactivateInvestmentLevel,
  deleteInvestmentLevel,
  deleteInvestmentLevelBenefit,
  getInvestmentLevelRules,
  getInvestmentLevelView,
  investmentLevelAdminSummary,
  investmentLevelAdminUsers,
  recalculateUserInvestmentLevel,
  saveInvestmentLevel,
  saveInvestmentLevelBenefit
} from "../services/investmentLevelService";
import {
  bonusAdminSummary,
  bonusHistoryForUser,
  bonusTotalsForUser,
  deactivateBonusCampaign,
  deleteBonusCampaign,
  listBonusCampaigns,
  listBonusCredits,
  reconcileBonuses,
  saveBonusCampaign,
  type BonusCampaignInput
} from "../services/bonusEngineService";
import {
  dailyPerformanceSummary,
  reconcilePerformanceAgainstLedger,
  recordProfitDistribution,
  runDailyPerformanceCycle
} from "../services/performanceEngineService";
import {
  getPlatformSettings,
  listPlatformSettings,
  resetPlatformSettings,
  savePlatformSetting
} from "../services/platformSettingsService";
import type { PlatformSettingCategory } from "../models/PlatformSetting";
import {
  deactivateReward,
  deleteReward,
  getRewardDashboard,
  grantRewardToUser,
  listRewardCatalog,
  listUserRewardsForAdmin,
  redeemReward,
  revokeUserReward,
  rewardAdminSummary,
  saveRewardForAdmin,
  type RewardCatalogInput,
  type RewardGrantInput
} from "../services/rewardService";
import { getDailyPerformanceDetail, reconcilePerformance } from "../services/performanceService";
import {
  getUserTransactionDetail,
  listAdminTransactions,
  listUserTransactions,
  reconcileTransactions,
  reconciliationHistory,
  type TransactionQuery
} from "../services/transactionService";

function fail(res: Response, error: unknown, status = 400) {
  const correlationId = String(res.locals.correlationId || "");

  if (status >= 500) {
    const categorized = categorizeError(error);
    // eslint-disable-next-line no-console
    console.error(
      `[api-error] ${JSON.stringify({
        correlationId,
        status,
        category: categorized.category,
        code: categorized.code,
        message: categorized.diagnostic.slice(0, 500)
      })}`
    );
    res.status(status).json({
      message: categorized.publicMessage,
      correlationId,
      category: categorized.category
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Request failed";
  res.status(status).json({ message, correlationId });
}

function rejected(req: AuthenticatedRequest, res: Response): boolean {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ message: errors.array()[0]?.msg || "Invalid request" });
  return true;
}

export async function currentMembership(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await getMembershipView(req.user.userId));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function currentPerformance(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await userPerformance(req.user.userId, String(req.query.range || "30d")));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function overview(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await adminOverview());
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function users(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await listUsers(req.query as Record<string, unknown>));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function profile(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await userProfile(req.params.userId));
  } catch (error) {
    fail(res, error, 404);
  }
}

export async function removeUser(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    res.status(200).json(await deleteUserAccount(req.user.userId, req.params.userId, reason));
  } catch (error) {
    fail(res, error, 400);
  }
}

export async function deposits(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await listDeposits(req.query as Record<string, unknown>));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function withdrawals(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await listWithdrawals(req.query as Record<string, unknown>));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function review(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as { status: string; reason: string; txHash?: string };
    res.status(200).json(await reviewWithdrawal(req.user.userId, req.params.withdrawalId, body.status, body.reason, body.txHash));
  } catch (error) {
    fail(res, error);
  }
}

export async function ledger(req: AuthenticatedRequest, res: Response) {
  if (req.params.entryId && rejected(req, res)) return;
  try {
    if (req.params.entryId) {
      res.status(200).json(await listLedger({ entryId: req.params.entryId }));
      return;
    }
    res.status(200).json(await listLedger(req.query as Record<string, unknown>));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function memberships(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await membershipAdminSummary());
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function upsertTier(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as {
      tierId?: string;
      name: string;
      description: string;
      minAmount: string;
      maxAmount: string | null;
      benefits: string[];
      icon: string;
      accent: string;
      sortOrder: number;
      active: boolean;
      reason: string;
    };
    res.status(200).json(await saveMembershipTier(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function disableTier(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    await deactivateTier(req.user.userId, req.params.tierId, String(req.body.reason || ""));
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

export async function removeTier(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  try {
    await deleteTier(req.params.tierId);
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

export async function membershipConfig(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json({ rules: getMembershipRules() });
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function activateBenefit(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await activateMembershipBenefit(req.user.userId, req.params.benefitId));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminMembershipUsers(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await membershipAdminUsers(req.query as Record<string, unknown>));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adjustMembership(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as { tierId: string | null; reason: string };
    res.status(200).json(await adminAdjustMembership(req.user.userId, req.params.userId, body.tierId ?? null, body.reason));
  } catch (error) {
    fail(res, error);
  }
}

export async function clearOverride(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as { reason: string };
    res.status(200).json(await clearMembershipOverride(req.user.userId, req.params.userId, body.reason));
  } catch (error) {
    fail(res, error);
  }
}

export async function upsertBenefit(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as {
      benefitId?: string;
      tierId: string;
      code: string;
      name: string;
      description: string;
      available: boolean;
      requiresActivation: boolean;
      sortOrder: number;
      active: boolean;
      reason: string;
    };
    res.status(200).json(await saveMembershipBenefit(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function removeBenefit(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    await deleteMembershipBenefit(req.user.userId, req.params.benefitId, String(req.body.reason || ""));
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

export async function activity(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await listActivity(req.query as Record<string, unknown>));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function performance(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await adminPerformance());
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function verifyPerformance(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as {
      positionId: string;
      snapshotDate: string;
      closingValuation: string;
      cashFlow: string;
      dataSource: string;
      evidenceRef: string;
      reason: string;
      correctionOf?: string | null;
    };
    res.status(201).json(await recordVerifiedValuation(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function sweepPerformance(req: AuthenticatedRequest, res: Response) {
  try {
    const date = String(req.body.snapshotDate || new Date().toISOString().slice(0, 10));
    await markMissingPerformance(date);
    res.status(200).json({ ok: true, snapshotDate: date });
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function currentInvestmentLevel(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await getInvestmentLevelView(req.user.userId));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function investmentLevelConfig(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json({ rules: getInvestmentLevelRules() });
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function activateInvestmentBenefit(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await activateInvestmentLevelBenefit(req.user.userId, req.params.benefitId));
  } catch (error) {
    fail(res, error);
  }
}

export async function investmentLevels(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await investmentLevelAdminSummary());
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function upsertInvestmentLevel(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as {
      levelId?: string;
      levelNumber: number;
      name: string;
      description: string;
      threshold: string;
      icon: string;
      accent: string;
      sortOrder: number;
      active: boolean;
      effectiveFrom: string | null;
      reason: string;
    };
    res.status(200).json(await saveInvestmentLevel(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function disableInvestmentLevel(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    await deactivateInvestmentLevel(req.user.userId, req.params.levelId, String(req.body.reason || ""));
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

export async function removeInvestmentLevel(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  try {
    await deleteInvestmentLevel(req.params.levelId);
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

export async function adminInvestmentLevelUsers(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await investmentLevelAdminUsers(req.query as Record<string, unknown>));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adjustInvestmentLevel(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as { levelId: string | null; reason: string };
    res
      .status(200)
      .json(await adminAdjustInvestmentLevel(req.user.userId, req.params.userId, body.levelId ?? null, body.reason));
  } catch (error) {
    fail(res, error);
  }
}

export async function clearInvestmentOverride(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as { reason: string };
    res.status(200).json(await clearInvestmentLevelOverride(req.user.userId, req.params.userId, body.reason));
  } catch (error) {
    fail(res, error);
  }
}

export async function recalculateInvestmentLevel(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as { reason: string };
    res
      .status(200)
      .json(await recalculateUserInvestmentLevel(req.user.userId, req.params.userId, body.reason));
  } catch (error) {
    fail(res, error);
  }
}

export async function upsertInvestmentBenefit(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as {
      benefitId?: string;
      levelId: string;
      code: string;
      name: string;
      description: string;
      category: string;
      available: boolean;
      requiresActivation: boolean;
      sortOrder: number;
      active: boolean;
      reason: string;
    };
    res.status(200).json(await saveInvestmentLevelBenefit(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function removeInvestmentBenefit(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    await deleteInvestmentLevelBenefit(req.user.userId, req.params.benefitId, String(req.body.reason || ""));
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

function transactionQueryFrom(source: Record<string, unknown>): TransactionQuery {
  return {
    range: source.range ? String(source.range) : undefined,
    category: source.category ? String(source.category) : undefined,
    status: source.status ? String(source.status) : undefined,
    search: source.search ? String(source.search) : undefined,
    asset: source.asset ? String(source.asset) : undefined,
    from: source.from ? String(source.from) : null,
    to: source.to ? String(source.to) : null,
    page: source.page ? Number(source.page) : undefined,
    pageSize: source.pageSize ? Number(source.pageSize) : undefined
  };
}

export async function transactions(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await listUserTransactions(req.user.userId, transactionQueryFrom(req.query as Record<string, unknown>)));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function transactionDetail(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await getUserTransactionDetail(req.user.userId, req.params.reference));
  } catch (error) {
    fail(res, error, 404);
  }
}

export async function performanceDaily(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await getDailyPerformanceDetail(req.user.userId, req.params.date));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminTransactions(req: AuthenticatedRequest, res: Response) {
  try {
    const query = transactionQueryFrom(req.query as Record<string, unknown>);
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    res.status(200).json(await listAdminTransactions({ ...query, userId }));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function reconcileTransactionLedger(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const userId = req.body?.userId ? String(req.body.userId) : undefined;
    res.status(200).json(await reconcileTransactions(req.user.userId, userId));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function reconcilePerformanceSnapshots(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const date = String(req.body?.date || new Date().toISOString().slice(0, 10));
    res.status(200).json(await reconcilePerformance(req.user.userId, date));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function reconciliationLog(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await reconciliationHistory(100));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function myBonuses(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const [history, totals] = await Promise.all([bonusHistoryForUser(req.user.userId), bonusTotalsForUser(req.user.userId)]);
    res.status(200).json({ history, totals });
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminBonus(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await bonusAdminSummary());
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminBonusCampaigns(_req: AuthenticatedRequest, res: Response) {
  try {
    const campaigns = await listBonusCampaigns();
    res.status(200).json(
      campaigns.map((campaign) => ({
        campaignId: campaign.campaign_id,
        name: campaign.name,
        description: campaign.description,
        percentage: String(campaign.percentage),
        minDeposit: String(campaign.min_deposit),
        maxBonus: campaign.max_bonus === null ? null : String(campaign.max_bonus),
        eligibleAssets: campaign.eligible_assets,
        startsAt: campaign.starts_at,
        endsAt: campaign.ends_at,
        active: campaign.active,
        priority: campaign.priority,
        eligibility: campaign.eligibility,
        createdAt: campaign.created_at
      }))
    );
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminSaveBonusCampaign(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as BonusCampaignInput;
    res.status(200).json(await saveBonusCampaign(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminDeactivateBonusCampaign(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    await deactivateBonusCampaign(req.user.userId, req.params.campaignId, String(req.body.reason || ""));
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

export async function adminDeleteBonusCampaign(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  try {
    await deleteBonusCampaign(req.params.campaignId);
    res.status(200).json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
}

export async function adminBonusCredits(req: AuthenticatedRequest, res: Response) {
  try {
    const query = req.query as Record<string, unknown>;
    res.status(200).json(
      await listBonusCredits({
        page: query.page ? Number(query.page) : undefined,
        pageSize: query.pageSize ? Number(query.pageSize) : undefined,
        userId: query.userId ? String(query.userId) : undefined,
        campaignId: query.campaignId ? String(query.campaignId) : undefined
      })
    );
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminReconcileBonuses(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const userId = req.body?.userId ? String(req.body.userId) : undefined;
    res.status(200).json(await reconcileBonuses(req.user.userId, userId));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminSettings(_req: AuthenticatedRequest, res: Response) {
  try {
    const [settings, rows] = await Promise.all([getPlatformSettings(), listPlatformSettings()]);
    res.status(200).json({
      settings,
      entries: rows.map((row) => ({
        settingId: row.setting_id,
        category: row.category,
        key: row.key,
        value: row.value,
        description: row.description,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at
      }))
    });
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminSaveSetting(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as {
      category: PlatformSettingCategory;
      key: string;
      value: unknown;
      description?: string;
      reason: string;
    };
    await savePlatformSetting(req.user.userId, body.category, body.key, body.value, body.reason, body.description);
    res.status(200).json(await getPlatformSettings());
  } catch (error) {
    fail(res, error);
  }
}

export async function adminResetSettings(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await resetPlatformSettings(req.user.userId, String(req.body.reason || "")));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminPerformanceSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    res.status(200).json(await dailyPerformanceSummary(date));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminRunPerformanceCycle(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const date = String(req.body?.snapshotDate || new Date().toISOString().slice(0, 10));
    res.status(200).json(await runDailyPerformanceCycle(date));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminReconcilePerformanceLedger(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const date = String(req.body?.date || new Date().toISOString().slice(0, 10));
    const userId = req.body?.userId ? String(req.body.userId) : undefined;
    res.status(200).json(await reconcilePerformanceAgainstLedger(req.user.userId, date, userId));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminProfitDistribution(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as { userId: string; asset: string; amount: string; reason: string };
    res.status(201).json(await recordProfitDistribution(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function currentRewards(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await getRewardDashboard(req.user.userId));
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function redeemUserReward(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await redeemReward(req.user.userId, req.params.userRewardId));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminRewards(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await rewardAdminSummary());
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminRewardCatalog(_req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json({ rewards: await listRewardCatalog() });
  } catch (error) {
    fail(res, error, 500);
  }
}

export async function adminSaveReward(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as RewardCatalogInput;
    res.status(200).json(await saveRewardForAdmin(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminDeactivateReward(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res
      .status(200)
      .json(await deactivateReward(req.user.userId, req.params.rewardId, String(req.body.reason || "")));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminDeleteReward(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res.status(200).json(await deleteReward(req.user.userId, req.params.rewardId, String(req.body.reason || "")));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminGrantReward(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    const body = req.body as RewardGrantInput;
    res.status(201).json(await grantRewardToUser(req.user.userId, body));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminRevokeReward(req: AuthenticatedRequest, res: Response) {
  if (rejected(req, res)) return;
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  try {
    res
      .status(200)
      .json(await revokeUserReward(req.user.userId, req.params.userRewardId, String(req.body.reason || "")));
  } catch (error) {
    fail(res, error);
  }
}

export async function adminUserRewards(req: AuthenticatedRequest, res: Response) {
  try {
    res.status(200).json(await listUserRewardsForAdmin(req.query as Record<string, unknown>));
  } catch (error) {
    fail(res, error, 500);
  }
}
