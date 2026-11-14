import type { ComponentType, SVGProps } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  EmptyState,
  ErrorRow,
  LoadingRow,
  Panel,
  StatusBadge
} from "../dashboard/primitives";
import { SolidArrowRight, SolidCheck, SolidDeposit, SolidReceipt, SolidWithdraw } from "../icons/SolidIcons";
import { formatDateTime, formatNumber, parseDecimalString } from "../../utils/format";
import {
  transactionStatusTone,
  type TransactionCategory,
  type TransactionView
} from "../../utils/transactions";

type SolidIcon = ComponentType<SVGProps<SVGSVGElement>>;

const CATEGORY_ICON: Record<TransactionCategory, SolidIcon> = {
  deposit: SolidDeposit,
  withdrawal: SolidWithdraw,
  bonus: SolidCheck,
  reward: SolidCheck,
  investment: SolidReceipt,
  distribution: SolidReceipt,
  fee: SolidReceipt,
  adjustment: SolidReceipt,
  other: SolidReceipt
};

// Desktop columns: transaction (+reference), asset, amount, date, status, row affordance.
const DESKTOP_GRID =
  "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.6fr)_minmax(auto,1.1fr)_minmax(auto,1.2fr)_minmax(auto,0.9fr)_1.5rem]";

function iconToneClass(direction: TransactionView["direction"]): string {
  if (direction === "in") return "text-[#16C784]";
  if (direction === "out") return "text-[#C6A15B]";
  return "text-[#9CA3AF]";
}

function amountToneClass(direction: TransactionView["direction"]): string {
  return direction === "in" ? "text-[#16C784]" : "text-[#F5F5F7]";
}

function signFor(direction: TransactionView["direction"]): string {
  if (direction === "in") return "+";
  if (direction === "out") return "-";
  return "";
}

function amountValue(transaction: TransactionView): string {
  const parsed = parseDecimalString(transaction.amount);
  return parsed === null ? "0" : formatNumber(parsed, 8);
}

function signedAmount(transaction: TransactionView): string {
  return `${signFor(transaction.direction)}${amountValue(transaction)}`;
}

function fullAmount(transaction: TransactionView): string {
  return `${signedAmount(transaction)} ${transaction.asset}`;
}

export function TransactionList({
  transactions,
  total,
  page,
  pageSize,
  loading,
  error,
  onRetry,
  onSelect,
  onPageChange
}: {
  transactions: TransactionView[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (reference: string) => void;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Panel className="p-0">
      {loading && transactions.length === 0 ? (
        <div className="px-5">
          <LoadingRow label="Loading your transactions…" />
        </div>
      ) : error && transactions.length === 0 ? (
        <div className="p-4">
          <ErrorRow message={error} onRetry={onRetry} />
        </div>
      ) : transactions.length === 0 ? (
        <div className="px-5 py-4">
          <EmptyState
            title="No transactions match these filters"
            description="Adjust the type, status or date filters to see other recorded transactions."
          />
        </div>
      ) : (
        <>
          {/* Desktop: single-line history table with hairline dividers. */}
          <div
            aria-hidden="true"
            className={`hairline-b hidden px-5 py-2.5 text-[10px] uppercase tracking-[0.14em] text-[#6B7280] md:grid ${DESKTOP_GRID} items-center gap-4`}
          >
            <span>Transaction</span>
            <span>Asset</span>
            <span className="text-right">Amount</span>
            <span>Date</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="hidden divide-y divide-[#26272B]/60 md:block">
            {transactions.map((transaction) => {
              const Icon = CATEGORY_ICON[transaction.category] ?? SolidReceipt;
              return (
                <li key={transaction.reference}>
                  <button
                    type="button"
                    onClick={() => onSelect(transaction.reference)}
                    aria-label={`View ${transaction.typeLabel} of ${fullAmount(transaction)}, status ${transaction.statusLabel}, recorded ${formatDateTime(transaction.createdAt)}`}
                    className={`grid w-full px-5 py-3 text-left transition-colors hover:bg-[#1F2023]/40 ${DESKTOP_GRID} items-center gap-4`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F0F10]">
                        <Icon className={`h-3.5 w-3.5 ${iconToneClass(transaction.direction)}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[#F5F5F7]">
                          {transaction.typeLabel}
                        </p>
                        <p className="truncate font-mono text-[10px] text-[#6B7280]">
                          {transaction.reference}
                        </p>
                      </div>
                    </div>
                    <span className="truncate text-xs text-[#9CA3AF]">{transaction.asset}</span>
                    <span
                      className={`financial-figure whitespace-nowrap text-right text-xs font-medium ${amountToneClass(transaction.direction)}`}
                    >
                      {signedAmount(transaction)}
                    </span>
                    <span className="whitespace-nowrap text-xs text-[#9CA3AF]">
                      {formatDateTime(transaction.createdAt)}
                    </span>
                    <StatusBadge tone={transactionStatusTone(transaction.status)} label={transaction.statusLabel} />
                    <SolidArrowRight className="h-3.5 w-3.5 justify-self-end text-[#6B7280]" />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Mobile: prioritised list rows (type + amount + status first). */}
          <ul className="md:hidden">
            {transactions.map((transaction) => {
              const Icon = CATEGORY_ICON[transaction.category] ?? SolidReceipt;
              return (
                <li
                  key={transaction.reference}
                  className="list-row transition-colors hover:bg-[#17181A]"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(transaction.reference)}
                    aria-label={`View ${transaction.typeLabel} of ${fullAmount(transaction)}, status ${transaction.statusLabel}, recorded ${formatDateTime(transaction.createdAt)}`}
                    className="flex w-full items-center gap-3 px-4 text-left sm:px-5"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F0F10]">
                      <Icon className={`h-4 w-4 ${iconToneClass(transaction.direction)}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium text-[#F5F5F7]">
                          {transaction.typeLabel}
                        </p>
                        <p
                          className={`financial-figure shrink-0 whitespace-nowrap text-right text-sm font-medium ${amountToneClass(transaction.direction)}`}
                        >
                          {fullAmount(transaction)}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-[11px] text-[#6B7280]">
                          {formatDateTime(transaction.createdAt)}
                        </span>
                        <StatusBadge
                          tone={transactionStatusTone(transaction.status)}
                          label={transaction.statusLabel}
                        />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-[#6B7280]">
                        {transaction.reference}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hairline-t flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <p className="text-[11px] text-[#6B7280]">
              {total} transaction{total === 1 ? "" : "s"} · page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
                className="btn btn-secondary btn-sm"
              >
                <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
                className="btn btn-secondary btn-sm"
              >
                Next
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}
