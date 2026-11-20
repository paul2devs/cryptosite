import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../utils/api";
import { fetchUserTransactions, type TransactionRecord } from "../utils/transactions";
import type {
  DailyPerformanceHistoryRow,
  PerformanceChartData,
  PerformanceMethodology,
  PerformanceMetrics,
  PerformancePoint,
  PerformanceRange,
  PerformanceSnapshot
} from "./useDashboardData";

export type { PerformanceRange };

export interface PortfolioHoldingView {
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  allocationPercent: number;
}

export interface PortfolioAllocationView {
  symbol: string;
  value: number;
  percent: number;
}

export interface PortfolioTotalsView {
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

export interface PortfolioPerformanceView {
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

export interface PortfolioOverviewResponse {
  currency: "USD";
  updatedAt: string;
  totals: PortfolioTotalsView;
  holdings: PortfolioHoldingView[];
  allocation: PortfolioAllocationView[];
  performance: PortfolioPerformanceView;
}

export interface PortfolioData {
  loading: boolean;
  rangeLoading: boolean;
  error: string | null;
  overview: PortfolioOverviewResponse | null;
  transactions: TransactionRecord[];
  transactionsLoading: boolean;
  transactionsError: string | null;
  range: PerformanceRange;
  setRange: (range: PerformanceRange) => void;
  refresh: () => void;
}

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

export function usePortfolioData(initialRange: PerformanceRange = "30d"): PortfolioData {
  const [overview, setOverview] = useState<PortfolioOverviewResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<PerformanceRange>(initialRange);
  const hasLoadedOverview = useRef(false);

  const loadOverview = useCallback(async (nextRange: PerformanceRange) => {
    const isFirstLoad = !hasLoadedOverview.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRangeLoading(true);
    }
    setError(null);
    try {
      const response = await api.get<PortfolioOverviewResponse>(
        `/portfolio/overview?range=${nextRange}`
      );
      setOverview(response.data);
    } catch (requestError) {
      setOverview(null);
      setError(
        extractMessage(
          requestError,
          "We could not load your portfolio right now. Please try again."
        )
      );
    } finally {
      hasLoadedOverview.current = true;
      setLoading(false);
      setRangeLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    try {
      const result = await fetchUserTransactions();
      setTransactions(result);
      setTransactionsError(null);
    } catch (requestError) {
      setTransactions([]);
      setTransactionsError(
        extractMessage(requestError, "Portfolio history is unavailable right now.")
      );
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview(range);
  }, [loadOverview, range]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const refresh = useCallback(() => {
    void loadOverview(range);
    void loadTransactions();
  }, [loadOverview, loadTransactions, range]);

  return useMemo(
    () => ({
      loading,
      rangeLoading,
      error,
      overview,
      transactions,
      transactionsLoading,
      transactionsError,
      range,
      setRange,
      refresh
    }),
    [
      loading,
      rangeLoading,
      error,
      overview,
      transactions,
      transactionsLoading,
      transactionsError,
      range,
      refresh
    ]
  );
}
