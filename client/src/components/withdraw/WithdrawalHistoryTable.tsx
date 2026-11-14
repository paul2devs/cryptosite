import { ChevronRight } from "lucide-react";
import { StatusBadge } from "../dashboard/primitives";
import type { Tone } from "../dashboard/primitives";
import { formatDateTime, formatNumber, formatShortDate, truncateMiddle } from "../../utils/format";
import { resolveWithdrawalLifecycleState, withdrawalReference } from "../../utils/withdraw";
import type { WithdrawalRecord } from "../../utils/transactions";

export interface WithdrawalStatusView {
  label: string;
  tone: Tone;
}

/**
 * Display labels and tones for the withdrawal lifecycle states the backend
 * actually emits. `broadcast` is folded into "Processing" because the transfer
 * is not yet confirmed on-chain and must never read as complete.
 */
const WITHDRAWAL_STATE_VIEW: Record<string, WithdrawalStatusView> = {
  requested: { label: "Requested", tone: "gold" },
  under_review: { label: "Under review", tone: "gold" },
  approved: { label: "Approved", tone: "positive" },
  processing: { label: "Processing", tone: "gold" },
  broadcast: { label: "Processing", tone: "gold" },
  completed: { label: "Completed", tone: "positive" },
  rejected: { label: "Rejected", tone: "negative" },
  failed: { label: "Failed", tone: "negative" },
  cancelled: { label: "Cancelled", tone: "neutral" }
};

export function describeWithdrawalStatus(
  status: string,
  detailedStatus: string | null
): WithdrawalStatusView {
  const state = resolveWithdrawalLifecycleState(status, detailedStatus);
  return WITHDRAWAL_STATE_VIEW[state] ?? { label: "Requested", tone: "gold" };
}

function assetLabel(withdrawal: WithdrawalRecord): string {
  return withdrawal.asset ?? "—";
}

export function WithdrawalHistoryTable({
  withdrawals,
  selectedId,
  onSelect
}: {
  withdrawals: WithdrawalRecord[];
  selectedId: string | null;
  onSelect: (withdrawal: WithdrawalRecord) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_20px] gap-3 px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-[#6B7280] sm:grid">
        <span>Reference</span>
        <span>Asset · Network</span>
        <span>Amount</span>
        <span>Status</span>
        <span>Requested</span>
        <span aria-hidden="true" />
      </div>

      <div className="space-y-2">
        {withdrawals.map((withdrawal) => {
          const status = describeWithdrawalStatus(withdrawal.status, withdrawal.detailed_status);
          const reference = withdrawalReference(withdrawal.withdrawal_id);
          const isSelected = withdrawal.withdrawal_id === selectedId;
          return (
            <button
              key={withdrawal.withdrawal_id}
              type="button"
              onClick={() => onSelect(withdrawal)}
              aria-pressed={isSelected}
              className={`w-full min-w-0 rounded-xl px-3 py-3 text-left transition-colors sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_20px] sm:items-center sm:gap-3 ${
                isSelected
                  ? "bg-[#1F2023] ring-1 ring-inset ring-[#C6A15B]/50"
                  : "bg-[#0F0F10] hover:bg-[#1F2023]"
              }`}
            >
              <div className="flex items-start justify-between gap-2 sm:block">
                <div className="min-w-0 space-y-0.5">
                  <p className="financial-figure truncate text-xs font-medium text-[#F5F5F7]">
                    {reference}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[#6B7280]">
                    {withdrawal.tx_hash
                      ? truncateMiddle(withdrawal.tx_hash, 8, 6)
                      : "Awaiting on-chain broadcast"}
                  </p>
                </div>
                <div className="sm:hidden">
                  <StatusBadge tone={status.tone} label={status.label} />
                </div>
              </div>

              <div className="mt-2 min-w-0 sm:mt-0">
                <p className="truncate text-xs text-[#F5F5F7]">{assetLabel(withdrawal)}</p>
                <p className="truncate text-[10px] text-[#6B7280]">{withdrawal.network ?? "—"}</p>
              </div>

              <div className="mt-2 min-w-0 sm:mt-0">
                <p className="financial-figure truncate text-xs text-[#F5F5F7]">
                  {formatNumber(Number(withdrawal.amount), 8)}
                </p>
              </div>

              <div className="mt-2 hidden sm:mt-0 sm:block">
                <StatusBadge tone={status.tone} label={status.label} />
              </div>

              <div className="mt-2 min-w-0 text-[11px] text-[#9CA3AF] sm:mt-0">
                <span className="sm:hidden">{formatDateTime(withdrawal.timestamp)}</span>
                <span className="hidden sm:inline">{formatShortDate(withdrawal.timestamp)}</span>
              </div>

              <ChevronRight
                className={`hidden h-4 w-4 shrink-0 transition-transform sm:block ${
                  isSelected ? "rotate-90 text-[#C6A15B]" : "text-[#6B7280]"
                }`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
