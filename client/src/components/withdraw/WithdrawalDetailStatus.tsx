import { Panel, StatusBadge } from "../dashboard/primitives";
import { formatDateTime, formatNumber, truncateMiddle } from "../../utils/format";
import { resolveWithdrawalLifecycleState, withdrawalReference } from "../../utils/withdraw";
import { CopyButton } from "../deposit/CopyButton";
import type { WithdrawalRecord } from "../../utils/transactions";
import { describeWithdrawalStatus } from "./WithdrawalHistoryTable";

export function WithdrawalDetailStatus({ withdrawal }: { withdrawal: WithdrawalRecord }) {
  const stateKey = resolveWithdrawalLifecycleState(withdrawal.status, withdrawal.detailed_status);
  const status = describeWithdrawalStatus(withdrawal.status, withdrawal.detailed_status);
  const completed = stateKey === "completed";
  const declined = stateKey === "rejected" || stateKey === "failed";
  const reference = withdrawalReference(withdrawal.withdrawal_id);

  const rows: Array<{ label: string; value: string }> = [
    { label: "Reference", value: reference },
    { label: "Requested amount", value: formatNumber(Number(withdrawal.amount), 8) },
    { label: "Asset", value: withdrawal.asset ?? "—" },
    { label: "Network", value: withdrawal.network ?? "—" },
    {
      label: "Destination",
      value: withdrawal.destination_address
        ? truncateMiddle(withdrawal.destination_address, 10, 8)
        : "—"
    },
    { label: "Requested", value: formatDateTime(withdrawal.timestamp) },
    { label: "Last updated", value: formatDateTime(withdrawal.processed_at) },
    { label: "Completed", value: completed ? formatDateTime(withdrawal.processed_at) : "Not yet completed" }
  ];

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#6B7280]">Withdrawal detail</p>
          <p className="financial-figure truncate text-sm font-medium text-[#F5F5F7]">
            {reference}
          </p>
        </div>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 rounded-xl bg-[#0F0F10] px-3 py-2.5">
            <dt className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{row.label}</dt>
            <dd className="financial-figure mt-0.5 break-all text-xs text-[#F5F5F7]">{row.value}</dd>
          </div>
        ))}
      </dl>

      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-[#0F0F10] px-3 py-2.5">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">Network fee</dt>
          <dd className="financial-figure mt-0.5 text-xs text-[#9CA3AF]">
            {formatNumber(Number(withdrawal.network_fee || 0), 8)}
          </dd>
        </div>
        <div className="min-w-0 rounded-xl bg-[#0F0F10] px-3 py-2.5">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">Platform fee</dt>
          <dd className="financial-figure mt-0.5 text-xs text-[#9CA3AF]">
            {formatNumber(Number(withdrawal.platform_fee || 0), 8)}
          </dd>
        </div>
      </dl>

      <div className="space-y-2 rounded-xl bg-[#0F0F10] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">Transaction hash</p>
          {withdrawal.tx_hash ? (
            <CopyButton
              value={withdrawal.tx_hash}
              label="Copy hash"
              className="inline-flex items-center gap-1 rounded-full bg-[#17181A] px-2.5 py-1 text-[10px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
            />
          ) : null}
        </div>
        <p className="break-all font-mono text-[11px] text-[#F5F5F7]">
          {withdrawal.tx_hash ?? "Not yet broadcast on-chain"}
        </p>
      </div>

      {withdrawal.review_reason ? (
        <div className="space-y-1 rounded-xl bg-[#0F0F10] px-3 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
            {declined ? "Reason" : "Review note"}
          </p>
          <p
            className={`text-[11px] leading-relaxed ${
              declined ? "text-[#EA3943]" : "text-[#9CA3AF]"
            }`}
          >
            {withdrawal.review_reason}
          </p>
        </div>
      ) : null}
    </Panel>
  );
}
