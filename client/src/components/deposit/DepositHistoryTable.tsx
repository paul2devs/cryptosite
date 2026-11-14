import { ChevronRight } from "lucide-react";
import { StatusBadge } from "../dashboard/primitives";
import { formatDateTime, formatNumber, formatShortDate, truncateMiddle } from "../../utils/format";
import { describeDepositStatus, depositReference, getNetworkOption, isCryptoType } from "../../utils/deposit";
import type { DepositRecord } from "../../utils/transactions";

function networkLabelFor(deposit: DepositRecord): string {
  if (deposit.network) {
    return deposit.network;
  }
  return isCryptoType(deposit.crypto_type)
    ? getNetworkOption(deposit.crypto_type).networkLabel
    : deposit.crypto_type;
}

export function DepositHistoryTable({
  deposits,
  selectedId,
  onSelect
}: {
  deposits: DepositRecord[];
  selectedId: string | null;
  onSelect: (deposit: DepositRecord) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_20px] gap-3 px-3 pb-2 text-[10px] uppercase tracking-[0.14em] text-[#6B7280] sm:grid">
        <span>Reference</span>
        <span>Asset · Network</span>
        <span>Amount</span>
        <span>Status</span>
        <span>Submitted</span>
        <span aria-hidden="true" />
      </div>

      <div className="space-y-2">
        {deposits.map((deposit) => {
          const status = describeDepositStatus(deposit.status);
          const reference = depositReference(deposit.deposit_id);
          const isSelected = deposit.deposit_id === selectedId;
          return (
            <button
              key={deposit.deposit_id}
              type="button"
              onClick={() => onSelect(deposit)}
              aria-pressed={isSelected}
              className={`w-full rounded-xl px-3 py-3 text-left transition-colors sm:grid sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_20px] sm:items-center sm:gap-3 ${
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
                    {deposit.tx_hash ? truncateMiddle(deposit.tx_hash, 8, 6) : "No transaction hash"}
                  </p>
                </div>
                <div className="sm:hidden">
                  <StatusBadge tone={status.tone} label={status.label} />
                </div>
              </div>

              <div className="mt-2 min-w-0 sm:mt-0">
                <p className="truncate text-xs text-[#F5F5F7]">{deposit.crypto_type}</p>
                <p className="truncate text-[10px] text-[#6B7280]">{networkLabelFor(deposit)}</p>
              </div>

              <div className="mt-2 sm:mt-0">
                <p className="financial-figure text-xs text-[#F5F5F7]">
                  {formatNumber(deposit.amount, 8)}{" "}
                  <span className="text-[10px] text-[#6B7280]">{deposit.crypto_type}</span>
                </p>
              </div>

              <div className="mt-2 hidden sm:mt-0 sm:block">
                <StatusBadge tone={status.tone} label={status.label} />
              </div>

              <div className="mt-2 text-[11px] text-[#9CA3AF] sm:mt-0">
                <span className="sm:hidden">{formatDateTime(deposit.timestamp)}</span>
                <span className="hidden sm:inline">{formatShortDate(deposit.timestamp)}</span>
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
