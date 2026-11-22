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
import { userPerformance } from "./financialOperationsService";
import { portfolioValuation } from "./performanceService";

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

export async function getPortfolioSummary(
  userId: string,
  performanceOverride?: Awaited<ReturnType<typeof userPerformance>>
): Promise<{
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

  const [prices, userDeposits, allDeposits, performance] = await Promise.all([
    getAllMarketPrices(),
    Deposit.findAll({
      where: { user_id: userId, status: "Approved" },
      order: [["timestamp", "ASC"]]
    }),
    Deposit.findAll({
      where: { status: "Approved" }
    }),
    performanceOverride
      ? Promise.resolve(performanceOverride)
      : userPerformance(userId, "30d")
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

  // Total portfolio value is the authoritative investment valuation: the
  // principal allocated to active positions plus the earnings those positions
  // have accrued. It is never derived from live market prices, and accrued
  // (pending) earnings are reflected the moment they are written to a position.
  const valuation = portfolioValuation(performance.metrics);
  const totalCurrentValue = toNumberOrNull(valuation.totalValue) ?? 0;
  // The accrued-but-unsettled figure, so a distributed (settled) earning is
  // never also reported here as still pending.
  const pending = toNumberOrNull(valuation.pendingEarnings) ?? 0;

  const totalPlatformBalance = allDeposits.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  // Build the growth series from genuine stored valuation snapshots so the
  // chart reflects what was actually recorded, never a value re-derived from
  // today's market prices.
  const growthSeries: GrowthPoint[] = [];
  let cumulativeDeposited = 0;
  for (const point of performance.chart.points) {
    if (point.portfolioValue === null) continue;
    const value = Number(point.portfolioValue);
    if (!Number.isFinite(value)) continue;
    cumulativeDeposited += Number(point.externalFlow ?? 0);
    growthSeries.push({
      date: point.date,
      deposited: cumulativeDeposited,
      value
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
  todayProfitLoss: number | null;
  todayRoiPercent: number | null;
  overallReturnPercent: number | null;
  periodReturnPercent: number | null;
}

function toNumberOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

  const [prices, progression, performance] = await Promise.all([
    getAllMarketPrices(),
    getUserProgression(user),
    userPerformance(userId, range)
  ]);
  const summary = await getPortfolioSummary(userId, performance);

  const priceMap: Record<string, number> = {};
  (Object.keys(prices) as Array<keyof typeof prices>).forEach((symbol) => {
    const point = prices[symbol];
    if (point && Number.isFinite(point.price)) {
      priceMap[symbol] = point.price;
    }
  });

  const holdings = buildPortfolioHoldings(summary.assets, priceMap);
  const allocation = computeAllocation(holdings);

  // Portfolio totals are derived from the single authoritative valuation so the
  // Dashboard, Portfolio and Performance sections can never disagree. Principal
  // and current value come from verified investment positions (deposits sitting
  // in the available wallet are never counted as invested), accrued earnings are
  // included as pending the moment they accrue, and realised/unrealised profit is
  // taken straight from the verified performance history rather than re-derived
  // from market prices.
  const valuation = portfolioValuation(performance.metrics);
  const metrics = performance.metrics;

  return {
    currency: "USD",
    updatedAt: new Date().toISOString(),
    totals: {
      totalValue: toNumberOrNull(valuation.totalValue) ?? 0,
      investedPrincipal: toNumberOrNull(valuation.investedPrincipal) ?? 0,
      availableBalance: progression.withdrawableBalance ?? 0,
      lockedBalance: progression.lockedBalance ?? 0,
      pendingEarnings: toNumberOrNull(valuation.pendingEarnings) ?? summary.pendingEarnings,
      realizedEarnings: toNumberOrNull(valuation.settledEarnings) ?? 0,
      unrealizedProfitLoss: toNumberOrNull(metrics.totalUnrealizedProfitLoss),
      unrealizedRoiPercent: toNumberOrNull(metrics.overallReturnPercent),
      todayProfitLoss: toNumberOrNull(metrics.todayProfitLoss),
      todayRoiPercent: toNumberOrNull(metrics.todayRoiPercent),
      overallReturnPercent: toNumberOrNull(metrics.overallReturnPercent),
      periodReturnPercent: toNumberOrNull(metrics.periodReturnPercent)
    },
    holdings,
    allocation,
    performance: {
      ...performance,
      range
    }
  };
}

