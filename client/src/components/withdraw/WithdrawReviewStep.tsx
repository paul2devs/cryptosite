import { StatusBadge } from "../dashboard/primitives";
import { formatNumber, truncateMiddle } from "../../utils/format";
import { CopyButton } from "../deposit/CopyButton";
import type { WithdrawFeeEstimate, WithdrawNetworkOption } from "../../utils/withdraw";

/**
 * Step 5: review the fees and the net amount before confirming. This panel is
 * read-only; the acknowledgement that submits the request lives in the final
 * confirmation step.
 */
export function WithdrawReviewStep({
  option,
  address,
  amount,
  fees,
  maturityCondition,
  processingNote
}: {
  option: WithdrawNetworkOption;
  address: string;
  amount: number;
  fees: WithdrawFeeEstimate;
  maturityCondition: string;
  processingNote: string;
}) {
  const rows: Array<{ label: string; value: string; tone?: "default" | "positive" | "muted" }> = [
    { label: "Asset", value: option.symbolLabel },
    { label: "Network", value: option.networkLabel },
    {
      label: "Requested amount",
      value: `${formatNumber(amount, option.decimals)} ${option.symbolLabel}`
    },
    {
      label: "Network fee",
      value: `${formatNumber(fees.networkFee, option.decimals)} ${option.symbolLabel}`,
      tone: "muted"
    },
    {
      label: "Platform fee",
      value: `${formatNumber(fees.platformFee, option.decimals)} ${option.symbolLabel}`,
      tone: "muted"
    },
    {
      label: "Total fee",
      value: `${formatNumber(fees.totalFee, option.decimals)} ${option.symbolLabel}`,
      tone: "muted"
    },
    {
      label: "Net amount received",
      value: `${formatNumber(fees.netAmount, option.decimals)} ${option.symbolLabel}`,
      tone: "positive"
    }
  ];

  const valueClass: Record<"default" | "positive" | "muted", string> = {
    default: "text-[#F5F5F7]",
    positive: "text-[#16C784]",
    muted: "text-[#9CA3AF]"
  };

  return (
    <div className="space-y-4">
      <dl className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-3 rounded-xl bg-[#0F0F10] px-3 py-2.5"
          >
            <dt className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">{row.label}</dt>
            <dd className={`financial-figure text-right text-xs ${valueClass[row.tone ?? "default"]}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2 rounded-xl bg-[#0F0F10] px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
            Destination address
          </span>
          <CopyButton
            value={address}
            label="Copy"
            className="inline-flex items-center gap-1 rounded-full bg-[#17181A] px-2.5 py-1 text-[10px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
          />
        </div>
        <p className="break-all font-mono text-xs text-[#F5F5F7]">
          {truncateMiddle(address, 14, 12)}
        </p>
      </div>

      <div className="space-y-2 rounded-xl bg-[#0F0F10] px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="neutral" label="Processing" />
          <span className="text-[11px] text-[#9CA3AF]">{processingNote}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{maturityCondition}</p>
        <p className="text-[11px] text-[#6B7280]">
          A withdrawal is only marked complete after the on-chain transaction is verified. An
          estimated processing window is not a confirmation of completion.
        </p>
      </div>
    </div>
  );
}
