import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import { fetchUserTransactions, TransactionRecord } from "../utils/transactions";

export type PerformanceRange = "24h" | "7d" | "30d" | "90d" | "1y" | "all";

export interface ProgressionLevelInfo {
  level_id: number;
  level_name: string;
  required_xp: number;
  multiplier_base: number;
}

export interface ProgressionResponse {
  level: number;
  xp: number;
  currentLevel: ProgressionLevelInfo;
  nextLevel: ProgressionLevelInfo | null;
  xpToNext: number | null;
  multiplierPreview: {
    baseMultiplier: number;
    streakBonus: number;
    timeBonus: number;
    referralBonus: number;
    totalMultiplier: number;
  };
  pendingEarningsTotal: number;
  streak: number;
  withdrawableBalance: number;
  lockedBalance: number;
  depositLevel: number;
  totalDepositedUsd: number;
  depositCurrentLevelRequiredTotal: number;
  depositNextLevel: number | null;
  depositNextLevelRequiredTotal: number | null;
  depositRemainingToNext: number | null;
}

export interface PortfolioAssetSummary {
  symbol: string;
  totalDeposited: number;
  currentValue: number;
}

export interface PortfolioSummaryResponse {
  assets: PortfolioAssetSummary[];
  totalCurrentValue: number;
  pendingEarnings: number;
  totalPlatformBalance: number;
  growthSeries: { date: string; deposited: number; value: number }[];
  projectedEarnings: { currentMultiplier: number; projectedValue: number };
}

export interface MembershipTierView {
  tierId: string;
  name: string;
  description: string;
  benefits: string[];
  icon: string;
  theme: { accent: string };
  minAmount: string;
  maxAmount: string | null;
  sortOrder?: number;
}

export interface MembershipHistoryView {
  historyId: string;
  fromTierId: string | null;
  toTierId: string | null;
  qualifyingAmount: string;
  reason: string;
  createdAt: string;
}

export interface MembershipView {
  qualifyingAmount: string | null;
  qualifyingComplete: boolean;
  explanation: string;
  current: (MembershipTierView & { achievedAt: string | null }) | null;
  next: { tierId: string; name: string; minAmount: string } | null;
  remainingToNext: string | null;
  progressPercent: number;
  tiers: MembershipTierView[];
  history: MembershipHistoryView[];
}

export interface PerformanceSnapshot {
  snapshot_id: string;
  snapshot_date: string;
  profit_loss: string | null;
  roi_percent: string | null;
  verification_status: string;
  data_source: string;
}

export interface PerformancePoint {
  roiPercent: string | null;
  profitLoss: string | null;
  status: string;
  source?: string | null;
  realized: boolean;
}

export interface PerformanceMethodology {
  investment: string;
  account: string;
  version: string;
  note: string;
}

export interface PerformanceMetrics {
  currentInvestmentValue: string;
  investedPrincipal: string;
  valuationComplete: boolean;
  todayProfitLoss: string | null;
  todayRoiPercent: string | null;
  todayStatus: "verified" | "unavailable";
  totalRealizedProfitLoss: string;
  totalUnrealizedProfitLoss: string | null;
  overallReturnPercent: string | null;
  periodReturnPercent: string | null;
  periodProfitLoss: string | null;
  periodStatus: "verified" | "unavailable";
}

export interface PerformanceChartPoint {
  date: string;
  portfolioValue: string | null;
  profitLoss: string | null;
  cumulativeProfitLoss: string | null;
  roiPercent: string | null;
  externalFlow: string;
  status: "verified" | "unavailable";
}

export interface PerformanceChartData {
  rangeStart: string | null;
  rangeEnd: string | null;
  openingValue: string | null;
  closingValue: string | null;
  externalContributions: string;
  externalWithdrawals: string;
  points: PerformanceChartPoint[];
}

export interface DailyPerformanceHistoryRow {
  date: string;
  openingValue: string;
  closingValue: string | null;
  externalContributions: string;
  externalWithdrawals: string;
  realizedProfitLoss: string;
  unrealizedProfitLoss: string | null;
  feesAndAdjustments: string;
  netProfitLoss: string | null;
  roiPercent: string | null;
  status: "verified" | "unavailable";
  methodology: string;
  source: string | null;
}

export interface PerformanceView {
  range: string;
  methodology: PerformanceMethodology;
  metrics: PerformanceMetrics;
  chart: PerformanceChartData;
  today: PerformancePoint;
  cumulative: PerformancePoint;
  realizedEarnings: string;
  history: PerformanceSnapshot[];
  dailyHistory: DailyPerformanceHistoryRow[];
  note: string;
}

export interface ActiveBonus {
  bonus_id: string;
  label: string;
  multiplier: number;
  start_time: string;
  end_time: string;
}

export interface DashboardData {
  loading: boolean;
  error: string | null;
  portfolio: PortfolioSummaryResponse | null;
  progression: ProgressionResponse | null;
  membership: MembershipView | null;
  membershipError: string | null;
  transactions: TransactionRecord[];
  transactionsError: string | null;
  bonuses: ActiveBonus[];
  performance: PerformanceView | null;
  performanceLoading: boolean;
  performanceError: string | null;
  performanceRange: PerformanceRange;
  setPerformanceRange: (range: PerformanceRange) => void;
  refresh: () => void;
}

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

export function useDashboardData(): DashboardData {
  const [portfolio, setPortfolio] = useState<PortfolioSummaryResponse | null>(null);
  const [progression, setProgression] = useState<ProgressionResponse | null>(null);
  const [membership, setMembership] = useState<MembershipView | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [bonuses, setBonuses] = useState<ActiveBonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [performance, setPerformance] = useState<PerformanceView | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [performanceRange, setPerformanceRange] = useState<PerformanceRange>("30d");

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError(null);

    const results = await Promise.allSettled([
      api.get<PortfolioSummaryResponse>("/portfolio/summary"),
      api.get<ProgressionResponse>("/user/current_xp_level"),
      api.get<MembershipView>("/operations/membership"),
      fetchUserTransactions(),
      api.get<ActiveBonus[]>("/bonuses/active")
    ]);

    const [portfolioResult, progressionResult, membershipResult, transactionsResult, bonusResult] =
      results;

    if (portfolioResult.status === "fulfilled") {
      setPortfolio(portfolioResult.value.data);
    } else {
      setPortfolio(null);
    }

    if (progressionResult.status === "fulfilled") {
      setProgression(progressionResult.value.data);
    } else {
      setProgression(null);
    }

    if (membershipResult.status === "fulfilled") {
      setMembership(membershipResult.value.data);
      setMembershipError(null);
    } else {
      setMembership(null);
      setMembershipError(
        extractMessage(membershipResult.reason, "Membership information is unavailable.")
      );
    }

    if (transactionsResult.status === "fulfilled") {
      setTransactions(transactionsResult.value);
      setTransactionsError(null);
    } else {
      setTransactions([]);
      setTransactionsError(
        extractMessage(transactionsResult.reason, "Recent activity is unavailable.")
      );
    }

    if (bonusResult.status === "fulfilled") {
      setBonuses(bonusResult.value.data);
    } else {
      setBonuses([]);
    }

    if (portfolioResult.status === "rejected" && progressionResult.status === "rejected") {
      setError(
        extractMessage(
          portfolioResult.reason,
          "We could not load your portfolio right now. Please try again."
        )
      );
    }

    setLoading(false);
  }, []);

  const loadPerformance = useCallback(async (range: PerformanceRange) => {
    setPerformanceLoading(true);
    setPerformanceError(null);
    try {
      const response = await api.get<PerformanceView>(`/operations/performance?range=${range}`);
      setPerformance(response.data);
    } catch (requestError) {
      setPerformance(null);
      setPerformanceError(
        extractMessage(requestError, "Performance information is unavailable.")
      );
    } finally {
      setPerformanceLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    void loadPerformance(performanceRange);
  }, [loadPerformance, performanceRange]);

  const refresh = useCallback(() => {
    void loadCore();
    void loadPerformance(performanceRange);
  }, [loadCore, loadPerformance, performanceRange]);

  return useMemo(
    () => ({
      loading,
      error,
      portfolio,
      progression,
      membership,
      membershipError,
      transactions,
      transactionsError,
      bonuses,
      performance,
      performanceLoading,
      performanceError,
      performanceRange,
      setPerformanceRange,
      refresh
    }),
    [
      loading,
      error,
      portfolio,
      progression,
      membership,
      membershipError,
      transactions,
      transactionsError,
      bonuses,
      performance,
      performanceLoading,
      performanceError,
      performanceRange,
      refresh
    ]
  );
}
