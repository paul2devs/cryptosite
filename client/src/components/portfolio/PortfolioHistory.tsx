import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp } from "lucide-react";
import {
  Section,
  SectionHeader,
  Panel,
  StatusBadge,
  EmptyState,
  ErrorRow,
  LoadingRow,
  getToneText,
  type Tone
} from "../dashboard/primitives";
import { formatNumber, formatRelativeTime, formatSignedUsd, parseDecimalString } from "../../utils/format";
import { toneFromValue } from "./utils";
import type { TransactionRecord } from "../../utils/transactions";
import type { PortfolioPerformanceView } from "../../hooks/usePortfolioData";

interface HistoryEvent {
  id: string;
  kind: "cash-flow" | "return";
  title: string;
  detail: string;
  amountLabel: string;
  amountClassName: string;
  timestamp: string;
  statusLabel: string;
  statusTone: Tone;
}

function buildEvents(
  transactions: TransactionRecord[],
  performance: PortfolioPerformanceView | null
): HistoryEvent[] {
  const cashFlowEvents: HistoryEvent[] = transactions.map((item) => {
    const isDeposit = item.kind === "deposit";
    return {
      id: `tx-${item.kind}-${item.id}`,
      kind: "cash-flow",
      title: item.title,
      detail: item.detail,
      amountLabel: `${isDeposit ? "+" : "-"}${formatNumber(item.amount, 6)} ${item.asset}`,
      amountClassName: isDeposit ? "text-[#F5F5F7]" : "text-[#9CA3AF]",
      timestamp: item.timestamp,
      statusLabel: item.statusLabel,
      statusTone: item.tone
    };
  });

  const returnEvents: HistoryEvent[] = (performance?.history ?? [])
    .filter((snapshot) => snapshot.verification_status === "verified")
    .map((snapshot) => {
      const profitLoss = parseDecimalString(snapshot.profit_loss);
      return {
        id: `snap-${snapshot.snapshot_id}`,
        kind: "return" as const,
        title: "Investment return",
        detail: "Verified valuation",
        amountLabel: profitLoss === null ? "Unavailable" : formatSignedUsd(profitLoss),
        amountClassName: profitLoss === null ? "text-[#6B7280]" : getToneText(toneFromValue(profitLoss)),
        timestamp: snapshot.snapshot_date,
        statusLabel: "Verified",
        statusTone: "positive" as Tone
      };
    });

  return [...cashFlowEvents, ...returnEvents].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );
}

export function PortfolioHistory({
  transactions,
  performance,
  loading,
  error,
  onRetry
}: {
  transactions: TransactionRecord[];
  performance: PortfolioPerformanceView | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const events = useMemo(
    () => buildEvents(transactions, performance),
    [transactions, performance]
  );

  return (
    <Section id="portfolio-history">
      <SectionHeader
        title="Portfolio history"
        description="Deposits, withdrawals and settled returns. Cash flows and investment returns are separated."
        action={
          <Link
            to="/transactions"
            className="rounded-full px-3 py-1 text-[11px] font-medium text-[#9CA3AF] transition-colors hover:text-[#C6A15B]"
          >
            View all
          </Link>
        }
      />
      <Panel className="mt-4 p-0">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#26272B] px-5 py-3">
          <span className="inline-flex items-center gap-2 text-[11px] text-[#9CA3AF]">
            <span className="h-2 w-2 rounded-full bg-[#C6A15B]" aria-hidden="true" />
            Cash flow
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] text-[#9CA3AF]">
            <span className="h-2 w-2 rounded-full bg-[#16C784]" aria-hidden="true" />
            Investment return
          </span>
          <span className="text-[11px] text-[#6B7280]">
            Pending deposits are not counted until they are confirmed.
          </span>
        </div>

        {loading && events.length === 0 ? (
          <div className="px-5">
            <LoadingRow label="Loading your portfolio history…" />
          </div>
        ) : error && events.length === 0 ? (
          <div className="p-4">
            <ErrorRow message={error} onRetry={onRetry} />
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyState
              title="Your portfolio history will appear here once valuation records are available."
              description="Confirmed deposits, withdrawal requests and verified returns are listed together."
            />
          </div>
        ) : (
          <div className="divide-y divide-[#26272B]/60">
            {events.map((event) => {
              const isCashFlow = event.kind === "cash-flow";
              const EventIcon = isCashFlow
                ? event.title === "Withdrawal"
                  ? ArrowUpFromLine
                  : ArrowDownToLine
                : TrendingUp;
              return (
                <div key={event.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0F0F10]">
                    <EventIcon
                      className={`h-4 w-4 ${isCashFlow ? "text-[#C6A15B]" : "text-[#16C784]"}`}
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-medium text-[#F5F5F7]">{event.title}</p>
                      <span className="shrink-0 rounded-full bg-[#26272B]/60 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-[#9CA3AF]">
                        {isCashFlow ? "Cash flow" : "Return"}
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-[#6B7280]">
                      {event.detail} · {formatRelativeTime(event.timestamp)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`financial-figure text-xs ${event.amountClassName}`}>
                      {event.amountLabel}
                    </span>
                    <StatusBadge tone={event.statusTone} label={event.statusLabel} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </Section>
  );
}
