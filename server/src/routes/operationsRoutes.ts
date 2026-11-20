import { Router } from "express";
import { body, param } from "express-validator";
import {
  activateBenefit,
  activateInvestmentBenefit,
  activity,
  adjustInvestmentLevel,
  adjustMembership,
  adminApplyBalanceAdjustment,
  adminBalanceAdjustments,
  adminBalanceOverview,
  adminBonus,
  adminBonusCampaigns,
  adminBonusCredits,
  adminDeleteBonusCampaign,
  adminDeactivateBonusCampaign,
  adminDeactivateReward,
  adminDeleteReward,
  adminGrantReward,
  adminInvestmentLevelUsers,
  adminMembershipUsers,
  adminPerformanceSummary,
  adminProfitDistribution,
  adminReconcileBonuses,
  adminReconcilePerformanceLedger,
  adminResetSettings,
  adminReverseBalanceAdjustment,
  adminRevokeReward,
  adminRewardCatalog,
  adminRewards,
  adminRunPerformanceCycle,
  adminSaveBonusCampaign,
  adminSaveReward,
  adminSaveSetting,
  adminSettings,
  adminTransactions,
  adminUserRewards,
  clearInvestmentOverride,
  clearOverride,
  currentInvestmentLevel,
  currentMembership,
  currentPerformance,
  currentRewards,
  deposits,
  disableInvestmentLevel,
  disableTier,
  investmentLevelConfig,
  investmentLevels,
  ledger,
  membershipConfig,
  memberships,
  myBonuses,
  overview,
  performance,
  performanceDaily,
  profile,
  recalculateInvestmentLevel,
  reconcilePerformanceSnapshots,
  reconcileTransactionLedger,
  reconciliationLog,
  redeemUserReward,
  removeBenefit,
  removeInvestmentBenefit,
  removeInvestmentLevel,
  removeTier,
  removeUser,
  review,
  sweepPerformance,
  transactionDetail,
  transactions,
  upsertBenefit,
  upsertInvestmentBenefit,
  upsertInvestmentLevel,
  upsertTier,
  users,
  verifyPerformance,
  withdrawals
} from "../controllers/operationsController";
import { authenticate, requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/membership", authenticate, currentMembership);
router.get("/membership/config", authenticate, membershipConfig);
router.post("/membership/benefits/:benefitId/activate", authenticate, [param("benefitId").isUUID()], activateBenefit);
router.get("/investment-level", authenticate, currentInvestmentLevel);
router.get("/investment-level/config", authenticate, investmentLevelConfig);
router.post(
  "/investment-level/benefits/:benefitId/activate",
  authenticate,
  [param("benefitId").isUUID()],
  activateInvestmentBenefit
);
router.get("/performance", authenticate, currentPerformance);
router.get("/performance/daily/:date", authenticate, performanceDaily);
router.get("/bonuses", authenticate, myBonuses);
router.get("/rewards", authenticate, currentRewards);
router.post(
  "/rewards/:userRewardId/redeem",
  authenticate,
  [param("userRewardId").isUUID()],
  redeemUserReward
);
router.get("/transactions", authenticate, transactions);
router.get("/transactions/:reference", authenticate, transactionDetail);

router.get("/admin/overview", authenticate, requireAdmin, overview);
router.get("/admin/users", authenticate, requireAdmin, users);
router.get("/admin/users/:userId", authenticate, requireAdmin, profile);
router.delete(
  "/admin/users/:userId",
  authenticate,
  requireAdmin,
  [param("userId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  removeUser
);
router.get("/admin/deposits", authenticate, requireAdmin, deposits);
router.get("/admin/withdrawals", authenticate, requireAdmin, withdrawals);
router.post(
  "/admin/withdrawals/:withdrawalId/review",
  authenticate,
  requireAdmin,
  [param("withdrawalId").isUUID(), body("status").isString(), body("reason").isString().isLength({ min: 3 })],
  review
);
router.get("/admin/ledger", authenticate, requireAdmin, ledger);
router.get("/admin/memberships", authenticate, requireAdmin, memberships);
router.post(
  "/admin/memberships",
  authenticate,
  requireAdmin,
  [
    body("name").isString().isLength({ min: 2 }),
    body("description").isString().isLength({ min: 3 }),
    body("minAmount").isString(),
    body("reason").isString().isLength({ min: 3 }),
    body("sortOrder").isInt(),
    body("active").isBoolean(),
    body("benefits").isArray()
  ],
  upsertTier
);
router.post(
  "/admin/memberships/:tierId/deactivate",
  authenticate,
  requireAdmin,
  [param("tierId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  disableTier
);
router.delete("/admin/memberships/:tierId", authenticate, requireAdmin, [param("tierId").isUUID()], removeTier);
router.get("/admin/membership/users", authenticate, requireAdmin, adminMembershipUsers);
router.post(
  "/admin/membership/users/:userId/adjust",
  authenticate,
  requireAdmin,
  [
    param("userId").isUUID(),
    body("tierId").optional({ nullable: true }).isUUID(),
    body("reason").isString().isLength({ min: 3 })
  ],
  adjustMembership
);
router.post(
  "/admin/membership/users/:userId/clear-override",
  authenticate,
  requireAdmin,
  [param("userId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  clearOverride
);
router.post(
  "/admin/membership/benefits",
  authenticate,
  requireAdmin,
  [
    body("tierId").isUUID(),
    body("code").isString().isLength({ min: 3 }),
    body("name").isString().isLength({ min: 2 }),
    body("description").isString().isLength({ min: 3 }),
    body("available").isBoolean(),
    body("requiresActivation").isBoolean(),
    body("sortOrder").isInt(),
    body("active").isBoolean(),
    body("reason").isString().isLength({ min: 3 })
  ],
  upsertBenefit
);
router.delete(
  "/admin/membership/benefits/:benefitId",
  authenticate,
  requireAdmin,
  [param("benefitId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  removeBenefit
);
router.get("/admin/investment-levels", authenticate, requireAdmin, investmentLevels);
router.post(
  "/admin/investment-levels",
  authenticate,
  requireAdmin,
  [
    body("levelNumber").isInt({ min: 1 }),
    body("name").isString().isLength({ min: 2 }),
    body("description").isString().isLength({ min: 3 }),
    body("threshold").isString(),
    body("sortOrder").isInt(),
    body("active").isBoolean(),
    body("reason").isString().isLength({ min: 3 })
  ],
  upsertInvestmentLevel
);
router.post(
  "/admin/investment-levels/:levelId/deactivate",
  authenticate,
  requireAdmin,
  [param("levelId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  disableInvestmentLevel
);
router.delete("/admin/investment-levels/:levelId", authenticate, requireAdmin, [param("levelId").isUUID()], removeInvestmentLevel);
router.get("/admin/investment-level/users", authenticate, requireAdmin, adminInvestmentLevelUsers);
router.post(
  "/admin/investment-level/users/:userId/adjust",
  authenticate,
  requireAdmin,
  [
    param("userId").isUUID(),
    body("levelId").optional({ nullable: true }).isUUID(),
    body("reason").isString().isLength({ min: 3 })
  ],
  adjustInvestmentLevel
);
router.post(
  "/admin/investment-level/users/:userId/clear-override",
  authenticate,
  requireAdmin,
  [param("userId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  clearInvestmentOverride
);
router.post(
  "/admin/investment-level/users/:userId/recalculate",
  authenticate,
  requireAdmin,
  [param("userId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  recalculateInvestmentLevel
);
router.post(
  "/admin/investment-level/benefits",
  authenticate,
  requireAdmin,
  [
    body("levelId").isUUID(),
    body("code").isString().isLength({ min: 3 }),
    body("name").isString().isLength({ min: 2 }),
    body("description").isString().isLength({ min: 3 }),
    body("category").isString().isLength({ min: 2 }),
    body("available").isBoolean(),
    body("requiresActivation").isBoolean(),
    body("sortOrder").isInt(),
    body("active").isBoolean(),
    body("reason").isString().isLength({ min: 3 })
  ],
  upsertInvestmentBenefit
);
router.delete(
  "/admin/investment-level/benefits/:benefitId",
  authenticate,
  requireAdmin,
  [param("benefitId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  removeInvestmentBenefit
);
router.get("/admin/ledger/:entryId", authenticate, requireAdmin, [param("entryId").isUUID()], ledger);
router.get("/admin/activity", authenticate, requireAdmin, activity);
router.get("/admin/performance", authenticate, requireAdmin, performance);
router.post(
  "/admin/performance/verify",
  authenticate,
  requireAdmin,
  [
    body("positionId").isUUID(),
    body("snapshotDate").isISO8601(),
    body("closingValuation").isString(),
    body("dataSource").isString().isLength({ min: 2 }),
    body("evidenceRef").isString().isLength({ min: 2 }),
    body("reason").isString().isLength({ min: 3 })
  ],
  verifyPerformance
);
router.post("/admin/performance/sweep", authenticate, requireAdmin, sweepPerformance);
router.get("/admin/transactions", authenticate, requireAdmin, adminTransactions);
router.post("/admin/reconcile/transactions", authenticate, requireAdmin, reconcileTransactionLedger);
router.post("/admin/reconcile/performance", authenticate, requireAdmin, reconcilePerformanceSnapshots);
router.get("/admin/reconcile/history", authenticate, requireAdmin, reconciliationLog);

router.get("/admin/bonus", authenticate, requireAdmin, adminBonus);
router.get("/admin/bonus/campaigns", authenticate, requireAdmin, adminBonusCampaigns);
router.post(
  "/admin/bonus/campaigns",
  authenticate,
  requireAdmin,
  [
    body("name").isString().isLength({ min: 2 }),
    body("description").isString().isLength({ min: 3 }),
    body("percentage").isString(),
    body("minDeposit").isString(),
    body("maxBonus").optional({ nullable: true }).isString(),
    body("eligibleAssets").optional({ nullable: true }).isArray(),
    body("startsAt").optional({ nullable: true }).isISO8601(),
    body("endsAt").optional({ nullable: true }).isISO8601(),
    body("active").isBoolean(),
    body("priority").isInt(),
    body("eligibility").isObject(),
    body("reason").isString().isLength({ min: 3 })
  ],
  adminSaveBonusCampaign
);
router.post(
  "/admin/bonus/campaigns/:campaignId/deactivate",
  authenticate,
  requireAdmin,
  [param("campaignId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  adminDeactivateBonusCampaign
);
router.delete(
  "/admin/bonus/campaigns/:campaignId",
  authenticate,
  requireAdmin,
  [param("campaignId").isUUID()],
  adminDeleteBonusCampaign
);
router.get("/admin/bonus/credits", authenticate, requireAdmin, adminBonusCredits);
router.post("/admin/bonus/reconcile", authenticate, requireAdmin, adminReconcileBonuses);

router.get("/admin/rewards", authenticate, requireAdmin, adminRewards);
router.get("/admin/rewards/catalog", authenticate, requireAdmin, adminRewardCatalog);
router.post(
  "/admin/rewards/catalog",
  authenticate,
  requireAdmin,
  [
    body("rewardId").optional({ nullable: true }).isUUID(),
    body("name").isString().isLength({ min: 2 }),
    body("description").optional({ nullable: true }).isString(),
    body("category").isIn(["loyalty", "promotional", "referral", "special"]),
    body("amount").isString(),
    body("asset").isString().isLength({ min: 2 }),
    body("requirementType").isIn(["manual", "deposit_total", "invest_total", "membership_tier", "referral_count"]),
    body("requirementAmount").optional({ nullable: true }).isString(),
    body("requirementCount").optional({ nullable: true }).isInt({ min: 0 }),
    body("requirementTierId").optional({ nullable: true }).isUUID(),
    body("maxRedemptions").optional({ nullable: true }).isInt({ min: 1 }),
    body("active").optional({ nullable: true }).isBoolean(),
    body("priority").optional({ nullable: true }).isInt(),
    body("expiresAt").optional({ nullable: true }).isISO8601(),
    body("reason").isString().isLength({ min: 3 })
  ],
  adminSaveReward
);
router.post(
  "/admin/rewards/catalog/:rewardId/deactivate",
  authenticate,
  requireAdmin,
  [param("rewardId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  adminDeactivateReward
);
router.delete(
  "/admin/rewards/catalog/:rewardId",
  authenticate,
  requireAdmin,
  [param("rewardId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  adminDeleteReward
);
router.get("/admin/rewards/grants", authenticate, requireAdmin, adminUserRewards);
router.post(
  "/admin/rewards/grants",
  authenticate,
  requireAdmin,
  [
    body("userId").isUUID(),
    body("rewardId").optional({ nullable: true }).isUUID(),
    body("name").optional({ nullable: true }).isString(),
    body("category").optional({ nullable: true }).isIn(["loyalty", "promotional", "referral", "special"]),
    body("amount").optional({ nullable: true }).isString(),
    body("asset").optional({ nullable: true }).isString(),
    body("expiresAt").optional({ nullable: true }).isISO8601(),
    body("countAsInvestmentEarnings").optional({ nullable: true }).isBoolean(),
    body("reason").isString().isLength({ min: 3 })
  ],
  adminGrantReward
);
router.post(
  "/admin/rewards/grants/:userRewardId/revoke",
  authenticate,
  requireAdmin,
  [param("userRewardId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  adminRevokeReward
);

router.get("/admin/settings", authenticate, requireAdmin, adminSettings);
router.post(
  "/admin/settings",
  authenticate,
  requireAdmin,
  [
    body("category").isIn(["bonus", "performance", "reconciliation", "notifications", "reporting"]),
    body("key").isString().isLength({ min: 1 }),
    body("value").exists(),
    body("reason").isString().isLength({ min: 3 })
  ],
  adminSaveSetting
);
router.post(
  "/admin/settings/reset",
  authenticate,
  requireAdmin,
  [body("reason").isString().isLength({ min: 3 })],
  adminResetSettings
);

router.get("/admin/performance/summary", authenticate, requireAdmin, adminPerformanceSummary);
router.post("/admin/performance/run", authenticate, requireAdmin, adminRunPerformanceCycle);
router.post("/admin/performance/reconcile-ledger", authenticate, requireAdmin, adminReconcilePerformanceLedger);
router.post(
  "/admin/profit-distribution",
  authenticate,
  requireAdmin,
  [
    body("userId").isUUID(),
    body("asset").isString().isLength({ min: 2 }),
    body("amount").isString(),
    body("reason").isString().isLength({ min: 3 })
  ],
  adminProfitDistribution
);

router.get(
  "/admin/balance/users/:userId/overview",
  authenticate,
  requireAdmin,
  [param("userId").isUUID()],
  adminBalanceOverview
);
router.get("/admin/balance/adjustments", authenticate, requireAdmin, adminBalanceAdjustments);
router.post(
  "/admin/balance/adjustments",
  authenticate,
  requireAdmin,
  [
    body("userId").isUUID(),
    body("type").isIn([
      "credit",
      "debit",
      "investment_allocation",
      "investment_deallocation",
      "correction",
      "valuation_correction",
      "pending_earnings",
      "realised_earnings"
    ]),
    body("amount").isString().isLength({ min: 1 }),
    body("reason").isString().isLength({ min: 3 }),
    body("direction").optional({ values: "null" }).isIn(["credit", "debit"]),
    body("note").optional({ values: "null" }).isString(),
    body("positionId").optional({ values: "null" }).isUUID(),
    body("asset").optional({ values: "null" }).isString().isLength({ min: 2 })
  ],
  adminApplyBalanceAdjustment
);
router.post(
  "/admin/balance/adjustments/:adjustmentId/reverse",
  authenticate,
  requireAdmin,
  [param("adjustmentId").isUUID(), body("reason").isString().isLength({ min: 3 })],
  adminReverseBalanceAdjustment
);

export default router;
