import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchTransactionDetail,
  fetchTransactionFeed,
  type TransactionDetailResponse,
  type TransactionFeedQuery,
  type TransactionListResponse
} from "../utils/transactions";

export interface TransactionFilters {
  category: string;
  status: string;
  range: string;
  search: string;
  asset: string;
  from: string | null;
  to: string | null;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  category: "all",
  status: "all",
  range: "all",
  search: "",
  asset: "",
  from: null,
  to: null
};

export interface TransactionsData {
  loading: boolean;
  error: string | null;
  feed: TransactionListResponse | null;
  filters: TransactionFilters;
  page: number;
  pageSize: number;
  setFilters: (patch: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  refresh: () => void;
  detail: TransactionDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;
  activeReference: string | null;
  openDetail: (reference: string) => void;
  closeDetail: () => void;
}

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

const PAGE_SIZE = 20;

export function useTransactionsData(): TransactionsData {
  const [filters, setFiltersState] = useState<TransactionFilters>(DEFAULT_TRANSACTION_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [feed, setFeed] = useState<TransactionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [activeReference, setActiveReference] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransactionDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(filters.search.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [filters.search]);

  const query: TransactionFeedQuery = useMemo(() => {
    const custom = filters.range === "custom";
    return {
      category: filters.category,
      status: filters.status,
      range: filters.range,
      search: debouncedSearch || undefined,
      asset: filters.asset.trim() || undefined,
      from: custom ? filters.from : null,
      to: custom ? filters.to : null,
      page,
      pageSize: PAGE_SIZE
    };
  }, [filters.category, filters.status, filters.range, filters.from, filters.to, filters.asset, debouncedSearch, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTransactionFeed(query)
      .then((response) => {
        if (cancelled) return;
        setFeed(response);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setFeed(null);
        setError(extractMessage(requestError, "We could not load your transactions right now."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, reloadToken]);

  useEffect(() => {
    if (!activeReference) {
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    fetchTransactionDetail(activeReference)
      .then((response) => {
        if (cancelled) return;
        setDetail(response);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setDetailError(extractMessage(requestError, "We could not load this transaction."));
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeReference]);

  const setFilters = useCallback((patch: Partial<TransactionFilters>) => {
    setFiltersState((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_TRANSACTION_FILTERS);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const openDetail = useCallback((reference: string) => {
    setActiveReference(reference);
  }, []);

  const closeDetail = useCallback(() => {
    setActiveReference(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  return useMemo(
    () => ({
      loading,
      error,
      feed,
      filters,
      page,
      pageSize: PAGE_SIZE,
      setFilters,
      resetFilters,
      setPage,
      refresh,
      detail,
      detailLoading,
      detailError,
      activeReference,
      openDetail,
      closeDetail
    }),
    [
      loading,
      error,
      feed,
      filters,
      page,
      setFilters,
      resetFilters,
      refresh,
      detail,
      detailLoading,
      detailError,
      activeReference,
      openDetail,
      closeDetail
    ]
  );
}
