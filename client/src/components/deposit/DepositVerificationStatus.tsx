import { Panel, StatusBadge, Metric, type Tone } from "../dashboard/primitives";
import { formatDateTime, formatNumber, truncateMiddle } from "../../utils/format";
import { describeDepositStatus, depositReference, isCryptoType, getNetworkOption } from "../../utils/deposit";
import type { DepositRecord } from "../../utils/transactions";
import { CopyButton } from "./CopyButton";
import { DepositConfirmationProgress } from "./DepositConfirmationProgress";

export function DepositVerificationStatus({ deposit }: { deposit: DepositRecord }) {
  const view = deposit.status_view ?? describeDepositStatus(deposit.detailed_status || deposit.status);
  const networkLabel =
    deposit.network ??
    (isCryptoType(deposit.crypto_type)
      ? getNetworkOption(deposit.crypto_type).networkLabel
      : deposit.crypto_type);
  const isCompleted = String(deposit.detailed_status || "").toUpperCase() === "COMPLETED";
  const awaitingApproval = String(deposit.detailed_status || "").toUpperCase() === "AWAITING_ADMIN_APPROVAL";
  const lastUpdated =
    deposit.approved_at ?? deposit.verified_at ?? deposit.reviewed_at ?? deposit.timestamp;
  const reference = depositReference(deposit);

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
            Deposit verification
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="financial-figure text-sm font-medium text-[#F5F5F7]">{reference}</p>
            <CopyButton value={reference} label="Copy reference" />
          </div>
          <p className="text-[11px] text-[#9CA3AF]">
            {deposit.crypto_type} · {networkLabel}
          </p>
        </div>
        <StatusBadge tone={view.tone as Tone} label={view.label} />
      </div>

      <p className="rounded-xl bg-[#0F0F10] px-3 py-2.5 text-[11px] leading-relaxed text-[#9CA3AF]">
        {view.message}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Metric
          label="Expected amount"
          value={`${formatNumber(deposit.amount, 8)} ${deposit.crypto_type}`}
          hint="Amount this deposit is matched against"
          valueClassName="text-sm"
        />
        <Metric
          label="Received amount"
          value={
            deposit.received_amount !== null && deposit.received_amount !== undefined
              ? `${formatNumber(deposit.received_amount, 8)} ${deposit.crypto_type}`
              : "Not detected yet"
          }
          hint={
            isCompleted
              ? "Matched against the on-chain transfer"
              : "Read from the chain when a transfer is detected"
          }
          tone={isCompleted ? "positive" : "gold"}
          valueClassName="text-sm"
        />
        <Metric
          label="Requested"
          value={formatDateTime(deposit.timestamp)}
          valueClassName="text-sm"
        />
        <Metric
          label="Last updated"
          value={formatDateTime(lastUpdated)}
          valueClassName="text-sm"
        />
      </div>

      <DepositConfirmationProgress
        cryptoType={deposit.crypto_type}
        confirmations={deposit.confirmation_count}
        status={deposit.detailed_status || deposit.status}
      />

      {deposit.memo ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0F0F10] px-3 py-2.5">
          <div className="min-w-0 space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              {deposit.memo_label ?? "Memo"}
            </p>
            <p className="break-all font-mono text-[11px] text-[#9CA3AF]">{deposit.memo}</p>
          </div>
          <CopyButton value={deposit.memo} label={`Copy ${deposit.memo_label ?? "memo"}`} />
        </div>
      ) : null}

      {deposit.tx_hash ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0F0F10] px-3 py-2.5">
          <div className="min-w-0 space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              Transaction hash
            </p>
            <p className="break-all font-mono text-[11px] text-[#9CA3AF]" title={deposit.tx_hash}>
              {truncateMiddle(deposit.tx_hash, 14, 10)}
            </p>
          </div>
          <CopyButton value={deposit.tx_hash} label="Copy hash" />
        </div>
      ) : null}

      {awaitingApproval ? (
        <p className="rounded-xl bg-[#C6A15B]/8 px-3 py-2.5 text-[11px] leading-relaxed text-[#F5F5F7]">
          Awaiting platform verification. Your wallet is credited only after this deposit passes
          platform review.
        </p>
      ) : null}

      {deposit.rejection_reason ? (
        <p className="rounded-xl bg-[#EA3943]/8 px-3 py-2.5 text-[11px] leading-relaxed text-[#EA3943]">
          {deposit.rejection_reason}
        </p>
      ) : null}
    </Panel>
  );
}
