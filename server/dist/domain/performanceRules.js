"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDailyPerformance = calculateDailyPerformance;
exports.ledgerBalances = ledgerBalances;
exports.canDistribute = canDistribute;
exports.computeDailyRoi = computeDailyRoi;
exports.netProfitCents = netProfitCents;
exports.chainDailyReturns = chainDailyReturns;
exports.capitalWeightedReturn = capitalWeightedReturn;
exports.buildDailyPerformanceHistory = buildDailyPerformanceHistory;
exports.sumVerifiedPerformance = sumVerifiedPerformance;
const money_1 = require("./money");
function calculateDailyPerformance(input) {
    const adjustedOpening = input.openingCents + input.cashFlowCents;
    if (!input.verified || input.closingCents === null) {
        return {
            status: "unavailable",
            profitCents: null,
            roiPercent: null,
            adjustedOpeningCents: adjustedOpening
        };
    }
    const profit = input.closingCents - adjustedOpening;
    if (adjustedOpening === 0n) {
        return {
            status: "unavailable",
            profitCents: profit,
            roiPercent: null,
            adjustedOpeningCents: adjustedOpening
        };
    }
    const scaled = (profit * 100000000n) / adjustedOpening;
    const negative = scaled < 0n;
    const absolute = negative ? -scaled : scaled;
    const whole = absolute / 1000000n;
    const fraction = (absolute % 1000000n).toString().padStart(6, "0");
    return {
        status: "verified",
        profitCents: profit,
        roiPercent: `${negative ? "-" : ""}${whole.toString()}.${fraction}`,
        adjustedOpeningCents: adjustedOpening
    };
}
function ledgerBalances(lines) {
    const balances = {};
    for (const line of lines) {
        const current = balances[line.account] ?? 0n;
        balances[line.account] = line.direction === "credit" ? current + line.amountCents : current - line.amountCents;
    }
    return balances;
}
function canDistribute(unrealizedCents, realizedCents) {
    return unrealizedCents > 0n ? false : realizedCents > 0n;
}
function formatPercentScaled(percentScaled) {
    const negative = percentScaled < 0n;
    const absolute = negative ? -percentScaled : percentScaled;
    const whole = absolute / 1000000n;
    const fraction = (absolute % 1000000n).toString().padStart(6, "0");
    return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}
function computeDailyRoi(profitCents, adjustedOpeningCents) {
    if (adjustedOpeningCents === 0n)
        return null;
    const scaled = (profitCents * 100000000n) / adjustedOpeningCents;
    return formatPercentScaled(scaled);
}
function netProfitCents(openingCents, closingCents, externalFlowCents) {
    return closingCents - (openingCents + externalFlowCents);
}
function chainDailyReturns(rois) {
    const present = rois.filter((roi) => typeof roi === "string" && roi.length > 0);
    if (present.length === 0)
        return null;
    let factor = 1000000n;
    for (const roi of present) {
        const roiScaled = (0, money_1.parseDecimal)(roi, 6);
        const growth = 1000000n + roiScaled / 100n;
        factor = (factor * growth) / 1000000n;
    }
    const percentScaled = (factor - 1000000n) * 100n;
    return formatPercentScaled(percentScaled);
}
function capitalWeightedReturn(totalProfitCents, averageCapitalCents) {
    return computeDailyRoi(totalProfitCents, averageCapitalCents);
}
function buildDailyPerformanceHistory(entries) {
    const byDate = new Map();
    const ordered = [...entries].sort((left, right) => left.date.localeCompare(right.date));
    for (const entry of ordered) {
        const existing = byDate.get(entry.date);
        if (!existing) {
            byDate.set(entry.date, {
                date: entry.date,
                openingValue: (0, money_1.formatDecimal)(entry.openingCents, 8),
                closingValue: entry.closingCents === null ? null : (0, money_1.formatDecimal)(entry.closingCents, 8),
                externalContributions: (0, money_1.formatDecimal)(entry.externalContributionCents, 8),
                externalWithdrawals: (0, money_1.formatDecimal)(entry.externalWithdrawalCents, 8),
                realizedProfitLoss: (0, money_1.formatDecimal)(entry.realizedCents, 8),
                unrealizedProfitLoss: entry.unrealizedCents === null ? null : (0, money_1.formatDecimal)(entry.unrealizedCents, 8),
                feesAndAdjustments: (0, money_1.formatDecimal)(entry.feeCents, 8),
                netProfitLoss: entry.netProfitCents === null ? null : (0, money_1.formatDecimal)(entry.netProfitCents, 8),
                roiPercent: entry.roiPercent,
                status: entry.verified ? "verified" : "unavailable",
                methodology: entry.methodology,
                source: entry.source
            });
            continue;
        }
        const opening = (0, money_1.parseDecimal)(existing.openingValue, 8) + entry.openingCents;
        const closing = existing.closingValue === null || entry.closingCents === null
            ? null
            : (0, money_1.parseDecimal)(existing.closingValue, 8) + entry.closingCents;
        const contributions = (0, money_1.parseDecimal)(existing.externalContributions, 8) + entry.externalContributionCents;
        const withdrawals = (0, money_1.parseDecimal)(existing.externalWithdrawals, 8) + entry.externalWithdrawalCents;
        const realized = (0, money_1.parseDecimal)(existing.realizedProfitLoss, 8) + entry.realizedCents;
        const unrealized = existing.unrealizedProfitLoss === null || entry.unrealizedCents === null
            ? null
            : (0, money_1.parseDecimal)(existing.unrealizedProfitLoss, 8) + entry.unrealizedCents;
        const fees = (0, money_1.parseDecimal)(existing.feesAndAdjustments, 8) + entry.feeCents;
        const profit = existing.netProfitLoss === null || entry.netProfitCents === null
            ? null
            : (0, money_1.parseDecimal)(existing.netProfitLoss, 8) + entry.netProfitCents;
        existing.openingValue = (0, money_1.formatDecimal)(opening, 8);
        existing.closingValue = closing === null ? null : (0, money_1.formatDecimal)(closing, 8);
        existing.externalContributions = (0, money_1.formatDecimal)(contributions, 8);
        existing.externalWithdrawals = (0, money_1.formatDecimal)(withdrawals, 8);
        existing.realizedProfitLoss = (0, money_1.formatDecimal)(realized, 8);
        existing.unrealizedProfitLoss = unrealized === null ? null : (0, money_1.formatDecimal)(unrealized, 8);
        existing.feesAndAdjustments = (0, money_1.formatDecimal)(fees, 8);
        existing.netProfitLoss = profit === null ? null : (0, money_1.formatDecimal)(profit, 8);
        existing.status = existing.status === "verified" && entry.verified ? "verified" : "unavailable";
        if (existing.status === "verified" && profit !== null) {
            existing.roiPercent = computeDailyRoi(profit, opening + (contributions - withdrawals));
        }
        else {
            existing.roiPercent = null;
        }
    }
    return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}
function sumVerifiedPerformance(profits, principalCents) {
    const present = profits.filter((profit) => profit !== null);
    if (present.length === 0) {
        return { status: "unavailable", profitCents: null, roiPercent: null };
    }
    const profit = present.reduce((total, value) => total + value, 0n);
    if (principalCents <= 0n) {
        return { status: "verified", profitCents: profit, roiPercent: null };
    }
    const scaled = (profit * 100000000n) / principalCents;
    const negative = scaled < 0n;
    const absolute = negative ? -scaled : scaled;
    const whole = absolute / 1000000n;
    const fraction = (absolute % 1000000n).toString().padStart(6, "0");
    return {
        status: "verified",
        profitCents: profit,
        roiPercent: `${negative ? "-" : ""}${whole.toString()}.${fraction}`
    };
}
