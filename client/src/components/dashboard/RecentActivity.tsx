import { Link } from "react-router-dom";
import { SolidDeposit, SolidWithdraw } from "../icons/SolidIcons";
import type { TransactionRecord } from "../../utils/transactions";
import { Section, SectionHeader, StatusBadge, EmptyState, ErrorRow, LoadingRow } from "./primitives";
import { formatNumber, formatRelativeTime } from "../../utils/format";

export function RecentActivity({
  transactions,
  loading,
  error,
  onRetry,
  limit = 6
}: {
  transactions: TransactionRecord[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  limit?: number;
}) {
  const visible = transactions.slice(0, limit);

  return (
    <Section>
      <SectionHeader
        title="Recent activity"
        description="Your latest deposits and withdrawals."
        action={
          <Link
            to="/transactions"
            className="rounded-full px-3 py-1 text-[11px] font-medium text-[#9CA3AF] transition-colors hover:text-[#C6A15B]"
          >
            View all
          </Link>
        }
      />
      <div className="card mt-4">
        {loading ? (
          <div className="px-4">
            <LoadingRow label="Loading your activity…" />
          </div>
        ) : error ? (
          <div className="p-3">
            <ErrorRow message={error} onRetry={onRetry} />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-2">
            <EmptyState
              title="No activity yet"
              description="Your first approved deposit or withdrawal request will appear here."
              action={
                <Link to="/deposit" className="btn btn-md btn-primary">
                  Make a deposit
                </Link>
              }
            />
          </div>
        ) : (
          <div>
            {visible.map((item) => {
              const isDeposit = item.kind === "deposit";
              const Icon = isDeposit ? SolidDeposit : SolidWithdraw;
              return (
                <Link
                  key={`${item.kind}-${item.id}`}
                  to="/transactions"
                  className="list-row px-4 transition-colors hover:bg-[#17181A]"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F0F10]">
                    <Icon
                      className={`h-4 w-4 ${isDeposit ? "text-[#C6A15B]" : "text-[#9CA3AF]"}`}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[#F5F5F7]">{item.title}</p>
                    <p className="truncate text-[10px] text-[#6B7280]">
                      {item.detail} · {formatRelativeTime(item.timestamp)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`financial-figure text-xs ${
                        isDeposit ? "text-[#F5F5F7]" : "text-[#9CA3AF]"
                      }`}
                    >
                      {isDeposit ? "+" : "-"}
                      {formatNumber(item.amount, 6)}
                    </span>
                    <StatusBadge tone={item.tone} label={item.statusLabel} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}
