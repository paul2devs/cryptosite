"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPortfolioSummary = getPortfolioSummary;
const Deposit_1 = require("../models/Deposit");
const User_1 = require("../models/User");
const Notification_1 = require("../models/Notification");
const marketDataService_1 = require("./marketDataService");
const gamificationService_1 = require("./gamificationService");
async function getPortfolioSummary(userId) {
    const user = await User_1.User.findByPk(userId);
    if (!user) {
        throw new Error("User not found");
    }
    const [prices, userDeposits, allDeposits] = await Promise.all([
        (0, marketDataService_1.getAllMarketPrices)(),
        Deposit_1.Deposit.findAll({
            where: { user_id: userId, status: "Approved" },
            order: [["timestamp", "ASC"]]
        }),
        Deposit_1.Deposit.findAll({
            where: { status: "Approved" }
        })
    ]);
    const assetMap = new Map();
    function mapSymbol(cryptoType) {
        if (cryptoType === "BTC" || cryptoType === "ETH" || cryptoType === "SOL") {
            return cryptoType;
        }
        if (cryptoType === "ERC20" || cryptoType === "TRC20" || cryptoType === "USDT") {
            return "USDT";
        }
        return null;
    }
    for (const d of userDeposits) {
        const symbol = mapSymbol(d.crypto_type);
        if (!symbol) {
            continue;
        }
        const pricePoint = prices[symbol];
        const price = pricePoint ? pricePoint.price : 0;
        const existing = assetMap.get(symbol) || {
            symbol,
            totalDeposited: 0,
            currentValue: 0
        };
        existing.totalDeposited += d.amount;
        existing.currentValue += d.amount * price;
        assetMap.set(symbol, existing);
    }
    const assets = Array.from(assetMap.values());
    const totalCurrentValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
    const pending = user.pending_earnings?.total !== undefined
        ? Number(user.pending_earnings.total)
        : 0;
    const totalPlatformBalance = allDeposits.reduce((sum, d) => sum + d.amount, 0);
    const growthSeries = [];
    const byDate = new Map();
    const now = new Date();
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentDeposits = userDeposits.filter((d) => (d.timestamp || d.get("timestamp")) >= startDate);
    for (const d of recentDeposits) {
        const symbol = mapSymbol(d.crypto_type);
        if (!symbol) {
            continue;
        }
        const ts = d.timestamp || d.get("timestamp");
        const dateKey = ts.toISOString().slice(0, 10);
        const pricePoint = prices[symbol];
        const price = pricePoint ? pricePoint.price : 0;
        const existing = byDate.get(dateKey) || { deposited: 0, value: 0 };
        existing.deposited += d.amount;
        existing.value += d.amount * price;
        byDate.set(dateKey, existing);
    }
    const sortedDates = Array.from(byDate.keys()).sort();
    let cumulativeDeposited = 0;
    let cumulativeValue = 0;
    for (const date of sortedDates) {
        const entry = byDate.get(date);
        cumulativeDeposited += entry.deposited;
        cumulativeValue += entry.value;
        growthSeries.push({
            date,
            deposited: cumulativeDeposited,
            value: cumulativeValue
        });
    }
    const progression = await (0, gamificationService_1.getUserProgression)(user);
    const currentMultiplier = progression.multiplierPreview.totalMultiplier;
    const projectedValue = totalCurrentValue * currentMultiplier;
    const seen = (user.seen_notifications || {});
    const milestones = [1000, 5000, 10000];
    const unlocked = seen.portfolioMilestones || [];
    const newlyReached = milestones.filter((m) => totalCurrentValue >= m && !unlocked.includes(m));
    if (newlyReached.length > 0) {
        const updated = {
            ...seen,
            portfolioMilestones: [...unlocked, ...newlyReached]
        };
        user.seen_notifications = updated;
        await user.save();
        await Promise.all(newlyReached.map((m) => Notification_1.Notification.create({
            type: "portfolio_milestone",
            message: `Your portfolio crossed $${m.toLocaleString()}`,
            user_id: user.user_id
        })));
    }
    return {
        assets,
        totalCurrentValue,
        pendingEarnings: pending,
        totalPlatformBalance,
        growthSeries,
        projectedEarnings: {
            currentMultiplier,
            projectedValue
        }
    };
}
