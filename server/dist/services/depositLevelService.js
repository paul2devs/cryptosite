"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDepositLevelDetailsFromTotal = getDepositLevelDetailsFromTotal;
exports.calculateDepositLevelForUser = calculateDepositLevelForUser;
exports.refreshUserDepositLevel = refreshUserDepositLevel;
const Deposit_1 = require("../models/Deposit");
const marketDataService_1 = require("./marketDataService");
const LEVEL_THRESHOLDS = [
    { level: 1, requiredTotal: 1000 },
    { level: 2, requiredTotal: 3000 },
    { level: 3, requiredTotal: 5000 },
    { level: 4, requiredTotal: 7000 },
    { level: 5, requiredTotal: 10000 },
    { level: 6, requiredTotal: 12000 },
    { level: 7, requiredTotal: 15000 },
    { level: 8, requiredTotal: 18000 },
    { level: 9, requiredTotal: 22000 },
    { level: 10, requiredTotal: 25000 }
];
function mapCryptoTypeToSymbol(cryptoType) {
    if (cryptoType === "BTC" || cryptoType === "ETH" || cryptoType === "SOL") {
        return cryptoType;
    }
    if (cryptoType === "ERC20" || cryptoType === "TRC20") {
        return "USDT";
    }
    return null;
}
function getDepositLevelDetailsFromTotal(totalUsd) {
    let level = 0;
    let currentLevelRequiredTotal = 0;
    let nextLevel = null;
    let nextLevelRequiredTotal = null;
    for (const entry of LEVEL_THRESHOLDS) {
        if (totalUsd >= entry.requiredTotal) {
            level = entry.level;
            currentLevelRequiredTotal = entry.requiredTotal;
        }
        else {
            nextLevel = entry.level;
            nextLevelRequiredTotal = entry.requiredTotal;
            break;
        }
    }
    let remainingToNext = null;
    if (nextLevelRequiredTotal !== null) {
        const diff = nextLevelRequiredTotal - totalUsd;
        remainingToNext = diff > 0 ? diff : 0;
    }
    return {
        totalDepositedUsd: totalUsd,
        level,
        currentLevelRequiredTotal,
        nextLevel,
        nextLevelRequiredTotal,
        remainingToNext
    };
}
async function calculateDepositLevelForUser(userId) {
    const [deposits, prices] = await Promise.all([
        Deposit_1.Deposit.findAll({
            where: {
                user_id: userId,
                status: "Approved"
            }
        }),
        (0, marketDataService_1.getAllMarketPrices)()
    ]);
    let totalUsd = 0;
    for (const deposit of deposits) {
        const symbol = mapCryptoTypeToSymbol(deposit.crypto_type);
        if (!symbol) {
            continue;
        }
        const pricePoint = prices[symbol];
        if (!pricePoint || !Number.isFinite(pricePoint.price)) {
            continue;
        }
        totalUsd += deposit.amount * pricePoint.price;
    }
    return getDepositLevelDetailsFromTotal(totalUsd);
}
async function refreshUserDepositLevel(user) {
    const stats = await calculateDepositLevelForUser(user.user_id);
    user.level = stats.level;
    await user.save();
    return stats;
}
