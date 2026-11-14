import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import {
  Panel,
  SectionHeader,
  LoadingRow,
  ErrorRow,
  EmptyState
} from "../dashboard/primitives";
import { formatNumber } from "../../utils/format";
import {
  resolveWithdrawalLifecycleState,
  withdrawalReference
} from "../../utils/withdraw";
import type { WithdrawalRecord } from "../../utils/transactions";
import {
  WithdrawalHistoryTable,
  describeWithdrawalStatus
} from "./WithdrawalHistoryTable";
import { WithdrawalDetailStatus } from "./WithdrawalDetailStatus";

const PAGE_SIZE = 6;

/**
 * Canonical lifecycle states offered as filters, ordered as they occur. Labels
 * come from the shared display map so the filter agrees with the table.
 */
const FILTER_STATES: string[] = [
  "requested",
  "under_review",
  "approved",
  "processing",
  "completed",
  "rejected",
  "failed",
  "cancelled"
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All statuses" },
  ...FILTER_STATES.map((state) => ({
    value: state,
    label: describeWithdrawalStatus(state, state).label
  }))
];

function matchesStatusFilter(state: string, filter: string): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "processing") {
    return state === "processing" || state === "broadcast";
  }
  return state === filter;
}

function timestampOf(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function WithdrawalHistory({
  withdrawals,
  loading,
  error,
  onRetry
}: {
  withdrawals: WithdrawalRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return withdrawals
      .filter((withdrawal) => {
        const state = resolveWithdrawalLifecycleState(
          withdrawal.status,
          withdrawal.detailed_status
        );
        if (!matchesStatusFilter(state, statusFilter)) {
          return false;
        }
        const withdrawalTime = timestampOf(withdrawal.timestamp);
        if (fromTime !== null && withdrawalTime < fromTime) {
          return false;
        }
        if (toTime !== null && withdrawalTime > toTime) {
          return false;
        }
        if (normalizedQuery.length === 0) {
          return true;
        }
        const haystack = [
          withdrawalReference(withdrawal.withdrawal_id),
          withdrawal.tx_hash ?? "",
          withdrawal.asset ?? "",
          withdrawal.network ?? "",
          withdrawal.destination_address ?? "",
          formatNumber(Number(withdrawal.amount), 8)
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => timestampOf(right.timestamp) - timestampOf(left.timestamp));
  }, [withdrawals, query, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (selectedId && !filtered.some((withdrawal) => withdrawal.withdrawal_id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((withdrawal) => withdrawal.withdrawal_id === selectedId) ?? null;

  const dateInputClass =
    "min-w-0 flex-1 rounded-lg bg-[#0F0F10] px-2.5 py-2 text-[11px] text-[#F5F5F7] outline-none ring-1 ring-inset ring-[#26272B] focus:ring-[#C6A15B]/70 lg:flex-none";
  const selectClass =
    "max-w-full rounded-lg bg-[#0F0F10] px-2.5 py-2 text-[11px] text-[#F5F5F7] outline-none ring-1 ring-inset ring-[#26272B] focus:ring-[#C6A15B]/70";

  return (
    <Panel className="space-y-4">
      <SectionHeader
        eyebrow="History"
        title="Your withdrawal history"
        description="Every withdrawal request from your account, with its real processing status and on-chain hash once broadcast."
      />

      {loading && withdrawals.length === 0 ? (
        <LoadingRow label="Loading your withdrawal history…" />
      ) : error && withdrawals.length === 0 ? (
        <ErrorRow message={error} onRetry={onRetry} />
      ) : withdrawals.length === 0 ? (
        <EmptyState
          title="No withdrawals yet"
          description="Your withdrawal requests will appear here once you submit your first one."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full min-w-0 lg:max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search reference, hash or address"
                aria-label="Search withdrawals"
                className="w-full rounded-lg bg-[#0F0F10] py-2 pl-8 pr-3 text-[11px] text-[#F5F5F7] outline-none ring-1 ring-inset ring-[#26272B] placeholder:text-[#4B5563] focus:ring-[#C6A15B]/70"
              />
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center gap-3 lg:w-auto">
              <label className="sr-only" htmlFor="withdrawal-status-filter">
                Filter withdrawals by status
              </label>
              <select
                id="withdrawal-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={selectClass}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
                <label className="sr-only" htmlFor="withdrawal-date-from">
                  From date
                </label>
                <input
                  id="withdrawal-date-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className={dateInputClass}
                />
                <span className="shrink-0 text-[11px] text-[#6B7280]">to</span>
                <label className="sr-only" htmlFor="withdrawal-date-to">
                  To date
                </label>
                <input
                  id="withdrawal-date-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                  className={dateInputClass}
                />
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              title="No withdrawals match your filters"
              description="Try a different search term, status or date range."
            />
          ) : (
            <>
              <WithdrawalHistoryTable
                withdrawals={pageItems}
                selectedId={selectedId}
                onSelect={(withdrawal) =>
                  setSelectedId((current) =>
                    current === withdrawal.withdrawal_id ? null : withdrawal.withdrawal_id
                  )
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-[#6B7280]">
                  Showing {pageItems.length} of {filtered.length} withdrawals
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={safePage <= 1}
                    className="btn btn-secondary btn-sm"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Prev
                  </button>
                  <span className="financial-figure text-[11px] text-[#9CA3AF]">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={safePage >= totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    Next
                    <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {selected ? <WithdrawalDetailStatus withdrawal={selected} /> : null}
            </>
          )}
        </>
      )}
    </Panel>
  );
}
