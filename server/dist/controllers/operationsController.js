"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentMembership = currentMembership;
exports.currentPerformance = currentPerformance;
exports.overview = overview;
exports.users = users;
exports.profile = profile;
exports.deposits = deposits;
exports.withdrawals = withdrawals;
exports.review = review;
exports.ledger = ledger;
exports.memberships = memberships;
exports.upsertTier = upsertTier;
exports.disableTier = disableTier;
exports.removeTier = removeTier;
exports.membershipConfig = membershipConfig;
exports.activateBenefit = activateBenefit;
exports.adminMembershipUsers = adminMembershipUsers;
exports.adjustMembership = adjustMembership;
exports.clearOverride = clearOverride;
exports.upsertBenefit = upsertBenefit;
exports.removeBenefit = removeBenefit;
exports.activity = activity;
exports.performance = performance;
exports.verifyPerformance = verifyPerformance;
exports.sweepPerformance = sweepPerformance;
exports.currentInvestmentLevel = currentInvestmentLevel;
exports.investmentLevelConfig = investmentLevelConfig;
exports.activateInvestmentBenefit = activateInvestmentBenefit;
exports.investmentLevels = investmentLevels;
exports.upsertInvestmentLevel = upsertInvestmentLevel;
exports.disableInvestmentLevel = disableInvestmentLevel;
exports.removeInvestmentLevel = removeInvestmentLevel;
exports.adminInvestmentLevelUsers = adminInvestmentLevelUsers;
exports.adjustInvestmentLevel = adjustInvestmentLevel;
exports.clearInvestmentOverride = clearInvestmentOverride;
exports.recalculateInvestmentLevel = recalculateInvestmentLevel;
exports.upsertInvestmentBenefit = upsertInvestmentBenefit;
exports.removeInvestmentBenefit = removeInvestmentBenefit;
exports.transactions = transactions;
exports.transactionDetail = transactionDetail;
exports.performanceDaily = performanceDaily;
exports.adminTransactions = adminTransactions;
exports.reconcileTransactionLedger = reconcileTransactionLedger;
exports.reconcilePerformanceSnapshots = reconcilePerformanceSnapshots;
exports.reconciliationLog = reconciliationLog;
exports.myBonuses = myBonuses;
exports.adminBonus = adminBonus;
exports.adminBonusCampaigns = adminBonusCampaigns;
exports.adminSaveBonusCampaign = adminSaveBonusCampaign;
exports.adminDeactivateBonusCampaign = adminDeactivateBonusCampaign;
exports.adminDeleteBonusCampaign = adminDeleteBonusCampaign;
exports.adminBonusCredits = adminBonusCredits;
exports.adminReconcileBonuses = adminReconcileBonuses;
exports.adminSettings = adminSettings;
exports.adminSaveSetting = adminSaveSetting;
exports.adminResetSettings = adminResetSettings;
exports.adminPerformanceSummary = adminPerformanceSummary;
exports.adminRunPerformanceCycle = adminRunPerformanceCycle;
exports.adminReconcilePerformanceLedger = adminReconcilePerformanceLedger;
exports.adminProfitDistribution = adminProfitDistribution;
exports.currentRewards = currentRewards;
exports.redeemUserReward = redeemUserReward;
exports.adminRewards = adminRewards;
exports.adminRewardCatalog = adminRewardCatalog;
exports.adminSaveReward = adminSaveReward;
exports.adminDeactivateReward = adminDeactivateReward;
exports.adminDeleteReward = adminDeleteReward;
exports.adminGrantReward = adminGrantReward;
exports.adminRevokeReward = adminRevokeReward;
exports.adminUserRewards = adminUserRewards;
const express_validator_1 = require("express-validator");
const errorHandler_1 = require("../middleware/errorHandler");
const financialOperationsService_1 = require("../services/financialOperationsService");
const membershipService_1 = require("../services/membershipService");
const investmentLevelService_1 = require("../services/investmentLevelService");
const bonusEngineService_1 = require("../services/bonusEngineService");
const performanceEngineService_1 = require("../services/performanceEngineService");
const platformSettingsService_1 = require("../services/platformSettingsService");
const rewardService_1 = require("../services/rewardService");
const performanceService_1 = require("../services/performanceService");
const transactionService_1 = require("../services/transactionService");
function fail(res, error, status = 400) {
    const correlationId = String(res.locals.correlationId || "");
    if (status >= 500) {
        const categorized = (0, errorHandler_1.categorizeError)(error);
        // eslint-disable-next-line no-console
        console.error(`[api-error] ${JSON.stringify({
            correlationId,
            status,
            category: categorized.category,
            code: categorized.code,
            message: categorized.diagnostic.slice(0, 500)
        })}`);
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
function rejected(req, res) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (errors.isEmpty())
        return false;
    res.status(400).json({ message: errors.array()[0]?.msg || "Invalid request" });
    return true;
}
async function currentMembership(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, membershipService_1.getMembershipView)(req.user.userId));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function currentPerformance(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, financialOperationsService_1.userPerformance)(req.user.userId, String(req.query.range || "30d")));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function overview(_req, res) {
    try {
        res.status(200).json(await (0, financialOperationsService_1.adminOverview)());
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function users(req, res) {
    try {
        res.status(200).json(await (0, financialOperationsService_1.listUsers)(req.query));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function profile(req, res) {
    try {
        res.status(200).json(await (0, financialOperationsService_1.userProfile)(req.params.userId));
    }
    catch (error) {
        fail(res, error, 404);
    }
}
async function deposits(req, res) {
    try {
        res.status(200).json(await (0, financialOperationsService_1.listDeposits)(req.query));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function withdrawals(req, res) {
    try {
        res.status(200).json(await (0, financialOperationsService_1.listWithdrawals)(req.query));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function review(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, financialOperationsService_1.reviewWithdrawal)(req.user.userId, req.params.withdrawalId, body.status, body.reason, body.txHash));
    }
    catch (error) {
        fail(res, error);
    }
}
async function ledger(req, res) {
    if (req.params.entryId && rejected(req, res))
        return;
    try {
        if (req.params.entryId) {
            res.status(200).json(await (0, financialOperationsService_1.listLedger)({ entryId: req.params.entryId }));
            return;
        }
        res.status(200).json(await (0, financialOperationsService_1.listLedger)(req.query));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function memberships(_req, res) {
    try {
        res.status(200).json(await (0, membershipService_1.membershipAdminSummary)());
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function upsertTier(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, membershipService_1.saveMembershipTier)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function disableTier(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        await (0, membershipService_1.deactivateTier)(req.user.userId, req.params.tierId, String(req.body.reason || ""));
        res.status(200).json({ ok: true });
    }
    catch (error) {
        fail(res, error);
    }
}
async function removeTier(req, res) {
    if (rejected(req, res))
        return;
    try {
        await (0, membershipService_1.deleteTier)(req.params.tierId);
        res.status(200).json({ ok: true });
    }
    catch (error) {
        fail(res, error);
    }
}
async function membershipConfig(_req, res) {
    try {
        res.status(200).json({ rules: (0, membershipService_1.getMembershipRules)() });
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function activateBenefit(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, membershipService_1.activateMembershipBenefit)(req.user.userId, req.params.benefitId));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminMembershipUsers(req, res) {
    try {
        res.status(200).json(await (0, membershipService_1.membershipAdminUsers)(req.query));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adjustMembership(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, membershipService_1.adminAdjustMembership)(req.user.userId, req.params.userId, body.tierId ?? null, body.reason));
    }
    catch (error) {
        fail(res, error);
    }
}
async function clearOverride(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, membershipService_1.clearMembershipOverride)(req.user.userId, req.params.userId, body.reason));
    }
    catch (error) {
        fail(res, error);
    }
}
async function upsertBenefit(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, membershipService_1.saveMembershipBenefit)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function removeBenefit(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        await (0, membershipService_1.deleteMembershipBenefit)(req.user.userId, req.params.benefitId, String(req.body.reason || ""));
        res.status(200).json({ ok: true });
    }
    catch (error) {
        fail(res, error);
    }
}
async function activity(req, res) {
    try {
        res.status(200).json(await (0, financialOperationsService_1.listActivity)(req.query));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function performance(_req, res) {
    try {
        res.status(200).json(await (0, financialOperationsService_1.adminPerformance)());
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function verifyPerformance(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(201).json(await (0, financialOperationsService_1.recordVerifiedValuation)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function sweepPerformance(req, res) {
    try {
        const date = String(req.body.snapshotDate || new Date().toISOString().slice(0, 10));
        await (0, financialOperationsService_1.markMissingPerformance)(date);
        res.status(200).json({ ok: true, snapshotDate: date });
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function currentInvestmentLevel(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, investmentLevelService_1.getInvestmentLevelView)(req.user.userId));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function investmentLevelConfig(_req, res) {
    try {
        res.status(200).json({ rules: (0, investmentLevelService_1.getInvestmentLevelRules)() });
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function activateInvestmentBenefit(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, investmentLevelService_1.activateInvestmentLevelBenefit)(req.user.userId, req.params.benefitId));
    }
    catch (error) {
        fail(res, error);
    }
}
async function investmentLevels(_req, res) {
    try {
        res.status(200).json(await (0, investmentLevelService_1.investmentLevelAdminSummary)());
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function upsertInvestmentLevel(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, investmentLevelService_1.saveInvestmentLevel)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function disableInvestmentLevel(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        await (0, investmentLevelService_1.deactivateInvestmentLevel)(req.user.userId, req.params.levelId, String(req.body.reason || ""));
        res.status(200).json({ ok: true });
    }
    catch (error) {
        fail(res, error);
    }
}
async function removeInvestmentLevel(req, res) {
    if (rejected(req, res))
        return;
    try {
        await (0, investmentLevelService_1.deleteInvestmentLevel)(req.params.levelId);
        res.status(200).json({ ok: true });
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminInvestmentLevelUsers(req, res) {
    try {
        res.status(200).json(await (0, investmentLevelService_1.investmentLevelAdminUsers)(req.query));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adjustInvestmentLevel(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res
            .status(200)
            .json(await (0, investmentLevelService_1.adminAdjustInvestmentLevel)(req.user.userId, req.params.userId, body.levelId ?? null, body.reason));
    }
    catch (error) {
        fail(res, error);
    }
}
async function clearInvestmentOverride(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, investmentLevelService_1.clearInvestmentLevelOverride)(req.user.userId, req.params.userId, body.reason));
    }
    catch (error) {
        fail(res, error);
    }
}
async function recalculateInvestmentLevel(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res
            .status(200)
            .json(await (0, investmentLevelService_1.recalculateUserInvestmentLevel)(req.user.userId, req.params.userId, body.reason));
    }
    catch (error) {
        fail(res, error);
    }
}
async function upsertInvestmentBenefit(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, investmentLevelService_1.saveInvestmentLevelBenefit)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function removeInvestmentBenefit(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        await (0, investmentLevelService_1.deleteInvestmentLevelBenefit)(req.user.userId, req.params.benefitId, String(req.body.reason || ""));
        res.status(200).json({ ok: true });
    }
    catch (error) {
        fail(res, error);
    }
}
function transactionQueryFrom(source) {
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
async function transactions(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, transactionService_1.listUserTransactions)(req.user.userId, transactionQueryFrom(req.query)));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function transactionDetail(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, transactionService_1.getUserTransactionDetail)(req.user.userId, req.params.reference));
    }
    catch (error) {
        fail(res, error, 404);
    }
}
async function performanceDaily(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, performanceService_1.getDailyPerformanceDetail)(req.user.userId, req.params.date));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminTransactions(req, res) {
    try {
        const query = transactionQueryFrom(req.query);
        const userId = req.query.userId ? String(req.query.userId) : undefined;
        res.status(200).json(await (0, transactionService_1.listAdminTransactions)({ ...query, userId }));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function reconcileTransactionLedger(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const userId = req.body?.userId ? String(req.body.userId) : undefined;
        res.status(200).json(await (0, transactionService_1.reconcileTransactions)(req.user.userId, userId));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function reconcilePerformanceSnapshots(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const date = String(req.body?.date || new Date().toISOString().slice(0, 10));
        res.status(200).json(await (0, performanceService_1.reconcilePerformance)(req.user.userId, date));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function reconciliationLog(_req, res) {
    try {
        res.status(200).json(await (0, transactionService_1.reconciliationHistory)(100));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function myBonuses(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const [history, totals] = await Promise.all([(0, bonusEngineService_1.bonusHistoryForUser)(req.user.userId), (0, bonusEngineService_1.bonusTotalsForUser)(req.user.userId)]);
        res.status(200).json({ history, totals });
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminBonus(_req, res) {
    try {
        res.status(200).json(await (0, bonusEngineService_1.bonusAdminSummary)());
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminBonusCampaigns(_req, res) {
    try {
        const campaigns = await (0, bonusEngineService_1.listBonusCampaigns)();
        res.status(200).json(campaigns.map((campaign) => ({
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
        })));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminSaveBonusCampaign(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, bonusEngineService_1.saveBonusCampaign)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminDeactivateBonusCampaign(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        await (0, bonusEngineService_1.deactivateBonusCampaign)(req.user.userId, req.params.campaignId, String(req.body.reason || ""));
        res.status(200).json({ ok: true });
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminDeleteBonusCampaign(req, res) {
    if (rejected(req, res))
        return;
    try {
        await (0, bonusEngineService_1.deleteBonusCampaign)(req.params.campaignId);
        res.status(200).json({ ok: true });
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminBonusCredits(req, res) {
    try {
        const query = req.query;
        res.status(200).json(await (0, bonusEngineService_1.listBonusCredits)({
            page: query.page ? Number(query.page) : undefined,
            pageSize: query.pageSize ? Number(query.pageSize) : undefined,
            userId: query.userId ? String(query.userId) : undefined,
            campaignId: query.campaignId ? String(query.campaignId) : undefined
        }));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminReconcileBonuses(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const userId = req.body?.userId ? String(req.body.userId) : undefined;
        res.status(200).json(await (0, bonusEngineService_1.reconcileBonuses)(req.user.userId, userId));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminSettings(_req, res) {
    try {
        const [settings, rows] = await Promise.all([(0, platformSettingsService_1.getPlatformSettings)(), (0, platformSettingsService_1.listPlatformSettings)()]);
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
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminSaveSetting(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        await (0, platformSettingsService_1.savePlatformSetting)(req.user.userId, body.category, body.key, body.value, body.reason, body.description);
        res.status(200).json(await (0, platformSettingsService_1.getPlatformSettings)());
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminResetSettings(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, platformSettingsService_1.resetPlatformSettings)(req.user.userId, String(req.body.reason || "")));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminPerformanceSummary(req, res) {
    try {
        const date = String(req.query.date || new Date().toISOString().slice(0, 10));
        res.status(200).json(await (0, performanceEngineService_1.dailyPerformanceSummary)(date));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminRunPerformanceCycle(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const date = String(req.body?.snapshotDate || new Date().toISOString().slice(0, 10));
        res.status(200).json(await (0, performanceEngineService_1.runDailyPerformanceCycle)(date));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminReconcilePerformanceLedger(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const date = String(req.body?.date || new Date().toISOString().slice(0, 10));
        const userId = req.body?.userId ? String(req.body.userId) : undefined;
        res.status(200).json(await (0, performanceEngineService_1.reconcilePerformanceAgainstLedger)(req.user.userId, date, userId));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminProfitDistribution(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(201).json(await (0, performanceEngineService_1.recordProfitDistribution)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function currentRewards(req, res) {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, rewardService_1.getRewardDashboard)(req.user.userId));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function redeemUserReward(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, rewardService_1.redeemReward)(req.user.userId, req.params.userRewardId));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminRewards(_req, res) {
    try {
        res.status(200).json(await (0, rewardService_1.rewardAdminSummary)());
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminRewardCatalog(_req, res) {
    try {
        res.status(200).json({ rewards: await (0, rewardService_1.listRewardCatalog)() });
    }
    catch (error) {
        fail(res, error, 500);
    }
}
async function adminSaveReward(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(200).json(await (0, rewardService_1.saveRewardForAdmin)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminDeactivateReward(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res
            .status(200)
            .json(await (0, rewardService_1.deactivateReward)(req.user.userId, req.params.rewardId, String(req.body.reason || "")));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminDeleteReward(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res.status(200).json(await (0, rewardService_1.deleteReward)(req.user.userId, req.params.rewardId, String(req.body.reason || "")));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminGrantReward(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const body = req.body;
        res.status(201).json(await (0, rewardService_1.grantRewardToUser)(req.user.userId, body));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminRevokeReward(req, res) {
    if (rejected(req, res))
        return;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        res
            .status(200)
            .json(await (0, rewardService_1.revokeUserReward)(req.user.userId, req.params.userRewardId, String(req.body.reason || "")));
    }
    catch (error) {
        fail(res, error);
    }
}
async function adminUserRewards(req, res) {
    try {
        res.status(200).json(await (0, rewardService_1.listUserRewardsForAdmin)(req.query));
    }
    catch (error) {
        fail(res, error, 500);
    }
}
