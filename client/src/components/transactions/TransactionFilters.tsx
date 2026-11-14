import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { SegmentedControl } from "../dashboard/primitives";
import type { TransactionFilters } from "../../hooks/useTransactionsData";

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "deposits", label: "Deposits" },
  { value: "bonuses", label: "Bonuses" },
  { value: "rewards", label: "Rewards" },
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
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" }
];

const FIELD_CLASS =
  "w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-xs text-[#F5F5F7] outline-none ring-1 ring-inset ring-[#26272B] transition-colors placeholder:text-[#6B7280] focus:ring-[#C6A15B]/60";

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center sm:gap-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function TransactionFilters({
  filters,
  onChange,
  onReset
}: {
  filters: TransactionFilters;
  onChange: (patch: Partial<TransactionFilters>) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3.5">
      <FilterRow label="Type">
        <div className="w-full">
          <SegmentedControl
            ariaLabel="Filter transactions by type"
            options={CATEGORY_OPTIONS}
            value={filters.category}
            onChange={(value) => onChange({ category: value })}
          />
        </div>
      </FilterRow>

      <FilterRow label="Status">
        <div className="w-full">
          <SegmentedControl
            ariaLabel="Filter transactions by status"
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => onChange({ status: value })}
          />
        </div>
      </FilterRow>

      <FilterRow label="Period">
        <div className="w-full">
          <SegmentedControl
            ariaLabel="Filter transactions by date range"
            options={RANGE_OPTIONS}
            value={filters.range}
            onChange={(value) => onChange({ range: value })}
          />
        </div>
      </FilterRow>

      {filters.range === "custom" ? (
        <FilterRow label="Dates">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="date"
              value={filters.from ?? ""}
              max={filters.to ?? undefined}
              onChange={(event) => onChange({ from: event.target.value || null })}
              aria-label="From date"
              className={`${FIELD_CLASS} sm:w-auto`}
            />
            <span className="text-center text-[11px] text-[#6B7280] sm:text-left">to</span>
            <input
              type="date"
              value={filters.to ?? ""}
              min={filters.from ?? undefined}
              onChange={(event) => onChange({ to: event.target.value || null })}
              aria-label="To date"
              className={`${FIELD_CLASS} sm:w-auto`}
            />
          </div>
        </FilterRow>
      ) : null}

      <FilterRow label="Search">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filters.search}
              onChange={(event) => onChange({ search: event.target.value })}
              placeholder="Reference, hash, asset or type"
              aria-label="Search transactions"
              className={`${FIELD_CLASS} pl-9`}
            />
          </div>
          <input
            value={filters.asset}
            onChange={(event) => onChange({ asset: event.target.value })}
            placeholder="Asset"
            aria-label="Filter by asset"
            className={`${FIELD_CLASS} sm:w-24`}
          />
          <button
            type="button"
            onClick={onReset}
            className="btn btn-secondary btn-sm self-start sm:self-auto"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Reset
          </button>
        </div>
      </FilterRow>
    </div>
  );
}
