"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvestmentLevelRules = getInvestmentLevelRules;
exports.ensureDefaultInvestmentLevels = ensureDefaultInvestmentLevels;
exports.ensureDefaultInvestmentLevelBenefits = ensureDefaultInvestmentLevelBenefits;
exports.calculateQualifyingInvestment = calculateQualifyingInvestment;
exports.syncUserInvestmentLevel = syncUserInvestmentLevel;
exports.getInvestmentLevelView = getInvestmentLevelView;
exports.activateInvestmentLevelBenefit = activateInvestmentLevelBenefit;
exports.saveInvestmentLevel = saveInvestmentLevel;
exports.deactivateInvestmentLevel = deactivateInvestmentLevel;
exports.deleteInvestmentLevel = deleteInvestmentLevel;
exports.saveInvestmentLevelBenefit = saveInvestmentLevelBenefit;
exports.deleteInvestmentLevelBenefit = deleteInvestmentLevelBenefit;
exports.investmentLevelAdminSummary = investmentLevelAdminSummary;
exports.investmentLevelAdminUsers = investmentLevelAdminUsers;
exports.adminAdjustInvestmentLevel = adminAdjustInvestmentLevel;
exports.clearInvestmentLevelOverride = clearInvestmentLevelOverride;
exports.recalculateUserInvestmentLevel = recalculateUserInvestmentLevel;
const sequelize_1 = require("sequelize");
const database_1 = require("../config/database");
const money_1 = require("../domain/money");
const investmentLevelRules_1 = require("../domain/investmentLevelRules");
const AdminAuditLog_1 = require("../models/AdminAuditLog");
const Deposit_1 = require("../models/Deposit");
const InvestmentLevel_1 = require("../models/InvestmentLevel");
const InvestmentLevelBenefit_1 = require("../models/InvestmentLevelBenefit");
const InvestmentLevelHistory_1 = require("../models/InvestmentLevelHistory");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
const UserInvestmentLevel_1 = require("../models/UserInvestmentLevel");
const UserInvestmentLevelBenefit_1 = require("../models/UserInvestmentLevelBenefit");
const activityService_1 = require("./activityService");
const marketDataService_1 = require("./marketDataService");
const DEFAULT_LEVELS = [
    { number: 1, name: "Level 1", threshold: "1000.00", sort: 1, accent: "#8B7355", description: "Unlocked at $1,000 of invested principal: reduced platform fees on deposits and withdrawals." },
    { number: 2, name: "Level 2", threshold: "3000.00", sort: 2, accent: "#A98A5C", description: "Unlocked at $3,000: priority on-chain verification so your deposits confirm sooner." },
    { number: 3, name: "Level 3", threshold: "5000.00", sort: 3, accent: "#C6A15B", description: "Unlocked at $5,000: a higher withdrawal allowance for larger payouts." },
    { number: 4, name: "Level 4", threshold: "7000.00", sort: 4, accent: "#CDAD6C", description: "Unlocked at $7,000: discounted withdrawal fees across supported networks." },
    { number: 5, name: "Level 5", threshold: "10000.00", sort: 5, accent: "#D4B87D", description: "Unlocked at $10,000: a rewards accelerator on your qualifying deposits." },
    { number: 6, name: "Level 6", threshold: "12000.00", sort: 6, accent: "#DBC38E", description: "Unlocked at $12,000: early access to new promotional campaigns." },
    { number: 7, name: "Level 7", threshold: "15000.00", sort: 7, accent: "#E0C9A0", description: "Unlocked at $15,000: a priority payout queue for your approved withdrawals." },
    { number: 8, name: "Level 8", threshold: "18000.00", sort: 8, accent: "#E6D2B1", description: "Unlocked at $18,000: a dedicated account strategist for your account." },
    { number: 9, name: "Level 9", threshold: "22000.00", sort: 9, accent: "#EBDBBF", description: "Unlocked at $22,000: elevated referral commissions on the users you invite." },
    { number: 10, name: "Level 10", threshold: "25000.00", sort: 10, accent: "#F5F5F7", description: "Unlocked at $25,000: the private client desk, with maximum limits and the lowest fee schedule." }
];
const DEFAULT_BENEFITS = [
    { code: "reduced_platform_fees", name: "Fee-advantaged account", description: "Your deposits and withdrawals are processed on a reduced fee schedule, so a smaller share of every movement is consumed by platform charges.", category: "pricing", level: 1, requiresActivation: false, sort: 1 },
    { code: "priority_deposit_verification", name: "Priority deposit verification", description: "Your deposits are queued ahead of standard on-chain verification, so confirmed funds and updated invested principal reach your account faster.", category: "service", level: 2, requiresActivation: false, sort: 2 },
    { code: "higher_withdrawal_allowance", name: "Higher withdrawal allowance", description: "Your daily and per-transaction withdrawal limits are raised, giving you more headroom to move funds whenever you need them.", category: "limits", level: 3, requiresActivation: false, sort: 3 },
    { code: "reduced_withdrawal_fees", name: "Reduced withdrawal fees", description: "Network and platform fees on withdrawals are discounted at your level, so more of each payout arrives at your destination address.", category: "pricing", level: 4, requiresActivation: false, sort: 4 },
    { code: "rewards_accelerator", name: "Rewards accelerator", description: "Qualifying deposits earn an elevated promotional reward rate, accelerating the credits added to your rewards balance. Activate it to enroll in the acceleration programme.", category: "rewards", level: 5, requiresActivation: true, sort: 5 },
    { code: "early_campaign_access", name: "Early access to bonus campaigns", description: "New promotional campaigns open to you before general release, so you can capture the strongest available reward conditions first.", category: "rewards", level: 6, requiresActivation: false, sort: 6 },
    { code: "priority_payout_queue", name: "Priority payout queue", description: "Approved withdrawals are placed at the front of the broadcast queue, shortening the wait between your request and the on-chain transaction.", category: "service", level: 7, requiresActivation: false, sort: 7 },
    { code: "dedicated_account_strategist", name: "Dedicated account strategist", description: "A named specialist is assigned to your account for allocation guidance and account planning. Activate it to book your first strategy session.", category: "service", level: 8, requiresActivation: true, sort: 8 },
    { code: "elevated_referral_commissions", name: "Elevated referral commissions", description: "Referrals you invite are rewarded at an increased commission rate, so your network contributes more to your rewards balance.", category: "rewards", level: 9, requiresActivation: false, sort: 9 },
    { code: "private_client_desk", name: "Private client desk", description: "Maximum limits, the lowest available fee schedule and a private client desk for direct, priority assistance.", category: "service", level: 10, requiresActivation: false, sort: 10 }
];
const QUALIFICATION_METRIC = {
    code: "invested_principal_usd",
    label: "Invested principal, valued in USD",
    description: "Investment level qualification uses the USD value of deposits that have been approved and verified on-chain, which forms your invested principal. Pending, rejected, and unpriced deposits are excluded, duplicate events are counted once, and unrealised performance is never counted as contributed capital. Under the platform retention policy, a completed withdrawal or a closed investment does not silently remove qualification that has already been earned."
};
const INVESTMENT_LEVEL_RULES = {
    qualificationMetric: QUALIFICATION_METRIC,
    creditedEvents: [
        "Deposits with status Approved, valued at the current market price of the deposited asset"
    ],
    excludedEvents: [
        "Pending or under-review deposits",
        "Rejected or failed deposits",
        "Duplicate deposit events that do not add a new verified deposit",
        "Deposits that cannot be priced with a reliable market price",
        "Unrealised gains and daily investment performance",
        "Referral rewards and bonus credits"
    ],
    automaticUpgrades: true,
    downgradesSupported: false,
    downgradePolicy: "The platform does not automatically lower an investment level when invested principal falls. A level earned from verified deposits is retained, and the platform can review an exception when policy requires it.",
    retentionPolicy: "Benefits remain available while the assigned investment level stays in place. Levels are independent from membership tiers and from verified investment performance.",
    manualOverridePolicy: "The platform can assign an investment level exception. Every manual change records the operator, the previous level, the new level, and a reason, and it is written to an immutable audit entry.",
    reviewPeriodDays: null,
    gracePeriodDays: null,
    minimumRetentionAmount: null
};
function getInvestmentLevelRules() {
    return INVESTMENT_LEVEL_RULES;
}
function assetSymbol(cryptoType) {
    if (cryptoType === "BTC" || cryptoType === "ETH" || cryptoType === "SOL")
        return cryptoType;
    if (cryptoType === "ERC20" || cryptoType === "TRC20" || cryptoType === "USDT_ERC20" || cryptoType === "USDT_TRC20")
        return "USDT";
    return null;
}
function toRange(level) {
    return {
        id: level.level_config_id,
        levelNumber: level.level_number,
        thresholdCents: (0, money_1.parseDecimal)(String(level.qualification_threshold), 2),
        active: level.active,
        sortOrder: level.sort_order
    };
}
function money(cents) {
    return (0, money_1.formatDecimal)(cents, 2);
}
function clip(text, max = 240) {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
function accentOf(theme) {
    const accent = theme?.accent;
    return typeof accent === "string" && accent.length > 0 ? accent : "#C6A15B";
}
async function ensureDefaultInvestmentLevels() {
    const count = await InvestmentLevel_1.InvestmentLevel.count();
    if (count > 0)
        return;
    for (const level of DEFAULT_LEVELS) {
        await InvestmentLevel_1.InvestmentLevel.create({
            level_number: level.number,
            name: level.name,
            description: level.description,
            qualification_metric: QUALIFICATION_METRIC.code,
            qualification_threshold: level.threshold,
            icon: `level_${level.number}`,
            theme: { accent: level.accent },
            sort_order: level.sort,
            active: true,
            effective_from: null
        });
    }
}
async function ensureDefaultInvestmentLevelBenefits() {
    const count = await InvestmentLevelBenefit_1.InvestmentLevelBenefit.count();
    if (count > 0)
        return;
    const levels = await InvestmentLevel_1.InvestmentLevel.findAll();
    const byNumber = new Map(levels.map((level) => [level.level_number, level]));
    for (const seed of DEFAULT_BENEFITS) {
        const level = byNumber.get(seed.level);
        if (!level)
            continue;
        await InvestmentLevelBenefit_1.InvestmentLevelBenefit.create({
            level_config_id: level.level_config_id,
            code: seed.code,
            name: seed.name,
            description: seed.description,
            category: seed.category,
            available: true,
            requires_activation: seed.requiresActivation,
            sort_order: seed.sort,
            active: true
        });
    }
}
async function calculateQualifyingInvestment(userId) {
    const [deposits, prices] = await Promise.all([
        Deposit_1.Deposit.findAll({ where: { user_id: userId, status: "Approved" } }),
        (0, marketDataService_1.getAllMarketPrices)()
    ]);
    let total = 0n;
    const seen = new Set();
    for (const deposit of deposits) {
        if (seen.has(deposit.deposit_id))
            continue;
        seen.add(deposit.deposit_id);
        const symbol = assetSymbol(deposit.crypto_type);
        const price = symbol ? prices[symbol]?.price : null;
        if (!symbol || price === undefined || price === null || !Number.isFinite(price) || price <= 0) {
            return { amount: null, complete: false };
        }
        total += (0, money_1.multiplyDecimal)(Number(deposit.amount).toFixed(8), Number(price).toFixed(8), 8, 8, 2);
    }
    return { amount: (0, money_1.formatDecimal)(total, 2), complete: true };
}
async function countBenefitsForLevel(level, levels) {
    const numberById = new Map(levels.map((row) => [row.level_config_id, row.level_number]));
    const benefits = await InvestmentLevelBenefit_1.InvestmentLevelBenefit.findAll({ where: { active: true, available: true } });
    return benefits.filter((benefit) => (numberById.get(benefit.level_config_id) ?? Number.POSITIVE_INFINITY) <= level.level_number).length;
}
async function provisionLevelBenefits(userId, current, benefits, numberById, transaction) {
    if (!current)
        return;
    const rows = benefits
        .filter((benefit) => !benefit.requires_activation &&
        benefit.available &&
        (numberById.get(benefit.level_config_id) ?? Number.POSITIVE_INFINITY) <= current.level_number)
        .map((benefit) => ({
        user_id: userId,
        benefit_id: benefit.benefit_id,
        activated_at: new Date(),
        note: `Provisioned automatically when ${current.name} was assigned`
    }));
    if (rows.length === 0)
        return;
    await UserInvestmentLevelBenefit_1.UserInvestmentLevelBenefit.bulkCreate(rows, { ignoreDuplicates: true, transaction });
}
async function notifyInvestmentLevelChange(userId, fromName, toName, amount, benefitCount) {
    const transition = fromName ? `You advanced from ${fromName} to ${toName}` : `You reached ${toName}`;
    await Notification_1.Notification.create({
        type: "investment_level_upgrade",
        message: clip(`${transition}. Your qualifying invested principal is $${amount}. ${benefitCount} investment level benefit${benefitCount === 1 ? "" : "s"} ${benefitCount === 1 ? "is" : "are"} now available on your account. Investment levels do not guarantee investment performance.`),
        user_id: userId
    });
}
async function notifyApproachingNextLevel(userId, next, remaining) {
    const type = `investment_level_approaching:${next.level_config_id}`;
    const existing = await Notification_1.Notification.findOne({ where: { user_id: userId, type } });
    if (existing)
        return;
    await Notification_1.Notification.create({
        type,
        message: clip(`You are $${remaining} of invested principal away from ${next.name}. Qualification is based on approved, verified deposits only.`),
        user_id: userId
    });
}
async function recordTransition(input) {
    await InvestmentLevelHistory_1.InvestmentLevelHistory.create({
        user_id: input.userId,
        from_level_id: input.from?.level_config_id ?? null,
        to_level_id: input.to?.level_config_id ?? null,
        from_level_number: input.from?.level_number ?? null,
        to_level_number: input.to?.level_number ?? null,
        from_level_name: input.from?.name ?? null,
        to_level_name: input.to?.name ?? null,
        qualifying_amount: input.amount,
        reason: input.reason,
        source: input.source,
        actor_admin_id: input.actorAdminId
    }, { transaction: input.transaction });
}
async function syncUserInvestmentLevel(userId, reason = "Qualified from approved invested principal") {
    const qualification = await calculateQualifyingInvestment(userId);
    const levels = await InvestmentLevel_1.InvestmentLevel.findAll();
    const ranges = levels.map(toRange);
    const numberById = new Map(levels.map((level) => [level.level_config_id, level.level_number]));
    const current = await UserInvestmentLevel_1.UserInvestmentLevel.findByPk(userId);
    const amountComplete = qualification.complete && qualification.amount !== null;
    const now = new Date();
    if (current?.manual_level_id) {
        const manualLevel = levels.find((level) => level.level_config_id === current.manual_level_id) ?? null;
        if (manualLevel) {
            let dirty = false;
            if (current.level_config_id !== manualLevel.level_config_id) {
                current.level_config_id = manualLevel.level_config_id;
                dirty = true;
            }
            if (amountComplete && current.qualifying_amount !== qualification.amount) {
                current.qualifying_amount = qualification.amount;
                dirty = true;
            }
            if (dirty) {
                current.updated_at = now;
                await current.save();
            }
            return;
        }
        current.manual_level_id = null;
        current.manual_reason = null;
        current.manual_set_at = null;
    }
    if (!amountComplete) {
        if (current) {
            current.updated_at = now;
            await current.save();
        }
        return;
    }
    const amount = qualification.amount;
    const amountCents = (0, money_1.parseDecimal)(amount, 2);
    const derived = (0, investmentLevelRules_1.qualifyLevel)(amountCents, ranges);
    const derivedNumber = derived ? derived.levelNumber : null;
    const currentLevel = current?.level_config_id
        ? levels.find((level) => level.level_config_id === current.level_config_id) ?? null
        : null;
    const currentNumber = currentLevel ? currentLevel.level_number : null;
    if (!current) {
        if (!derived)
            return;
        const createdLevel = levels.find((level) => level.level_config_id === derived.id) ?? null;
        await UserInvestmentLevel_1.UserInvestmentLevel.create({
            user_id: userId,
            level_config_id: derived.id,
            qualifying_amount: amount,
            achieved_at: now,
            reason
        });
        await recordTransition({
            userId,
            from: null,
            to: createdLevel,
            amount,
            reason,
            source: "automatic",
            actorAdminId: null
        });
        if (createdLevel) {
            const benefitCount = await countBenefitsForLevel(createdLevel, levels);
            await provisionLevelBenefits(userId, createdLevel, await InvestmentLevelBenefit_1.InvestmentLevelBenefit.findAll({ where: { active: true } }), numberById);
            await notifyInvestmentLevelChange(userId, null, createdLevel.name, amount, benefitCount);
        }
        await (0, activityService_1.trackUserActivity)(userId, "configuration_change", {
            scope: "investment_level",
            fromLevelNumber: null,
            toLevelNumber: derived.levelNumber,
            qualifyingAmount: amount,
            outcome: "automatic"
        });
        return;
    }
    if (!(0, investmentLevelRules_1.shouldUpgradeLevel)(currentNumber, derivedNumber)) {
        current.qualifying_amount = amount;
        current.updated_at = now;
        await current.save();
        const nextRange = (0, investmentLevelRules_1.nextLevelAfter)(currentNumber, ranges);
        const next = nextRange ? levels.find((level) => level.level_config_id === nextRange.id) ?? null : null;
        if (next) {
            const nextThreshold = (0, money_1.parseDecimal)(String(next.qualification_threshold), 2);
            if ((0, investmentLevelRules_1.isApproachingNextLevel)(amountCents, nextThreshold)) {
                await notifyApproachingNextLevel(userId, next, (0, money_1.formatDecimal)(nextThreshold - amountCents, 2));
            }
        }
        return;
    }
    const upgradedLevel = derived ? levels.find((level) => level.level_config_id === derived.id) ?? null : null;
    current.level_config_id = derived?.id ?? current.level_config_id;
    current.qualifying_amount = amount;
    current.achieved_at = now;
    current.reason = reason;
    current.updated_at = now;
    await current.save();
    await recordTransition({
        userId,
        from: currentLevel,
        to: upgradedLevel,
        amount,
        reason,
        source: "automatic",
        actorAdminId: null
    });
    if (upgradedLevel) {
        const benefitCount = await countBenefitsForLevel(upgradedLevel, levels);
        await provisionLevelBenefits(userId, upgradedLevel, await InvestmentLevelBenefit_1.InvestmentLevelBenefit.findAll({ where: { active: true } }), numberById);
        await notifyInvestmentLevelChange(userId, currentLevel?.name ?? null, upgradedLevel.name, amount, benefitCount);
    }
    await (0, activityService_1.trackUserActivity)(userId, "configuration_change", {
        scope: "investment_level",
        fromLevelNumber: currentNumber,
        toLevelNumber: derived?.levelNumber ?? null,
        qualifyingAmount: amount,
        outcome: "automatic"
    });
}
async function getInvestmentLevelView(userId) {
    await syncUserInvestmentLevel(userId);
    const [levels, userLevel, history, qualification] = await Promise.all([
        InvestmentLevel_1.InvestmentLevel.findAll({ order: [["level_number", "ASC"]] }),
        UserInvestmentLevel_1.UserInvestmentLevel.findByPk(userId),
        InvestmentLevelHistory_1.InvestmentLevelHistory.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]], limit: 100 }),
        calculateQualifyingInvestment(userId)
    ]);
    const levelById = new Map(levels.map((level) => [level.level_config_id, level]));
    const numberById = new Map(levels.map((level) => [level.level_config_id, level.level_number]));
    const activeLevels = levels.filter((level) => level.active);
    const current = userLevel?.level_config_id ? levelById.get(userLevel.level_config_id) ?? null : null;
    const currentNumber = current ? current.level_number : null;
    const ranges = levels.map(toRange);
    const amountCents = qualification.amount ? (0, money_1.parseDecimal)(qualification.amount, 2) : null;
    const nextRange = (0, investmentLevelRules_1.nextLevelAfter)(currentNumber, ranges);
    const next = nextRange ? levelById.get(nextRange.id) ?? null : null;
    const remainingCents = next && amountCents !== null ? (0, money_1.parseDecimal)(String(next.qualification_threshold), 2) - amountCents : null;
    const nextThresholdCents = next ? (0, money_1.parseDecimal)(String(next.qualification_threshold), 2) : null;
    const currentThresholdCents = current ? (0, money_1.parseDecimal)(String(current.qualification_threshold), 2) : 0n;
    const benefitRows = await InvestmentLevelBenefit_1.InvestmentLevelBenefit.findAll({ where: { active: true }, order: [["sort_order", "ASC"]] });
    await provisionLevelBenefits(userId, current, benefitRows, numberById);
    const activations = await UserInvestmentLevelBenefit_1.UserInvestmentLevelBenefit.findAll({ where: { user_id: userId } });
    const activatedById = new Map(activations.map((row) => [row.benefit_id, row]));
    const benefits = benefitRows.map((benefit) => {
        const requiredNumber = numberById.get(benefit.level_config_id) ?? Number.POSITIVE_INFINITY;
        const activation = activatedById.get(benefit.benefit_id) ?? null;
        const state = (0, investmentLevelRules_1.resolveInvestmentBenefitState)(currentNumber, {
            levelNumber: requiredNumber,
            available: benefit.available,
            requiresActivation: benefit.requires_activation,
            activated: Boolean(activation)
        });
        const requiredLevel = levelById.get(benefit.level_config_id) ?? null;
        return {
            benefitId: benefit.benefit_id,
            code: benefit.code,
            name: benefit.name,
            description: benefit.description,
            category: benefit.category,
            available: benefit.available,
            requiresActivation: benefit.requires_activation,
            state,
            applicableLevelId: benefit.level_config_id,
            applicableLevelName: requiredLevel?.name ?? null,
            applicableLevelNumber: requiredLevel?.level_number ?? null,
            activatedAt: activation?.activated_at ?? null
        };
    });
    const journey = activeLevels.map((level) => ({
        levelId: level.level_config_id,
        name: level.name,
        levelNumber: level.level_number,
        description: level.description,
        icon: level.icon,
        theme: level.theme,
        threshold: String(level.qualification_threshold),
        effectiveFrom: level.effective_from,
        state: (0, investmentLevelRules_1.levelJourneyState)(currentNumber, next?.level_number ?? null, level.level_number),
        requirement: `$${String(level.qualification_threshold)} or more in approved invested principal`,
        benefits: benefits
            .filter((benefit) => (numberById.get(benefit.applicableLevelId) ?? Number.POSITIVE_INFINITY) <= level.level_number)
            .map((benefit) => ({
            benefitId: benefit.benefitId,
            name: benefit.name,
            description: benefit.description,
            requiresActivation: benefit.requiresActivation,
            state: benefit.state
        }))
    }));
    const status = current
        ? userLevel?.manual_level_id
            ? {
                code: "manual_review",
                label: "Active · platform exception",
                description: `This level was assigned by the platform. ${userLevel.manual_reason ?? ""}`.trim()
            }
            : {
                code: "active",
                label: "Active",
                description: "Your investment level was assigned automatically from approved, verified invested principal."
            }
        : {
            code: "unqualified",
            label: "Not yet qualified",
            description: "No investment level is assigned until approved invested principal reaches the lowest active level and every approved deposit can be priced."
        };
    return {
        qualificationMetric: QUALIFICATION_METRIC,
        rules: INVESTMENT_LEVEL_RULES,
        qualifyingAmount: qualification.amount,
        qualifyingComplete: qualification.complete,
        explanation: current
            ? `This level is assigned because approved invested principal prices to $${qualification.amount} USD, which meets ${current.name} requirements. Investment levels are independent of membership tiers and do not guarantee investment performance.`
            : "No investment level is assigned until approved invested principal meets the lowest active level and every approved deposit can be priced.",
        status,
        current: current
            ? {
                levelId: current.level_config_id,
                name: current.name,
                levelNumber: current.level_number,
                description: current.description,
                threshold: String(current.qualification_threshold),
                icon: current.icon,
                theme: { accent: accentOf(current.theme) },
                benefits: benefits.filter((benefit) => benefit.state === "active").map((benefit) => benefit.name),
                achievedAt: userLevel?.achieved_at ?? null,
                source: userLevel?.manual_level_id ? "admin" : "automatic",
                manualReason: userLevel?.manual_reason ?? null,
                manualSetAt: userLevel?.manual_set_at ?? null,
                isHighestLevel: next === null
            }
            : null,
        next: next
            ? {
                levelId: next.level_config_id,
                name: next.name,
                levelNumber: next.level_number,
                threshold: String(next.qualification_threshold)
            }
            : null,
        nextLevelBenefits: next
            ? benefits
                .filter((benefit) => benefit.applicableLevelId === next.level_config_id)
                .map((benefit) => ({
                benefitId: benefit.benefitId,
                name: benefit.name,
                description: benefit.description,
                requiresActivation: benefit.requiresActivation
            }))
            : [],
        remainingToNext: remainingCents !== null ? money(remainingCents > 0n ? remainingCents : 0n) : null,
        progressPercent: (0, investmentLevelRules_1.levelProgress)(amountCents, currentThresholdCents, nextThresholdCents),
        topLevelReached: Boolean(current) && next === null,
        levels: journey,
        benefits,
        comparison: {
            levels: activeLevels.map((level) => ({
                levelId: level.level_config_id,
                name: level.name,
                levelNumber: level.level_number,
                threshold: String(level.qualification_threshold),
                isCurrent: current?.level_config_id === level.level_config_id
            })),
            benefits: benefits.map((benefit) => ({
                benefitId: benefit.benefitId,
                name: benefit.name,
                description: benefit.description,
                category: benefit.category,
                requiresActivation: benefit.requiresActivation,
                includedInLevelIds: activeLevels
                    .filter((level) => (numberById.get(benefit.applicableLevelId) ?? Number.POSITIVE_INFINITY) <= level.level_number)
                    .map((level) => level.level_config_id),
                availableAtCurrentLevel: current ? benefit.available && benefit.state !== "locked" : false
            }))
        },
        history: history.map((row) => ({
            historyId: row.history_id,
            fromLevelId: row.from_level_id,
            toLevelId: row.to_level_id,
            fromLevelNumber: row.from_level_number,
            toLevelNumber: row.to_level_number,
            fromLevelName: row.from_level_name,
            toLevelName: row.to_level_name,
            qualifyingAmount: String(row.qualifying_amount),
            reason: row.reason,
            source: row.source,
            actorAdminId: row.actor_admin_id,
            createdAt: row.created_at
        }))
    };
}
async function activateInvestmentLevelBenefit(userId, benefitId) {
    const benefit = await InvestmentLevelBenefit_1.InvestmentLevelBenefit.findByPk(benefitId);
    if (!benefit || !benefit.active)
        throw new Error("Benefit not found");
    if (!benefit.available)
        throw new Error("This benefit is not currently deliverable.");
    const level = await InvestmentLevel_1.InvestmentLevel.findByPk(benefit.level_config_id);
    if (!level || !level.active)
        throw new Error("The benefit level is not available.");
    const userLevel = await UserInvestmentLevel_1.UserInvestmentLevel.findByPk(userId);
    const current = userLevel?.level_config_id ? await InvestmentLevel_1.InvestmentLevel.findByPk(userLevel.level_config_id) : null;
    if (!current || current.level_number < level.level_number) {
        throw new Error(`The ${benefit.name} benefit requires ${level.name} or higher.`);
    }
    const [activation, created] = await UserInvestmentLevelBenefit_1.UserInvestmentLevelBenefit.findOrCreate({
        where: { user_id: userId, benefit_id: benefit.benefit_id },
        defaults: { user_id: userId, benefit_id: benefit.benefit_id, note: "Activated by the account holder" }
    });
    if (created) {
        await (0, activityService_1.trackUserActivity)(userId, "configuration_change", {
            scope: "investment_level",
            outcome: "benefit_activated",
            benefitId: benefit.benefit_id,
            benefitCode: benefit.code
        });
    }
    return {
        benefitId: benefit.benefit_id,
        code: benefit.code,
        name: benefit.name,
        requiresActivation: benefit.requires_activation,
        activatedAt: activation.activated_at,
        alreadyActive: !created
    };
}
function requireReason(reason) {
    const trimmed = reason.trim();
    if (trimmed.length < 3)
        throw new Error("A reason of at least 3 characters is required.");
    return trimmed;
}
async function saveInvestmentLevel(adminId, input) {
    const reason = requireReason(input.reason);
    if (input.name.trim().length < 2)
        throw new Error("A level name of at least 2 characters is required.");
    const existing = await InvestmentLevel_1.InvestmentLevel.findAll();
    const target = input.levelId ? existing.find((row) => row.level_config_id === input.levelId) ?? null : null;
    if (input.levelId && !target)
        throw new Error("Investment level not found");
    const preview = existing
        .filter((row) => row.level_config_id !== input.levelId)
        .map(toRange);
    preview.push({
        id: input.levelId || "draft",
        levelNumber: input.levelNumber,
        thresholdCents: (0, money_1.parseDecimal)(input.threshold, 2),
        active: input.active,
        sortOrder: input.sortOrder
    });
    const invalid = (0, investmentLevelRules_1.validateLevelRanges)(preview);
    if (invalid)
        throw new Error(invalid);
    const payload = {
        level_number: input.levelNumber,
        name: input.name.trim(),
        description: input.description,
        qualification_metric: QUALIFICATION_METRIC.code,
        qualification_threshold: (0, money_1.formatDecimal)((0, money_1.parseDecimal)(input.threshold, 2), 2),
        icon: input.icon || `level_${input.levelNumber}`,
        theme: { accent: input.accent || "#C6A15B" },
        sort_order: input.sortOrder,
        active: input.active,
        effective_from: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        updated_at: new Date()
    };
    const previous = target
        ? {
            name: target.name,
            levelNumber: target.level_number,
            threshold: String(target.qualification_threshold),
            active: target.active
        }
        : null;
    const saved = target ? await target.update(payload) : await InvestmentLevel_1.InvestmentLevel.create(payload);
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: target ? "investment_level_updated" : "investment_level_created",
        entity_type: "investment_level",
        entity_id: saved.level_config_id,
        reason,
        metadata: {
            previous,
            current: {
                name: saved.name,
                levelNumber: saved.level_number,
                threshold: String(saved.qualification_threshold),
                active: saved.active
            }
        }
    });
    return saved;
}
async function deactivateInvestmentLevel(adminId, levelId, reason) {
    const trimmed = requireReason(reason);
    const level = await InvestmentLevel_1.InvestmentLevel.findByPk(levelId);
    if (!level)
        throw new Error("Investment level not found");
    const wasActive = level.active;
    level.active = false;
    level.updated_at = new Date();
    await level.save();
    const ranges = (await InvestmentLevel_1.InvestmentLevel.findAll()).map(toRange);
    const invalid = (0, investmentLevelRules_1.validateLevelRanges)(ranges);
    if (invalid) {
        level.active = wasActive;
        await level.save();
        throw new Error(invalid);
    }
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: "investment_level_deactivated",
        entity_type: "investment_level",
        entity_id: levelId,
        reason: trimmed,
        metadata: { previous: { name: level.name, active: wasActive }, current: { active: false } }
    });
}
async function deleteInvestmentLevel(levelId) {
    const [holders, history] = await Promise.all([
        UserInvestmentLevel_1.UserInvestmentLevel.count({ where: { level_config_id: levelId } }),
        InvestmentLevelHistory_1.InvestmentLevelHistory.count({
            where: { [sequelize_1.Op.or]: [{ from_level_id: levelId }, { to_level_id: levelId }] }
        })
    ]);
    if (holders > 0 || history > 0) {
        throw new Error("Level has assigned users or history and cannot be deleted. Deactivate it instead.");
    }
    const benefitCount = await InvestmentLevelBenefit_1.InvestmentLevelBenefit.count({ where: { level_config_id: levelId } });
    if (benefitCount > 0) {
        throw new Error("Remove the level's benefits before deleting it, or deactivate the level instead.");
    }
    const level = await InvestmentLevel_1.InvestmentLevel.findByPk(levelId);
    if (!level)
        throw new Error("Investment level not found");
    await level.destroy();
}
async function saveInvestmentLevelBenefit(adminId, input) {
    const reason = requireReason(input.reason);
    const level = await InvestmentLevel_1.InvestmentLevel.findByPk(input.levelId);
    if (!level)
        throw new Error("Investment level not found");
    const code = input.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (code.length < 3)
        throw new Error("A benefit code of at least 3 characters is required.");
    const duplicate = await InvestmentLevelBenefit_1.InvestmentLevelBenefit.findOne({ where: { code } });
    if (duplicate && duplicate.benefit_id !== input.benefitId) {
        throw new Error("A benefit with this code already exists.");
    }
    const payload = {
        level_config_id: level.level_config_id,
        code,
        name: input.name.trim(),
        description: input.description,
        category: input.category,
        available: input.available,
        requires_activation: input.requiresActivation,
        sort_order: input.sortOrder,
        active: input.active,
        updated_at: new Date()
    };
    const benefit = input.benefitId ? await InvestmentLevelBenefit_1.InvestmentLevelBenefit.findByPk(input.benefitId) : null;
    if (input.benefitId && !benefit)
        throw new Error("Benefit not found");
    const previous = benefit
        ? { name: benefit.name, code: benefit.code, levelId: benefit.level_config_id, available: benefit.available, active: benefit.active }
        : null;
    const saved = benefit ? await benefit.update(payload) : await InvestmentLevelBenefit_1.InvestmentLevelBenefit.create(payload);
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: benefit ? "investment_level_benefit_updated" : "investment_level_benefit_created",
        entity_type: "investment_level_benefit",
        entity_id: saved.benefit_id,
        reason,
        metadata: {
            previous,
            current: { code: saved.code, levelId: saved.level_config_id, available: saved.available, active: saved.active }
        }
    });
    return saved;
}
async function deleteInvestmentLevelBenefit(adminId, benefitId, reason) {
    const trimmed = requireReason(reason);
    const benefit = await InvestmentLevelBenefit_1.InvestmentLevelBenefit.findByPk(benefitId);
    if (!benefit)
        throw new Error("Benefit not found");
    const activations = await UserInvestmentLevelBenefit_1.UserInvestmentLevelBenefit.count({ where: { benefit_id: benefitId } });
    if (activations > 0) {
        benefit.active = false;
        benefit.updated_at = new Date();
        await benefit.save();
    }
    else {
        await benefit.destroy();
    }
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: activations > 0 ? "investment_level_benefit_deactivated" : "investment_level_benefit_deleted",
        entity_type: "investment_level_benefit",
        entity_id: benefitId,
        reason: trimmed,
        metadata: { code: benefit.code, activations }
    });
    return { deactivated: activations > 0 };
}
async function investmentLevelAdminSummary() {
    const [levels, userLevels, benefitRows] = await Promise.all([
        InvestmentLevel_1.InvestmentLevel.findAll({ order: [["level_number", "ASC"]] }),
        UserInvestmentLevel_1.UserInvestmentLevel.findAll(),
        InvestmentLevelBenefit_1.InvestmentLevelBenefit.findAll({ order: [["sort_order", "ASC"]] })
    ]);
    const levelById = new Map(levels.map((level) => [level.level_config_id, level]));
    const distribution = levels.map((level) => ({
        levelId: level.level_config_id,
        name: level.name,
        levelNumber: level.level_number,
        active: level.active,
        threshold: String(level.qualification_threshold),
        description: level.description,
        icon: level.icon,
        theme: level.theme,
        sortOrder: level.sort_order,
        effectiveFrom: level.effective_from,
        users: userLevels.filter((row) => row.level_config_id === level.level_config_id).length,
        benefits: benefitRows
            .filter((benefit) => benefit.level_config_id === level.level_config_id)
            .map((benefit) => ({
            benefitId: benefit.benefit_id,
            code: benefit.code,
            name: benefit.name,
            description: benefit.description,
            category: benefit.category,
            available: benefit.available,
            requiresActivation: benefit.requires_activation,
            active: benefit.active,
            sortOrder: benefit.sort_order
        }))
    }));
    const approaching = [];
    for (const row of userLevels) {
        if (!row.level_config_id)
            continue;
        const current = levelById.get(row.level_config_id) ?? null;
        if (!current)
            continue;
        const next = levels
            .filter((level) => level.active && level.level_number > current.level_number)
            .sort((a, b) => a.level_number - b.level_number)[0] ?? null;
        if (!next)
            continue;
        const amountCents = (0, money_1.parseDecimal)(String(row.qualifying_amount), 2);
        const nextThreshold = (0, money_1.parseDecimal)(String(next.qualification_threshold), 2);
        if (!(0, investmentLevelRules_1.isApproachingNextLevel)(amountCents, nextThreshold))
            continue;
        const user = await User_1.User.findByPk(row.user_id);
        approaching.push({
            userId: row.user_id,
            email: user?.email ?? "",
            currentLevel: current.name,
            nextLevel: next.name,
            remaining: (0, money_1.formatDecimal)(nextThreshold - amountCents, 2)
        });
    }
    const overrides = userLevels
        .filter((row) => row.manual_level_id)
        .map((row) => ({
        userId: row.user_id,
        levelId: row.manual_level_id,
        levelName: row.manual_level_id ? levelById.get(row.manual_level_id)?.name ?? null : null,
        reason: row.manual_reason,
        setAt: row.manual_set_at,
        qualifyingAmount: String(row.qualifying_amount)
    }));
    const historyRows = await InvestmentLevelHistory_1.InvestmentLevelHistory.findAll({ order: [["created_at", "DESC"]], limit: 60 });
    const history = historyRows.map((row) => ({
        historyId: row.history_id,
        userId: row.user_id,
        fromLevelId: row.from_level_id,
        toLevelId: row.to_level_id,
        fromLevelNumber: row.from_level_number,
        toLevelNumber: row.to_level_number,
        fromLevelName: row.from_level_name,
        toLevelName: row.to_level_name,
        qualifyingAmount: String(row.qualifying_amount),
        reason: row.reason,
        source: row.source,
        actorAdminId: row.actor_admin_id,
        createdAt: row.created_at
    }));
    return {
        rules: INVESTMENT_LEVEL_RULES,
        metric: QUALIFICATION_METRIC,
        distribution,
        approaching,
        overrides,
        history,
        benefits: benefitRows.map((benefit) => ({
            benefitId: benefit.benefit_id,
            levelId: benefit.level_config_id,
            code: benefit.code,
            name: benefit.name,
            description: benefit.description,
            category: benefit.category,
            available: benefit.available,
            requiresActivation: benefit.requires_activation,
            sortOrder: benefit.sort_order,
            active: benefit.active
        }))
    };
}
async function investmentLevelAdminUsers(query) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const levels = await InvestmentLevel_1.InvestmentLevel.findAll({ order: [["level_number", "ASC"]] });
    const levelById = new Map(levels.map((level) => [level.level_config_id, level]));
    const where = {};
    const q = String(query.q || "").trim();
    if (q) {
        where[sequelize_1.Op.or] = [
            { email: { [sequelize_1.Op.iLike]: `%${q}%` } },
            { name: { [sequelize_1.Op.iLike]: `%${q}%` } },
            { user_id: q }
        ];
    }
    const levelFilter = String(query.levelId || "");
    if (levelFilter) {
        const holders = await UserInvestmentLevel_1.UserInvestmentLevel.findAll({
            where: { level_config_id: levelFilter },
            attributes: ["user_id"]
        });
        where.user_id = { [sequelize_1.Op.in]: holders.map((holder) => holder.user_id) };
    }
    const statusFilter = String(query.status || "");
    const build = async (rows) => {
        const mapped = [];
        for (const user of rows) {
            const record = await UserInvestmentLevel_1.UserInvestmentLevel.findByPk(user.user_id);
            const level = record?.level_config_id ? levelById.get(record.level_config_id) ?? null : null;
            mapped.push({
                userId: user.user_id,
                name: user.name,
                email: user.email,
                levelId: level?.level_config_id ?? null,
                levelName: level?.name ?? null,
                levelNumber: level?.level_number ?? null,
                qualifyingAmount: record ? String(record.qualifying_amount) : "0.00",
                achievedAt: record?.achieved_at ?? null,
                status: level ? (record?.manual_level_id ? "manual_review" : "active") : "unqualified",
                manualReason: record?.manual_reason ?? null,
                reason: record?.reason ?? null
            });
        }
        return mapped;
    };
    const levelOptions = levels.map((level) => ({
        levelId: level.level_config_id,
        name: level.name,
        levelNumber: level.level_number,
        active: level.active
    }));
    if (statusFilter) {
        const all = await User_1.User.findAll({ where, order: [["created_at", "DESC"]] });
        const mapped = await build(all);
        const filtered = mapped.filter((row) => row.status === statusFilter);
        return {
            page,
            pageSize,
            total: filtered.length,
            users: filtered.slice(offset, offset + pageSize),
            levels: levelOptions
        };
    }
    const { rows, count } = await User_1.User.findAndCountAll({
        where,
        limit: pageSize,
        offset,
        order: [["created_at", "DESC"]]
    });
    return {
        page,
        pageSize,
        total: count,
        users: await build(rows),
        levels: levelOptions
    };
}
async function adminAdjustInvestmentLevel(adminId, userId, levelId, reason) {
    const trimmed = requireReason(reason);
    const user = await User_1.User.findByPk(userId);
    if (!user)
        throw new Error("User not found");
    const levels = await InvestmentLevel_1.InvestmentLevel.findAll();
    const target = levelId ? levels.find((level) => level.level_config_id === levelId) ?? null : null;
    if (levelId && !target)
        throw new Error("Investment level not found");
    const result = await database_1.sequelize.transaction(async (transaction) => {
        const record = await UserInvestmentLevel_1.UserInvestmentLevel.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        const fromLevel = record?.level_config_id
            ? levels.find((level) => level.level_config_id === record.level_config_id) ?? null
            : null;
        if (record &&
            record.manual_level_id === (target?.level_config_id ?? null) &&
            record.manual_reason === trimmed) {
            return { changed: false, qualifyingAmount: String(record.qualifying_amount) };
        }
        const now = new Date();
        const qualifyingAmount = record ? String(record.qualifying_amount) : "0.00";
        if (!record) {
            await UserInvestmentLevel_1.UserInvestmentLevel.create({
                user_id: userId,
                level_config_id: target?.level_config_id ?? null,
                qualifying_amount: qualifyingAmount,
                achieved_at: now,
                reason: trimmed,
                manual_level_id: target?.level_config_id ?? null,
                manual_reason: trimmed,
                manual_set_at: now
            }, { transaction });
        }
        else {
            record.level_config_id = target?.level_config_id ?? null;
            record.manual_level_id = target?.level_config_id ?? null;
            record.manual_reason = trimmed;
            record.manual_set_at = now;
            record.achieved_at = now;
            record.reason = trimmed;
            record.updated_at = now;
            await record.save({ transaction });
        }
        await recordTransition({
            userId,
            from: fromLevel,
            to: target,
            amount: qualifyingAmount,
            reason: trimmed,
            source: "admin",
            actorAdminId: adminId,
            transaction
        });
        await AdminAuditLog_1.AdminAuditLog.create({
            admin_id: adminId,
            action: "investment_level_adjusted",
            entity_type: "user_investment_level",
            entity_id: userId,
            reason: trimmed,
            metadata: {
                fromLevelId: fromLevel?.level_config_id ?? null,
                fromLevelName: fromLevel?.name ?? null,
                toLevelId: target?.level_config_id ?? null,
                toLevelName: target?.name ?? null
            }
        }, { transaction });
        return { changed: true, qualifyingAmount };
    });
    if (result.changed) {
        await Notification_1.Notification.create({
            type: "investment_level_status",
            message: clip(`The platform reviewed your investment level. Your level is now ${target?.name ?? "unassigned"}. Recorded reason: ${trimmed}`),
            user_id: userId
        });
        await (0, activityService_1.trackUserActivity)(userId, "configuration_change", {
            scope: "investment_level",
            outcome: "admin_adjustment",
            toLevelId: target?.level_config_id ?? null
        });
        await (0, activityService_1.trackUserActivity)(adminId, "admin_action", {
            action: "investment_level_adjusted",
            targetUserId: userId,
            toLevelId: target?.level_config_id ?? null
        });
    }
    return result;
}
async function clearInvestmentLevelOverride(adminId, userId, reason) {
    const trimmed = requireReason(reason);
    const levels = await InvestmentLevel_1.InvestmentLevel.findAll();
    const result = await database_1.sequelize.transaction(async (transaction) => {
        const record = await UserInvestmentLevel_1.UserInvestmentLevel.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!record)
            throw new Error("Investment level record not found");
        if (!record.manual_level_id)
            return { changed: false };
        const fromLevel = levels.find((level) => level.level_config_id === record.manual_level_id) ?? null;
        record.manual_level_id = null;
        record.manual_reason = null;
        record.manual_set_at = null;
        record.updated_at = new Date();
        await record.save({ transaction });
        await recordTransition({
            userId,
            from: fromLevel,
            to: null,
            amount: String(record.qualifying_amount),
            reason: trimmed,
            source: "admin",
            actorAdminId: adminId,
            transaction
        });
        await AdminAuditLog_1.AdminAuditLog.create({
            admin_id: adminId,
            action: "investment_level_override_cleared",
            entity_type: "user_investment_level",
            entity_id: userId,
            reason: trimmed,
            metadata: { fromLevelId: fromLevel?.level_config_id ?? null, fromLevelName: fromLevel?.name ?? null }
        }, { transaction });
        return { changed: true };
    });
    if (result.changed) {
        await syncUserInvestmentLevel(userId, "Platform cleared the manual investment level exception");
        await Notification_1.Notification.create({
            type: "investment_level_status",
            message: clip(`The platform cleared the manual investment level exception on your account. Your level is now recalculated from approved, verified invested principal. Reason: ${trimmed}`),
            user_id: userId
        });
        await (0, activityService_1.trackUserActivity)(adminId, "admin_action", {
            action: "investment_level_override_cleared",
            targetUserId: userId
        });
    }
    return result;
}
async function recalculateUserInvestmentLevel(adminId, userId, reason) {
    const trimmed = requireReason(reason);
    const user = await User_1.User.findByPk(userId);
    if (!user)
        throw new Error("User not found");
    const before = await UserInvestmentLevel_1.UserInvestmentLevel.findByPk(userId);
    const beforeLevelId = before?.level_config_id ?? null;
    const beforeAmount = before ? String(before.qualifying_amount) : "0.00";
    await syncUserInvestmentLevel(userId, `Recalculated by the platform: ${trimmed}`);
    const after = await UserInvestmentLevel_1.UserInvestmentLevel.findByPk(userId);
    const afterLevelId = after?.level_config_id ?? null;
    const afterAmount = after ? String(after.qualifying_amount) : "0.00";
    const changed = beforeLevelId !== afterLevelId || beforeAmount !== afterAmount;
    await AdminAuditLog_1.AdminAuditLog.create({
        admin_id: adminId,
        action: "investment_level_recalculated",
        entity_type: "user_investment_level",
        entity_id: userId,
        reason: trimmed,
        metadata: {
            previous: { levelId: beforeLevelId, qualifyingAmount: beforeAmount },
            current: { levelId: afterLevelId, qualifyingAmount: afterAmount },
            changed
        }
    });
    await (0, activityService_1.trackUserActivity)(adminId, "admin_action", {
        action: "investment_level_recalculated",
        targetUserId: userId,
        changed
    });
    return { changed, qualifyingAmount: afterAmount, levelId: afterLevelId };
}
