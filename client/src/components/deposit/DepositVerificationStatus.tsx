import { Panel, StatusBadge, Metric } from "../dashboard/primitives";
import { formatDateTime, formatNumber, truncateMiddle } from "../../utils/format";
import { describeDepositStatus, depositReference, isCryptoType, getNetworkOption } from "../../utils/deposit";
import type { DepositRecord } from "../../utils/transactions";
import { CopyButton } from "./CopyButton";
import { DepositConfirmationProgress } from "./DepositConfirmationProgress";

export function DepositVerificationStatus({ deposit }: { deposit: DepositRecord }) {
  const status = describeDepositStatus(deposit.status);
  const networkLabel =
    deposit.network ??
    (isCryptoType(deposit.crypto_type)
      ? getNetworkOption(deposit.crypto_type).networkLabel
      : deposit.crypto_type);
  const isConfirmed = deposit.status === "Approved";
  const lastUpdated = deposit.approved_at ?? deposit.confirmed_at ?? deposit.timestamp;

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
            Deposit verification
          </p>
          <p className="financial-figure text-sm font-medium text-[#F5F5F7]">
            {depositReference(deposit.deposit_id)}
          </p>
          <p className="text-[11px] text-[#9CA3AF]">
            {deposit.crypto_type} · {networkLabel}
          </p>
        </div>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Metric
          label="Requested amount"
          value={`${formatNumber(deposit.amount, 8)} ${deposit.crypto_type}`}
          hint="Amount supplied with your submission"
          valueClassName="text-sm"
        />
        <Metric
          label="Verified amount"
          value={isConfirmed ? `${formatNumber(deposit.amount, 8)} ${deposit.crypto_type}` : "Awaiting confirmation"}
          hint={isConfirmed ? "Matched against the on-chain transfer" : "Backend confirms independently"}
          tone={isConfirmed ? "positive" : "gold"}
          valueClassName="text-sm"
        />
        <Metric
          label="Submitted"
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
        status={deposit.status}
      />

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
    </Panel>
  );
}
