import { useEffect } from "react";
import { X } from "lucide-react";
import {
  Divider,
  ErrorRow,
  LoadingRow,
  Stat,
  StatStrip,
  StatusBadge,
  type Tone
} from "../dashboard/primitives";
import { formatDateTime, formatPercent, formatSignedUsd, formatUsd, parseDecimalString } from "../../utils/format";
import type { PerformanceDailyDetail } from "../../hooks/usePerformancePageData";

function toneFromValue(value: number | null): Tone {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function money(value: string | null, signed = false): string {
  const parsed = parseDecimalString(value);
  if (parsed === null) return "Unavailable";
  return signed ? formatSignedUsd(parsed) : formatUsd(parsed);
}

export function DailyPerformanceDetailDrawer({
  date,
  detail,
  loading,
  error,
  onClose
}: {
  date: string | null;
  detail: PerformanceDailyDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!date) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [date, onClose]);

  if (!date) return null;

  const summary = detail?.summary ?? null;
  const roi = parseDecimalString(summary?.roiPercent ?? null);
  const net = parseDecimalString(summary?.netProfitLoss ?? null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close daily performance detail"
        onClick={onClose}
        className="absolute inset-0 bg-[#0F0F10]/70 backdrop-blur-sm"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#26272B] bg-[#17181A] shadow-2xl sm:max-w-lg">
        <header className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#6B7280]">Daily performance</p>
            <p className="financial-figure truncate text-sm font-medium text-[#F5F5F7]">{date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="btn btn-ghost shrink-0 p-1.5"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <Divider />

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <LoadingRow label="Loading day detail…" />
          ) : error ? (
            <ErrorRow message={error} />
          ) : detail ? (
            <div className="space-y-6">
              {summary ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge
                      tone={summary.status === "verified" ? "positive" : "neutral"}
                      label={summary.status === "verified" ? "Verified" : "Unavailable"}
                    />
                    {summary.source ? (
                      <span className="truncate text-[10px] text-[#6B7280]">{summary.source}</span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Stat label="Opening value" value={money(summary.openingValue)} />
                    <Stat label="Closing value" value={money(summary.closingValue)} />
                    <Stat label="External contributions" value={`+${money(summary.externalContributions)}`} />
                    <Stat label="External withdrawals" value={`-${money(summary.externalWithdrawals)}`} />
                    <Stat label="Realised P/L" value={money(summary.realizedProfitLoss, true)} />
                    <Stat
                      label="Unrealised P/L"
                      value={money(summary.unrealizedProfitLoss, true)}
                      tone={toneFromValue(parseDecimalString(summary.unrealizedProfitLoss))}
                    />
                    <Stat label="Fees & adjustments" value={money(summary.feesAndAdjustments)} />
                    <Stat
                      label="Net P/L"
                      value={money(summary.netProfitLoss, true)}
                      tone={toneFromValue(net)}
                    />
                    <Stat
                      label="Daily ROI"
                      value={roi === null ? "Unavailable" : formatPercent(roi, { signed: true })}
                      tone={toneFromValue(roi)}
                    />
                    <Stat label="Methodology" value={summary.methodology.replace(/_/g, " ")} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-[#9CA3AF]">No aggregated summary recorded for this day.</p>
              )}

              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Positions</p>
                {detail.positions.length === 0 ? (
                  <p className="text-[11px] text-[#6B7280]">No position valuations recorded for this day.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.positions.map((position) => {
                      const profit = parseDecimalString(position.profitLoss);
                      return (
                        <div
                          key={position.positionId}
                          className="card-quiet px-3 py-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-xs font-medium text-[#F5F5F7]">
                              {position.asset}
                              <span className="ml-2 font-normal text-[#6B7280]">{position.strategy}</span>
                            </span>
                            <StatusBadge
                              tone={position.verificationStatus === "verified" ? "positive" : "neutral"}
                              label={position.verificationStatus === "verified" ? "Verified" : "Unavailable"}
                            />
                          </div>
                          <StatStrip className="mt-2">
                            <Stat label="Open" value={money(position.openingValuation)} />
                            <Stat label="Close" value={money(position.closingValuation)} />
                            <Stat
                              label="P/L"
                              value={money(position.profitLoss, true)}
                              tone={toneFromValue(profit)}
                            />
                          </StatStrip>
                          <p className="mt-2 break-words text-[10px] text-[#6B7280]">
                            Source {position.dataSource}
                            {position.correctionOf ? " · correction" : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Ledger events</p>
                {detail.events.length === 0 ? (
                  <p className="text-[11px] text-[#6B7280]">No ledger events recorded on this day.</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.events.map((event) => (
                      <li key={event.entryId} className="flex items-start justify-between gap-3 text-[11px]">
                        <div className="min-w-0">
                          <p className="truncate text-[#F5F5F7]">{event.transactionType.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-[#6B7280]">{formatDateTime(event.createdAt)}</p>
                        </div>
                        <span className="financial-figure shrink-0 text-[#9CA3AF]">
                          {event.direction === "credit" ? "+" : "-"}
                          {money(event.amount)} {event.asset}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
