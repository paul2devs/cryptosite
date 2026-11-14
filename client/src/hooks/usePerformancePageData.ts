import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import type {
  DailyPerformanceHistoryRow,
  PerformanceRange,
  PerformanceView
} from "./useDashboardData";

export interface PerformanceDailyPosition {
  positionId: string;
  asset: string;
  strategy: string;
  openingValuation: string;
  closingValuation: string | null;
  cashFlow: string;
  profitLoss: string | null;
  roiPercent: string | null;
  verificationStatus: string;
  dataSource: string;
  reason: string | null;
  correctionOf: string | null;
}

export interface PerformanceDailyEvent {
  entryId: string;
  direction: string;
  amount: string;
  asset: string;
  transactionType: string;
  createdAt: string;
}

export interface PerformanceDailyDetail {
  date: string;
  summary: DailyPerformanceHistoryRow | null;
  positions: PerformanceDailyPosition[];
  events: PerformanceDailyEvent[];
}

export interface PerformancePageData {
  loading: boolean;
  rangeLoading: boolean;
  error: string | null;
  performance: PerformanceView | null;
  range: PerformanceRange;
  setRange: (range: PerformanceRange) => void;
  refresh: () => void;
  detail: PerformanceDailyDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  activeDate: string | null;
  openDay: (date: string) => void;
  closeDay: () => void;
}

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

export function usePerformancePageData(
  initialRange: PerformanceRange = "30d"
): PerformancePageData {
  const [performance, setPerformance] = useState<PerformanceView | null>(null);
  const [range, setRange] = useState<PerformanceRange>(initialRange);
  const [loading, setLoading] = useState(true);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<PerformanceDailyDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const isFirst = !hasLoaded;
    if (isFirst) {
      setLoading(true);
    } else {
      setRangeLoading(true);
    }
    setError(null);
    api
      .get<PerformanceView>(`/operations/performance?range=${range}`)
      .then((response) => {
        if (cancelled) return;
        setPerformance(response.data);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setPerformance(null);
        setError(extractMessage(requestError, "Performance information is unavailable."));
      })
      .finally(() => {
        if (cancelled) return;
        setHasLoaded(true);
        setLoading(false);
        setRangeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, reloadToken, hasLoaded]);

  useEffect(() => {
    if (!activeDate) {
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    api
      .get<PerformanceDailyDetail>(`/operations/performance/daily/${activeDate}`)
      .then((response) => {
        if (cancelled) return;
        setDetail(response.data);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setDetailError(extractMessage(requestError, "Daily performance detail is unavailable."));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeDate]);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const openDay = useCallback((date: string) => {
    setActiveDate(date);
  }, []);

  const closeDay = useCallback(() => {
    setActiveDate(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  return useMemo(
    () => ({
      loading,
      rangeLoading,
      error,
      performance,
      range,
      setRange,
      refresh,
      detail,
      detailLoading,
      detailError,
      activeDate,
      openDay,
      closeDay
    }),
    [
      loading,
      rangeLoading,
      error,
      performance,
      range,
      refresh,
      detail,
      detailLoading,
      detailError,
      activeDate,
      openDay,
      closeDay
    ]
  );
}
