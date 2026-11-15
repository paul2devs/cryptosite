import { ChevronRight } from "lucide-react";
import {
  EmptyState,
  ErrorRow,
  ListRow,
  LoadingRow,
  Panel,
  StatusBadge,
  getToneText,
  type Tone
} from "../dashboard/primitives";
import { formatPercent, formatShortDate, formatSignedUsd, formatUsd, parseDecimalString } from "../../utils/format";
import type { DailyPerformanceHistoryRow } from "../../hooks/useDashboardData";

function toneFromValue(value: number | null): Tone {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function money(value: string, signed = false): string {
  const parsed = parseDecimalString(value);
  if (parsed === null) return "N/A";
  return signed ? formatSignedUsd(parsed) : formatUsd(parsed);
}

function valueCell(value: string | null, signed = false): string {
  if (value === null) return "Unavailable";
  return money(value, signed);
}

export function DailyPerformanceTable({
  rows,
  loading,
  error,
  onRetry,
  onSelect
}: {
  rows: DailyPerformanceHistoryRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (date: string) => void;
}) {
  return (
    <Panel>
      {loading && rows.length === 0 ? (
        <LoadingRow label="Loading daily performance…" />
      ) : error && rows.length === 0 ? (
        <ErrorRow message={error} onRetry={onRetry} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No daily performance records yet"
          description="Daily records appear once verified valuations exist. Days with incomplete data are marked unavailable, never estimated."
        />
      ) : (
        <>
          <div className="md:hidden">
            {rows.map((row) => {
              const net = parseDecimalString(row.netProfitLoss);
              const roi = parseDecimalString(row.roiPercent);
              const unrealised = parseDecimalString(row.unrealizedProfitLoss);
              return (
                <ListRow key={row.date} onClick={() => onSelect(row.date)}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="financial-figure text-sm text-[#F5F5F7]">{row.date}</span>
                      <span className="text-[10px] text-[#6B7280]">{formatShortDate(row.date)}</span>
                      <StatusBadge
                        tone={row.status === "verified" ? "positive" : "neutral"}
                        label={row.status === "verified" ? "Verified" : "Unavailable"}
                      />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#9CA3AF]">
                      <span>
                        Realised{" "}
                        <span className="financial-figure">{money(row.realizedProfitLoss, true)}</span>
                      </span>
                      <span>
                        Unrealised{" "}
                        <span
                          className={`financial-figure ${
                            row.unrealizedProfitLoss === null
                              ? "text-[#6B7280]"
                              : getToneText(toneFromValue(unrealised))
                          }`}
                        >
                          {valueCell(row.unrealizedProfitLoss, true)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <p
                        className={`financial-figure text-sm font-medium ${getToneText(toneFromValue(net))}`}
                      >
                        {valueCell(row.netProfitLoss, true)}
                      </p>
                      <p
                        className={`financial-figure mt-0.5 text-[10px] ${getToneText(toneFromValue(roi))}`}
                      >
                        {roi === null ? "Unavailable" : formatPercent(roi, { signed: true })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#6B7280]" aria-hidden="true" />
                  </div>
                </ListRow>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-[#6B7280]">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 text-right font-medium">Opening</th>
                  <th className="px-3 py-3 text-right font-medium">Closing</th>
                  <th className="px-3 py-3 text-right font-medium">Contributions</th>
                  <th className="px-3 py-3 text-right font-medium">Withdrawals</th>
                  <th className="px-3 py-3 text-right font-medium">Realised</th>
                  <th className="px-3 py-3 text-right font-medium">Unrealised</th>
                  <th className="px-3 py-3 text-right font-medium">Net P/L</th>
                  <th className="px-3 py-3 text-right font-medium">ROI</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const net = parseDecimalString(row.netProfitLoss);
                  const roi = parseDecimalString(row.roiPercent);
                  return (
                    <tr
                      key={row.date}
                      onClick={() => onSelect(row.date)}
                      className="cursor-pointer border-t border-[#26272B]/60 text-xs text-[#F5F5F7] transition-colors hover:bg-[#1F2023]/50"
                    >
                      <td className="px-4 py-3">
                        <span className="financial-figure">{row.date}</span>
                        <span className="ml-2 text-[10px] text-[#6B7280]">{formatShortDate(row.date)}</span>
                      </td>
                      <td className="financial-figure px-3 py-3 text-right text-[#9CA3AF]">
                        {money(row.openingValue)}
                      </td>
                      <td className="financial-figure px-3 py-3 text-right text-[#F5F5F7]">
                        {row.closingValue === null ? "Unavailable" : money(row.closingValue)}
                      </td>
                      <td className="financial-figure px-3 py-3 text-right text-[#9CA3AF]">
                        {money(row.externalContributions)}
                      </td>
                      <td className="financial-figure px-3 py-3 text-right text-[#9CA3AF]">
                        {money(row.externalWithdrawals)}
                      </td>
                      <td className="financial-figure px-3 py-3 text-right text-[#9CA3AF]">
                        {money(row.realizedProfitLoss, true)}
                      </td>
                      <td
                        className={`financial-figure px-3 py-3 text-right ${
                          row.unrealizedProfitLoss === null
                            ? "text-[#6B7280]"
                            : getToneText(toneFromValue(parseDecimalString(row.unrealizedProfitLoss)))
                        }`}
                      >
                        {valueCell(row.unrealizedProfitLoss, true)}
                      </td>
                      <td
                        className={`financial-figure px-3 py-3 text-right ${getToneText(toneFromValue(net))}`}
                      >
                        {valueCell(row.netProfitLoss, true)}
                      </td>
                      <td
                        className={`financial-figure px-3 py-3 text-right ${getToneText(toneFromValue(roi))}`}
                      >
                        {roi === null ? "Unavailable" : formatPercent(roi, { signed: true })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StatusBadge
                          tone={row.status === "verified" ? "positive" : "neutral"}
                          label={row.status === "verified" ? "Verified" : "Unavailable"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
