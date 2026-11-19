"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const operationsController_1 = require("../controllers/operationsController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/membership", auth_1.authenticate, operationsController_1.currentMembership);
router.get("/membership/config", auth_1.authenticate, operationsController_1.membershipConfig);
router.post("/membership/benefits/:benefitId/activate", auth_1.authenticate, [(0, express_validator_1.param)("benefitId").isUUID()], operationsController_1.activateBenefit);
router.get("/investment-level", auth_1.authenticate, operationsController_1.currentInvestmentLevel);
router.get("/investment-level/config", auth_1.authenticate, operationsController_1.investmentLevelConfig);
router.post("/investment-level/benefits/:benefitId/activate", auth_1.authenticate, [(0, express_validator_1.param)("benefitId").isUUID()], operationsController_1.activateInvestmentBenefit);
router.get("/performance", auth_1.authenticate, operationsController_1.currentPerformance);
router.get("/performance/daily/:date", auth_1.authenticate, operationsController_1.performanceDaily);
router.get("/bonuses", auth_1.authenticate, operationsController_1.myBonuses);
router.get("/rewards", auth_1.authenticate, operationsController_1.currentRewards);
router.post("/rewards/:userRewardId/redeem", auth_1.authenticate, [(0, express_validator_1.param)("userRewardId").isUUID()], operationsController_1.redeemUserReward);
router.get("/transactions", auth_1.authenticate, operationsController_1.transactions);
router.get("/transactions/:reference", auth_1.authenticate, operationsController_1.transactionDetail);
router.get("/admin/overview", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.overview);
router.get("/admin/users", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.users);
router.get("/admin/users/:userId", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.profile);
router.delete("/admin/users/:userId", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("userId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.removeUser);
router.get("/admin/deposits", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.deposits);
router.get("/admin/withdrawals", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.withdrawals);
router.post("/admin/withdrawals/:withdrawalId/review", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("withdrawalId").isUUID(), (0, express_validator_1.body)("status").isString(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.review);
router.get("/admin/ledger", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.ledger);
router.get("/admin/memberships", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.memberships);
router.post("/admin/memberships", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("name").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("description").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("minAmount").isString(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("sortOrder").isInt(),
    (0, express_validator_1.body)("active").isBoolean(),
    (0, express_validator_1.body)("benefits").isArray()
], operationsController_1.upsertTier);
router.post("/admin/memberships/:tierId/deactivate", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("tierId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.disableTier);
router.delete("/admin/memberships/:tierId", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("tierId").isUUID()], operationsController_1.removeTier);
router.get("/admin/membership/users", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminMembershipUsers);
router.post("/admin/membership/users/:userId/adjust", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.param)("userId").isUUID(),
    (0, express_validator_1.body)("tierId").optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.adjustMembership);
router.post("/admin/membership/users/:userId/clear-override", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("userId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.clearOverride);
router.post("/admin/membership/benefits", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("tierId").isUUID(),
    (0, express_validator_1.body)("code").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("name").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("description").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("available").isBoolean(),
    (0, express_validator_1.body)("requiresActivation").isBoolean(),
    (0, express_validator_1.body)("sortOrder").isInt(),
    (0, express_validator_1.body)("active").isBoolean(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.upsertBenefit);
router.delete("/admin/membership/benefits/:benefitId", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("benefitId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.removeBenefit);
router.get("/admin/investment-levels", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.investmentLevels);
router.post("/admin/investment-levels", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("levelNumber").isInt({ min: 1 }),
    (0, express_validator_1.body)("name").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("description").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("threshold").isString(),
    (0, express_validator_1.body)("sortOrder").isInt(),
    (0, express_validator_1.body)("active").isBoolean(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.upsertInvestmentLevel);
router.post("/admin/investment-levels/:levelId/deactivate", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("levelId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.disableInvestmentLevel);
router.delete("/admin/investment-levels/:levelId", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("levelId").isUUID()], operationsController_1.removeInvestmentLevel);
router.get("/admin/investment-level/users", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminInvestmentLevelUsers);
router.post("/admin/investment-level/users/:userId/adjust", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.param)("userId").isUUID(),
    (0, express_validator_1.body)("levelId").optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.adjustInvestmentLevel);
router.post("/admin/investment-level/users/:userId/clear-override", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("userId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.clearInvestmentOverride);
router.post("/admin/investment-level/users/:userId/recalculate", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("userId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.recalculateInvestmentLevel);
router.post("/admin/investment-level/benefits", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("levelId").isUUID(),
    (0, express_validator_1.body)("code").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("name").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("description").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("category").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("available").isBoolean(),
    (0, express_validator_1.body)("requiresActivation").isBoolean(),
    (0, express_validator_1.body)("sortOrder").isInt(),
    (0, express_validator_1.body)("active").isBoolean(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.upsertInvestmentBenefit);
router.delete("/admin/investment-level/benefits/:benefitId", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("benefitId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.removeInvestmentBenefit);
router.get("/admin/ledger/:entryId", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("entryId").isUUID()], operationsController_1.ledger);
router.get("/admin/activity", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.activity);
router.get("/admin/performance", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.performance);
router.post("/admin/performance/verify", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("positionId").isUUID(),
    (0, express_validator_1.body)("snapshotDate").isISO8601(),
    (0, express_validator_1.body)("closingValuation").isString(),
    (0, express_validator_1.body)("dataSource").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("evidenceRef").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.verifyPerformance);
router.post("/admin/performance/sweep", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.sweepPerformance);
router.get("/admin/transactions", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminTransactions);
router.post("/admin/reconcile/transactions", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.reconcileTransactionLedger);
router.post("/admin/reconcile/performance", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.reconcilePerformanceSnapshots);
router.get("/admin/reconcile/history", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.reconciliationLog);
router.get("/admin/bonus", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminBonus);
router.get("/admin/bonus/campaigns", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminBonusCampaigns);
router.post("/admin/bonus/campaigns", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("name").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("description").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("percentage").isString(),
    (0, express_validator_1.body)("minDeposit").isString(),
    (0, express_validator_1.body)("maxBonus").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("eligibleAssets").optional({ nullable: true }).isArray(),
    (0, express_validator_1.body)("startsAt").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("endsAt").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("active").isBoolean(),
    (0, express_validator_1.body)("priority").isInt(),
    (0, express_validator_1.body)("eligibility").isObject(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.adminSaveBonusCampaign);
router.post("/admin/bonus/campaigns/:campaignId/deactivate", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("campaignId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.adminDeactivateBonusCampaign);
router.delete("/admin/bonus/campaigns/:campaignId", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("campaignId").isUUID()], operationsController_1.adminDeleteBonusCampaign);
router.get("/admin/bonus/credits", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminBonusCredits);
router.post("/admin/bonus/reconcile", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminReconcileBonuses);
router.get("/admin/rewards", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminRewards);
router.get("/admin/rewards/catalog", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminRewardCatalog);
router.post("/admin/rewards/catalog", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("rewardId").optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)("name").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("description").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("category").isIn(["loyalty", "promotional", "referral", "special"]),
    (0, express_validator_1.body)("amount").isString(),
    (0, express_validator_1.body)("asset").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("requirementType").isIn(["manual", "deposit_total", "invest_total", "membership_tier", "referral_count"]),
    (0, express_validator_1.body)("requirementAmount").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("requirementCount").optional({ nullable: true }).isInt({ min: 0 }),
    (0, express_validator_1.body)("requirementTierId").optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)("maxRedemptions").optional({ nullable: true }).isInt({ min: 1 }),
    (0, express_validator_1.body)("active").optional({ nullable: true }).isBoolean(),
    (0, express_validator_1.body)("priority").optional({ nullable: true }).isInt(),
    (0, express_validator_1.body)("expiresAt").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.adminSaveReward);
router.post("/admin/rewards/catalog/:rewardId/deactivate", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("rewardId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.adminDeactivateReward);
router.delete("/admin/rewards/catalog/:rewardId", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("rewardId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.adminDeleteReward);
router.get("/admin/rewards/grants", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminUserRewards);
router.post("/admin/rewards/grants", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("userId").isUUID(),
    (0, express_validator_1.body)("rewardId").optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)("name").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("category").optional({ nullable: true }).isIn(["loyalty", "promotional", "referral", "special"]),
    (0, express_validator_1.body)("amount").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("asset").optional({ nullable: true }).isString(),
    (0, express_validator_1.body)("expiresAt").optional({ nullable: true }).isISO8601(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.adminGrantReward);
router.post("/admin/rewards/grants/:userRewardId/revoke", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("userRewardId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.adminRevokeReward);
router.get("/admin/settings", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminSettings);
router.post("/admin/settings", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("category").isIn(["bonus", "performance", "reconciliation", "notifications", "reporting"]),
    (0, express_validator_1.body)("key").isString().isLength({ min: 1 }),
    (0, express_validator_1.body)("value").exists(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.adminSaveSetting);
router.post("/admin/settings/reset", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.adminResetSettings);
router.get("/admin/performance/summary", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminPerformanceSummary);
router.post("/admin/performance/run", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminRunPerformanceCycle);
router.post("/admin/performance/reconcile-ledger", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminReconcilePerformanceLedger);
router.post("/admin/profit-distribution", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("userId").isUUID(),
    (0, express_validator_1.body)("asset").isString().isLength({ min: 2 }),
    (0, express_validator_1.body)("amount").isString(),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })
], operationsController_1.adminProfitDistribution);
router.get("/admin/balance/users/:userId/overview", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("userId").isUUID()], operationsController_1.adminBalanceOverview);
router.get("/admin/balance/adjustments", auth_1.authenticate, auth_1.requireAdmin, operationsController_1.adminBalanceAdjustments);
router.post("/admin/balance/adjustments", auth_1.authenticate, auth_1.requireAdmin, [
    (0, express_validator_1.body)("userId").isUUID(),
    (0, express_validator_1.body)("type").isIn([
        "credit",
        "debit",
        "investment_allocation",
        "investment_deallocation",
        "correction",
        "valuation_correction",
        "pending_earnings",
        "realised_earnings"
    ]),
    (0, express_validator_1.body)("amount").isString().isLength({ min: 1 }),
    (0, express_validator_1.body)("reason").isString().isLength({ min: 3 }),
    (0, express_validator_1.body)("direction").optional({ values: "null" }).isIn(["credit", "debit"]),
    (0, express_validator_1.body)("note").optional({ values: "null" }).isString(),
    (0, express_validator_1.body)("positionId").optional({ values: "null" }).isUUID(),
    (0, express_validator_1.body)("asset").optional({ values: "null" }).isString().isLength({ min: 2 })
], operationsController_1.adminApplyBalanceAdjustment);
router.post("/admin/balance/adjustments/:adjustmentId/reverse", auth_1.authenticate, auth_1.requireAdmin, [(0, express_validator_1.param)("adjustmentId").isUUID(), (0, express_validator_1.body)("reason").isString().isLength({ min: 3 })], operationsController_1.adminReverseBalanceAdjustment);
exports.default = router;
