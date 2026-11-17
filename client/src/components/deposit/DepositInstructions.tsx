import { AlertTriangle, BadgeCheck, Loader2, RefreshCw, Send } from "lucide-react";
import { Panel, SectionHeader, StatusBadge, ErrorRow, type Tone } from "../dashboard/primitives";
import { formatDateTime, formatUsd } from "../../utils/format";
import { DISCLOSURES } from "../../constants/copy";
import { validateTxHashInput } from "../../utils/deposit";
import type { DepositRecord } from "../../utils/transactions";
import type { DepositPaymentInstructions } from "../../hooks/useDepositData";
import type { DepositNetworkOption } from "../../utils/deposit";
import { CopyButton } from "./CopyButton";
import { DepositQRCode } from "./DepositQRCode";
import { DepositAddressDisplay } from "./DepositAddressDisplay";
import { TransactionHashInput } from "./TransactionHashInput";

const SAFETY_WARNING = DISCLOSURES.wrongNetworkRisk;

const TERMINAL_STATUSES = ["COMPLETED", "REJECTED", "EXPIRED", "FAILED"];

function DetailRow({
  label,
  value,
  hint,
  copyValue,
  copyLabel,
  required = false
}: {
  label: string;
  value: string;
  hint?: string;
  copyValue?: string;
  copyLabel?: string;
  required?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
          {label}
          {required ? (
            <span className="rounded-full bg-[#C6A15B]/15 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-[#C6A15B]">
              Required
            </span>
          ) : null}
        </p>
        {copyValue && copyLabel ? <CopyButton value={copyValue} label={copyLabel} /> : null}
      </div>
      <p className="financial-figure break-words text-sm text-[#F5F5F7]">{value}</p>
      {hint ? <p className="text-[11px] text-[#6B7280]">{hint}</p> : null}
    </div>
  );
}

export function DepositInstructions({
  deposit,
  instructions,
  option,
  txHash,
  onTxHashChange,
  onSubmitHash,
  onRescan,
  submitting,
  scanning,
  message,
  error
}: {
  deposit: DepositRecord;
  instructions: DepositPaymentInstructions;
  option: DepositNetworkOption;
  txHash: string;
  onTxHashChange: (value: string) => void;
  onSubmitHash: () => void;
  onRescan: () => void;
  submitting: boolean;
  scanning: boolean;
  message: string | null;
  error: string | null;
}) {
  const tone = (deposit.status_view?.tone ?? "gold") as Tone;
  const statusLabel = deposit.status_view?.label ?? instructions.status.label;
  const statusMessage = deposit.status_view?.message ?? instructions.status.message;
  const detailed = String(deposit.detailed_status || instructions.status.detailed);
  const terminal = TERMINAL_STATUSES.includes(detailed);
  const awaitingApproval = detailed === "AWAITING_ADMIN_APPROVAL";

  const txValidation = validateTxHashInput(txHash);
  const memoSupported = instructions.memoSupported === true;
  const memoLabel = instructions.memoLabel ?? "Memo";
  const displayMemo = instructions.memo && instructions.memo.length > 0 ? instructions.memo : null;

  return (
    <div className="min-w-0 space-y-6">
      <Panel className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionHeader
            eyebrow="Step 4"
            title="Payment details"
            description={`Send exactly the amount shown to the address below on the ${instructions.networkLabel} network.`}
          />
          <StatusBadge tone={tone} label={statusLabel} />
        </div>

        <div className="rounded-xl bg-[#0F0F10] px-3 py-3">
          <p className="text-[11px] leading-relaxed text-[#F5F5F7]">{statusMessage}</p>
        </div>

        <DepositQRCode value={instructions.receivingAddress} symbol={option.symbol} />

        <div className="grid gap-4 rounded-xl bg-[#0F0F10] px-3 py-3 sm:grid-cols-2">
          <DetailRow
            label="Cryptocurrency"
            value={instructions.symbol}
            hint={instructions.networkLabel}
          />
          <DetailRow
            label="Network"
            value={instructions.networkLabel}
            hint={`${instructions.networkType} network`}
          />
          <DetailRow
            label="Amount to send"
            value={instructions.amountToSendLabel}
            hint={
              instructions.usdAmount !== null
                ? `≈ ${formatUsd(instructions.usdAmount)} at the rate we quoted`
                : "Send exactly this amount on this network"
            }
          />
          <DetailRow
            label="Deposit reference"
            value={instructions.reference}
            hint="Quote this reference to support"
            copyValue={instructions.reference}
            copyLabel="Copy reference"
          />
        </div>

        <DepositAddressDisplay
          address={instructions.receivingAddress}
          networkLabel={instructions.networkLabel}
        />

        {memoSupported ? (
          <DetailRow
            label={memoLabel}
            value={displayMemo ?? "Not yet assigned"}
            hint={
              instructions.memoRequired
                ? instructions.memoGuidance ??
                  `You must include this ${memoLabel} with your transfer for it to be matched.`
                : instructions.memoGuidance ??
                  `Include this ${memoLabel} with your transfer if it is requested.`
            }
            copyValue={displayMemo ?? undefined}
            copyLabel={`Copy ${memoLabel}`}
            required={instructions.memoRequired}
          />
        ) : (
          <p className="text-[11px] leading-relaxed text-[#6B7280]">
            {instructions.networkLabel} does not use a memo or destination tag. Do not add one —
            this transfer is matched by the receiving address and the exact amount.
          </p>
        )}

        <div className="flex gap-2 rounded-xl bg-[#C6A15B]/8 px-3 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-[#F5F5F7]">
            {instructions.networkWarning || SAFETY_WARNING}
          </p>
        </div>

        <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
          {instructions.sendingInstruction}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0F0F10] px-3 py-2.5 text-[11px] text-[#9CA3AF]">
          <span>
            {instructions.minConfirmations} confirmation
            {instructions.minConfirmations === 1 ? "" : "s"} required on{" "}
            {instructions.networkLabel}
          </span>
          <span>Created {formatDateTime(instructions.createdAt)}</span>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <SectionHeader
          eyebrow="Verification"
          title="Confirm your payment"
          description="Paste the transaction hash from your wallet or a block explorer. We verify it independently on-chain before it can be approved."
        />

        {awaitingApproval ? (
          <div className="flex gap-2 rounded-xl bg-[#C6A15B]/8 px-3 py-3">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-[#F5F5F7]">
              Verified on-chain and now awaiting verification and admin approval. Your wallet is
              credited only after an administrator approves this deposit.
            </p>
          </div>
        ) : null}

        {detailed === "DETECTED" || detailed === "CONFIRMING" ? (
          <p className="rounded-xl bg-[#0F0F10] px-3 py-2.5 text-[11px] text-[#9CA3AF]">
            We are tracking {deposit.confirmation_count} confirmation
            {deposit.confirmation_count === 1 ? "" : "s"} for this transaction.
          </p>
        ) : null}

        {deposit.rejection_reason ? (
          <p className="rounded-xl bg-[#EA3943]/8 px-3 py-2.5 text-[11px] text-[#EA3943]">
            {deposit.rejection_reason}
          </p>
        ) : null}

        {!terminal ? (
          <>
            <TransactionHashInput
              option={option}
              value={txHash}
              onChange={(next) => onTxHashChange(next)}
              validation={txValidation}
              disabled={submitting}
            />

            {message ? (
              <p className="rounded-xl bg-[#16C784]/8 px-3 py-2.5 text-[11px] text-[#F5F5F7]">
                {message}
              </p>
            ) : null}

            {error ? <ErrorRow message={error} /> : null}

            <div className="buttons-row sm:flex sm:flex-row sm:items-center sm:gap-2">
              <button
                type="button"
                onClick={onSubmitHash}
                disabled={!txValidation.valid || submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C6A15B] px-4 py-3 text-sm font-medium text-[#0F0F10] transition-colors hover:bg-[#D4B070] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{submitting ? "Verifying…" : "Submit transaction hash"}</span>
              </button>

              <button
                type="button"
                onClick={onRescan}
                disabled={scanning}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#17181A] px-4 py-3 text-sm font-medium text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-60 sm:w-auto"
              >
                <RefreshCw
                  className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>Check status</span>
              </button>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-[#6B7280]">{DISCLOSURES.depositsNotCredited}</p>
        )}
      </Panel>
    </div>
  );
}
