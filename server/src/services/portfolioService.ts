import { Op } from "sequelize";
import {
  buildPortfolioHoldings,
  computeAllocation,
  type PortfolioAllocationSlice,
  type PortfolioHolding
} from "../domain/portfolioRules";
import { Deposit } from "../models/Deposit";
import { User } from "../models/User";
import { Notification } from "../models/Notification";
import { getAllMarketPrices } from "./marketDataService";
import { getUserProgression } from "./gamificationService";
import { calculateDepositLevelForUser } from "./depositLevelService";
import { userPerformance } from "./financialOperationsService";

type PortfolioSymbol = "BTC" | "ETH" | "SOL" | "USDT";

interface AssetSummary {
  symbol: PortfolioSymbol;
  totalDeposited: number;
  currentValue: number;
}

interface GrowthPoint {
  date: string;
  deposited: number;
  value: number;
}

export async function getPortfolioSummary(userId: string): Promise<{
  assets: AssetSummary[];
  totalCurrentValue: number;
  pendingEarnings: number;
  totalPlatformBalance: number;
  growthSeries: GrowthPoint[];
  projectedEarnings: {
    currentMultiplier: number;
    projectedValue: number;
  };
}> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const [prices, userDeposits, allDeposits] = await Promise.all([
    getAllMarketPrices(),
    Deposit.findAll({
      where: { user_id: userId, status: "Approved" },
      order: [["timestamp", "ASC"]]
    }),
    Deposit.findAll({
      where: { status: "Approved" }
    })
  ]);

  const assetMap = new Map<PortfolioSymbol, AssetSummary>();

  function mapSymbol(cryptoType: string): PortfolioSymbol | null {
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
  const totalCurrentValue = assets.reduce(
    (sum, a) => sum + a.currentValue,
    0
  );

  const pending =
    (user.pending_earnings as any)?.total !== undefined
      ? Number((user.pending_earnings as any).total)
      : 0;

  const totalPlatformBalance = allDeposits.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  const growthSeries: GrowthPoint[] = [];
  const byDate = new Map<
    string,
    {
      deposited: number;
      value: number;
    }
  >();

  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentDeposits = userDeposits.filter(
    (d) => (d.timestamp || d.get("timestamp")) >= startDate
  );

  for (const d of recentDeposits) {
    const symbol = mapSymbol(d.crypto_type);
    if (!symbol) {
      continue;
    }
    const ts = d.timestamp || (d.get("timestamp") as Date);
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
    const entry = byDate.get(date)!;
    cumulativeDeposited += entry.deposited;
    cumulativeValue += entry.value;
    growthSeries.push({
      date,
      deposited: cumulativeDeposited,
      value: cumulativeValue
    });
  }

  const progression = await getUserProgression(user);
  const currentMultiplier = progression.multiplierPreview.totalMultiplier;
  const projectedValue = totalCurrentValue * currentMultiplier;

  const seen = ((user.seen_notifications as any) || {}) as {
    portfolioMilestones?: number[];
  };
  const milestones = [1000, 5000, 10000];
  const unlocked: number[] = seen.portfolioMilestones || [];

  const newlyReached = milestones.filter(
    (m) => totalCurrentValue >= m && !unlocked.includes(m)
  );

  if (newlyReached.length > 0) {
    const updated = {
      ...seen,
      portfolioMilestones: [...unlocked, ...newlyReached]
    };
    user.seen_notifications = updated;
    await user.save();

    await Promise.all(
      newlyReached.map((m) =>
        Notification.create({
          type: "portfolio_milestone",
          message: `Your portfolio crossed $${m.toLocaleString()}`,
          user_id: user.user_id
        })
      )
    );
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

export interface PortfolioTotals {
  totalValue: number;
  investedPrincipal: number;
  availableBalance: number;
  lockedBalance: number;
  pendingEarnings: number;
  realizedEarnings: number;
  unrealizedProfitLoss: number | null;
  unrealizedRoiPercent: number | null;
}

export interface PortfolioOverview {
  currency: "USD";
  updatedAt: string;
  totals: PortfolioTotals;
  holdings: PortfolioHolding[];
  allocation: PortfolioAllocationSlice[];
  performance: Awaited<ReturnType<typeof userPerformance>> & { range: string };
}

export async function getPortfolioOverview(
  userId: string,
  range: string
): Promise<PortfolioOverview> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const [summary, prices, progression, depositLevel, performance] = await Promise.all([
    getPortfolioSummary(userId),
    getAllMarketPrices(),
    getUserProgression(user),
    calculateDepositLevelForUser(userId),
    userPerformance(userId, range)
  ]);

  const priceMap: Record<string, number> = {};
  (Object.keys(prices) as Array<keyof typeof prices>).forEach((symbol) => {
    const point = prices[symbol];
    if (point && Number.isFinite(point.price)) {
      priceMap[symbol] = point.price;
    }
  });

  const holdings = buildPortfolioHoldings(summary.assets, priceMap);
  const allocation = computeAllocation(holdings);

  const realizedEarnings = Number(performance.realizedEarnings);
  const unrealizedAvailable =
    performance.cumulative.status === "verified" && performance.cumulative.profitLoss !== null;

  return {
    currency: "USD",
    updatedAt: new Date().toISOString(),
    totals: {
      totalValue: summary.totalCurrentValue,
      investedPrincipal: depositLevel.totalDepositedUsd,
      availableBalance: progression.withdrawableBalance ?? 0,
      lockedBalance: progression.lockedBalance ?? 0,
      pendingEarnings: progression.pendingEarningsTotal ?? summary.pendingEarnings,
      realizedEarnings: Number.isFinite(realizedEarnings) ? realizedEarnings : 0,
      unrealizedProfitLoss: unrealizedAvailable
        ? Number(performance.cumulative.profitLoss)
        : null,
      unrealizedRoiPercent:
        unrealizedAvailable && performance.cumulative.roiPercent !== null
          ? Number(performance.cumulative.roiPercent)
          : null
    },
    holdings,
    allocation,
    performance: {
      ...performance,
      range
    }
  };
}

