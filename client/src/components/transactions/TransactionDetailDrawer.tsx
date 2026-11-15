import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Eye, EyeOff, X } from "lucide-react";
import { ErrorRow, LoadingRow, StatusBadge } from "../dashboard/primitives";
import { formatDateTime, formatNumber, parseDecimalString, truncateMiddle } from "../../utils/format";
import {
  transactionDirectionTone,
  transactionStatusTone,
  type TransactionDetailResponse,
  type TransactionView
} from "../../utils/transactions";

function DetailRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-[#6B7280]">{label}</span>
      <span
        className={`min-w-0 break-words text-right text-xs text-[#F5F5F7] ${
          mono ? "font-mono" : "financial-figure"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ProtectedValue({ value, mono = true }: { value: string | null; mono?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
  }, [value]);

  if (!value) {
    return <span className="text-[#6B7280]">Not recorded</span>;
  }

  const canToggle = value.length > 16;
  const display = revealed || !canToggle ? value : truncateMiddle(value, 8, 8);

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`min-w-0 break-all ${mono ? "font-mono" : ""}`}>{display}</span>
      {canToggle ? (
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? "Hide value" : "Reveal value"}
          className="shrink-0 text-[#6B7280] transition-colors hover:text-[#C6A15B]"
        >
          {revealed ? <EyeOff className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
        </button>
      ) : null}
    </span>
  );
}

function amount(value: string | null | undefined): string {
  const parsed = parseDecimalString(value ?? null);
  return parsed === null ? "N/A" : formatNumber(parsed, 8);
}

function settleAmount(value: string | null | undefined): string {
  const parsed = parseDecimalString(value ?? null);
  if (parsed === null) return "N/A";
  return `${parsed < 0 ? "-" : ""}${formatNumber(Math.abs(parsed), 8)}`;
}

function SourceBadge({ source }: { source: TransactionDetailResponse["processingEvents"][number]["source"] }) {
  const tone = source === "audit" ? "gold" : source === "activity" ? "neutral" : "positive";
  return <StatusBadge tone={tone} label={source} />;
}

export function TransactionDetailDrawer({
  reference,
  detail,
  loading,
  error,
  onClose
}: {
  reference: string | null;
  detail: TransactionDetailResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!reference) return;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [reference, onClose]);

  if (!reference) {
    return null;
  }

  const transaction: TransactionView | null = detail?.transaction ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close transaction details"
        onClick={onClose}
        className="absolute inset-0 bg-[#0F0F10]/70 backdrop-blur-sm"
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-[#26272B] bg-[#17181A] shadow-2xl sm:max-w-lg">
        <header className="flex items-center justify-between gap-3 border-b border-[#26272B] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#6B7280]">Transaction detail</p>
            <p className="financial-figure truncate text-sm font-medium text-[#F5F5F7]">{reference}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border border-[#26272B] p-1.5 text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <LoadingRow label="Loading transaction…" />
          ) : error ? (
            <ErrorRow message={error} />
          ) : transaction ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <StatusBadge tone={transactionStatusTone(transaction.status)} label={transaction.statusLabel} />
                <StatusBadge
                  tone={transactionDirectionTone(transaction.direction)}
                  label={transaction.direction === "internal" ? "Internal" : transaction.direction === "in" ? "Inbound" : "Outbound"}
                />
              </div>

              <div className="divide-y divide-[#26272B]/60">
                <DetailRow label="Type" value={transaction.typeLabel} mono />
                <DetailRow label="Type code" value={transaction.type} mono />
                <DetailRow label="Asset" value={transaction.asset} mono />
                <DetailRow label="Requested amount" value={`${amount(transaction.amount)} ${transaction.asset}`} />
                {transaction.netAmount !== undefined && transaction.netAmount !== null ? (
                  <DetailRow
                    label="Settled amount"
                    value={`${settleAmount(transaction.netAmount)} ${transaction.asset}`}
                  />
                ) : null}
                {transaction.fees !== undefined && transaction.fees !== null ? (
                  <DetailRow label="Fees" value={`${amount(transaction.fees)} ${transaction.asset}`} />
                ) : null}
                <DetailRow label="Network" value={transaction.network ?? "Not applicable"} />
                {transaction.relatedReference ? (
                  <DetailRow label="Related" value={transaction.relatedReference} mono />
                ) : null}
              </div>

              <div className="divide-y divide-[#26272B]/60">
                <DetailRow label="Created" value={formatDateTime(transaction.createdAt)} mono />
                <DetailRow label="Updated" value={formatDateTime(transaction.updatedAt)} mono />
                <DetailRow
                  label="Completed"
                  value={transaction.completedAt ? formatDateTime(transaction.completedAt) : "Not completed"}
                  mono
                />
              </div>

              {transaction.destinationAddress || transaction.sourceAddress || transaction.txHash ? (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">On-chain</p>
                  <div className="divide-y divide-[#26272B]/60">
                    {transaction.sourceAddress ? (
                      <DetailRow label="Source" value={<ProtectedValue value={transaction.sourceAddress} />} />
                    ) : null}
                    {transaction.destinationAddress ? (
                      <DetailRow
                        label="Destination"
                        value={<ProtectedValue value={transaction.destinationAddress} />}
                      />
                    ) : null}
                    {transaction.txHash ? (
                      <DetailRow label="Hash" value={<ProtectedValue value={transaction.txHash} />} />
                    ) : null}
                  </div>
                  {transaction.explorerUrl ? (
                    <a
                      href={transaction.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#C6A15B] transition-colors hover:text-[#d8b877]"
                    >
                      View on block explorer
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  ) : transaction.txHash ? (
                    <p className="text-[11px] text-[#6B7280]">
                      No public explorer is configured for this network.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {transaction.failureReason ? (
                <div className="rounded-xl bg-[#EA3943]/8 px-3 py-2.5 text-xs text-[#EA3943]">
                  {transaction.failureReason}
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">Processing events</p>
                {detail && detail.processingEvents.length > 0 ? (
                  <ol className="space-y-3">
                    {detail.processingEvents.map((event) => (
                      <li key={event.id} className="flex gap-3">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6A15B]" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-[#F5F5F7]">{event.type.replace(/_/g, " ")}</span>
                            <SourceBadge source={event.source} />
                          </div>
                          <p className="break-words text-[10px] text-[#6B7280]">{event.detail}</p>
                          <p className="text-[10px] text-[#6B7280]">{formatDateTime(event.timestamp)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[11px] text-[#6B7280]">No processing events recorded for this transaction.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
