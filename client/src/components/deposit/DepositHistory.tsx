import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import {
  Panel,
  SectionHeader,
  SegmentedControl,
  LoadingRow,
  ErrorRow,
  EmptyState
} from "../dashboard/primitives";
import { formatNumber } from "../../utils/format";
import { depositReference } from "../../utils/deposit";
import type { DepositRecord } from "../../utils/transactions";
import { DepositHistoryTable } from "./DepositHistoryTable";
import { DepositVerificationStatus } from "./DepositVerificationStatus";

type StatusFilter = "all" | "Pending" | "Approved" | "Rejected";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Confirmed" },
  { value: "Rejected", label: "Rejected" }
];

const PAGE_SIZE = 6;

function timestampOf(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function DepositHistory({
  deposits,
  loading,
  error,
  onRetry
}: {
  deposits: DepositRecord[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return deposits
      .filter((deposit) => {
        if (statusFilter !== "all" && deposit.status !== statusFilter) {
          return false;
        }
        const depositTime = timestampOf(deposit.timestamp);
        if (fromTime !== null && depositTime < fromTime) {
          return false;
        }
        if (toTime !== null && depositTime > toTime) {
          return false;
        }
        if (normalizedQuery.length === 0) {
          return true;
        }
        const haystack = [
          depositReference(deposit.deposit_id),
          deposit.tx_hash ?? "",
          deposit.crypto_type,
          deposit.network ?? "",
          formatNumber(deposit.amount, 8)
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((left, right) => timestampOf(right.timestamp) - timestampOf(left.timestamp));
  }, [deposits, query, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (selectedId && !filtered.some((deposit) => deposit.deposit_id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((deposit) => deposit.deposit_id === selectedId) ?? null;

  const dateInputClass =
    "min-w-0 flex-1 rounded-lg border border-[#26272B] bg-[#0F0F10] px-2.5 py-2 text-[11px] text-[#F5F5F7] outline-none focus:border-[#C6A15B]/70";

  return (
    <Panel className="space-y-4">
      <SectionHeader
        eyebrow="History"
        title="Your deposit history"
        description="Every deposit submitted from your account, verified independently on-chain."
      />

      {loading && deposits.length === 0 ? (
        <LoadingRow label="Loading your deposit history…" />
      ) : error && deposits.length === 0 ? (
        <ErrorRow message={error} onRetry={onRetry} />
      ) : deposits.length === 0 ? (
        <EmptyState
          title="No deposits yet"
          description="Your verified deposits will appear here once you submit your first transaction hash."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xs">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search reference, hash or asset"
                aria-label="Search deposits"
                className="w-full rounded-lg border border-[#26272B] bg-[#0F0F10] py-2 pl-8 pr-3 text-[11px] text-[#F5F5F7] outline-none placeholder:text-[#4B5563] focus:border-[#C6A15B]/70"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
                ariaLabel="Filter deposits by status"
              />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <label className="sr-only" htmlFor="deposit-date-from">
                  From date
                </label>
                <input
                  id="deposit-date-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className={dateInputClass}
                />
                <span className="text-[11px] text-[#6B7280]">to</span>
                <label className="sr-only" htmlFor="deposit-date-to">
                  To date
                </label>
                <input
                  id="deposit-date-to"
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
              title="No deposits match your filters"
              description="Try a different search term, status or date range."
            />
          ) : (
            <>
              <DepositHistoryTable
                deposits={pageItems}
                selectedId={selectedId}
                onSelect={(deposit) =>
                  setSelectedId((current) =>
                    current === deposit.deposit_id ? null : deposit.deposit_id
                  )
                }
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-[#6B7280]">
                  Showing {pageItems.length} of {filtered.length} deposits
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex items-center gap-1 rounded-full border border-[#26272B] bg-[#0F0F10] px-3 py-1 text-[11px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-40"
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
                    className="inline-flex items-center gap-1 rounded-full border border-[#26272B] bg-[#0F0F10] px-3 py-1 text-[11px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-40"
                  >
                    Next
                    <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {selected ? <DepositVerificationStatus deposit={selected} /> : null}
            </>
          )}
        </>
      )}
    </Panel>
  );
}
