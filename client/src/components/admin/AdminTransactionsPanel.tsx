import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Search } from "lucide-react";
import {
  EmptyState,
  ErrorRow,
  Panel,
  SegmentedControl,
  Stat,
  StatStrip,
  StatusBadge
} from "../dashboard/primitives";
import { formatDateTime, formatNumber, parseDecimalString, truncateMiddle } from "../../utils/format";
import {
  fetchAdminTransactions,
  transactionStatusTone,
  type AdminTransactionListResponse,
  type AdminTransactionView
} from "../../utils/transactions";

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "deposits", label: "Deposits" },
  { value: "withdrawals", label: "Withdrawals" },
  { value: "investments", label: "Investments" },
  { value: "returns", label: "Returns" },
  { value: "fees", label: "Fees" },
  { value: "other", label: "Other" }
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" }
];

const RANGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" }
];

const PAGE_SIZE = 25;

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

function amountLabel(value: string): string {
  const parsed = parseDecimalString(value);
  return parsed === null ? "0" : formatNumber(parsed, 8);
}

function AdminRowDetail({ row }: { row: AdminTransactionView }) {
  return (
    <div className="grid gap-2 border-t border-[#26272B]/60 bg-[#0F0F10]/40 px-4 py-3 text-[11px] text-[#9CA3AF] sm:grid-cols-2">
      <p>User {row.userEmail} · {row.userId}</p>
      <p>Type code <span className="font-mono text-[#F5F5F7]">{row.type}</span></p>
      <p>Created {formatDateTime(row.createdAt)}</p>
      <p>Updated {formatDateTime(row.updatedAt)}</p>
      <p>Completed {row.completedAt ? formatDateTime(row.completedAt) : "not completed"}</p>
      <p>Related {row.relatedReference ?? "none"}</p>
      <p>Source address {row.sourceAddress ?? "not recorded"}</p>
      <p>Destination address {row.destinationAddress ?? "not recorded"}</p>
      <p className="break-all sm:col-span-2">
        Hash {row.txHash ?? "not recorded"}
        {row.explorerUrl ? (
          <a
            href={row.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-[#C6A15B]"
          >
            explorer
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : null}
      </p>
      {row.failureReason ? <p className="text-[#EA3943] sm:col-span-2">{row.failureReason}</p> : null}
    </div>
  );
}

export function AdminTransactionsPanel() {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState("30d");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<AdminTransactionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminTransactions({
        category,
        status,
        range,
        search: debouncedSearch || undefined,
        userId: userId.trim() || undefined,
        page,
        pageSize: PAGE_SIZE
      });
      setPayload(response);
    } catch (requestError) {
      setPayload(null);
      setError(extractMessage(requestError, "Failed to load admin transactions"));
    } finally {
      setLoading(false);
    }
  }, [category, status, range, debouncedSearch, userId, page, reloadToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = useMemo(() => {
    if (!payload) return 1;
    return Math.max(1, Math.ceil(payload.total / payload.pageSize));
  }, [payload]);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Type</span>
            <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
              <div className="min-w-max">
                <SegmentedControl
                  ariaLabel="Admin transaction type filter"
                  options={CATEGORY_OPTIONS}
                  value={category}
                  onChange={(value) => {
                    setCategory(value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Status</span>
            <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
              <div className="min-w-max">
                <SegmentedControl
                  ariaLabel="Admin transaction status filter"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={(value) => {
                    setStatus(value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Period</span>
            <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
              <div className="min-w-max">
                <SegmentedControl
                  ariaLabel="Admin transaction period filter"
                  options={RANGE_OPTIONS}
                  value={range}
                  onChange={(value) => {
                    setRange(value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Search</span>
            <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Reference, hash, asset or type"
                className="w-full rounded-xl border border-[#26272B] bg-[#0F0F10] py-1.5 pl-9 pr-3 text-xs text-[#F5F5F7] outline-none focus:border-[#C6A15B]/60"
              />
            </div>
            <input
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setPage(1);
              }}
              placeholder="Filter by user id"
              className="w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none focus:border-[#C6A15B]/60 sm:w-52"
            />
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="btn btn-sm btn-secondary w-full sm:w-auto"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Refresh
            </button>
          </div>
        </div>
      </Panel>

      {payload ? (
        <Panel className="min-w-0">
          <StatStrip>
            <Stat label="Confirmed deposits" value={amountLabel(payload.summary.confirmedDeposits)} />
            <Stat label="Completed withdrawals" value={amountLabel(payload.summary.completedWithdrawals)} />
            <Stat label="Pending" value={String(payload.summary.pendingCount)} tone="gold" />
            <Stat label="Total" value={String(payload.summary.totalCount)} />
          </StatStrip>
        </Panel>
      ) : null}

      <Panel className="p-0">
        {loading && !payload ? (
          <p className="px-5 py-6 text-xs text-[#9CA3AF]">Loading transactions…</p>
        ) : error ? (
          <div className="p-4">
            <ErrorRow message={error} onRetry={() => setReloadToken((token) => token + 1)} />
          </div>
        ) : !payload || payload.transactions.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyState title="No transactions match these filters" />
          </div>
        ) : (
          <>
            <div className="divide-y divide-[#26272B]/60">
              {payload.transactions.map((row) => (
                <div key={`${row.userId}-${row.reference}`}>
                  <button
                    type="button"
                    onClick={() => setExpanded((current) => (current === `${row.userId}-${row.reference}` ? null : `${row.userId}-${row.reference}`))}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-[#1F2023]/50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-[#F5F5F7]">
                        {row.typeLabel}
                        <span className="ml-2 font-normal text-[#6B7280]">{row.reference}</span>
                      </span>
                      <span className="block truncate text-[10px] text-[#6B7280]">
                        {row.userEmail} · {row.txHash ? truncateMiddle(row.txHash, 8, 8) : "no hash"} ·{" "}
                        {formatDateTime(row.createdAt)}
                      </span>
                    </span>
                    <span className="financial-figure text-xs text-[#F5F5F7]">
                      {amountLabel(row.amount)} {row.asset}
                    </span>
                    <StatusBadge tone={transactionStatusTone(row.status)} label={row.statusLabel} />
                  </button>
                  {expanded === `${row.userId}-${row.reference}` ? <AdminRowDetail row={row} /> : null}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#26272B] px-4 py-3">
              <p className="text-[11px] text-[#6B7280]">
                {payload.total} transactions · page {payload.page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="btn btn-sm btn-secondary"
                >
                  <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="btn btn-sm btn-secondary"
                >
                  Next
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
