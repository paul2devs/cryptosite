import { getAssetMeta } from "../portfolio/assetMeta";
import { formatNumber, formatUsd } from "../../utils/format";
import {
  estimateWithdrawFees,
  type AmountValidation,
  type WithdrawNetworkOption
} from "../../utils/withdraw";

function truncateToDecimals(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  const factor = Math.pow(10, decimals);
  const floored = Math.floor(value * factor) / factor;
  return floored.toFixed(decimals).replace(/\.?0+$/, "");
}

export function WithdrawAmountInput({
  option,
  value,
  onChange,
  validation,
  disabled = false,
  availableBalance,
  networkFee,
  platformFeePercent,
  minAmount,
  maxAmount,
  limitMessage
}: {
  option: WithdrawNetworkOption;
  value: string;
  onChange: (value: string) => void;
  validation: AmountValidation;
  disabled?: boolean;
  availableBalance: number;
  networkFee: number;
  platformFeePercent: number;
  minAmount: number;
  maxAmount: number;
  limitMessage: string | null;
}) {
  const meta = getAssetMeta(option.symbol);
  const effectiveMax =
    maxAmount > 0 ? Math.min(availableBalance, maxAmount) : availableBalance;
  const parsed = Number(value);
  const hasValue = validation.valid && Number.isFinite(parsed) && parsed > 0;
  const fees = hasValue
    ? estimateWithdrawFees({ amount: parsed, networkFee, platformFeePercent })
    : null;
  const showFormatError = !validation.empty && !validation.valid;

  const limitParts = [
    `Available ${formatUsd(availableBalance)}`,
    minAmount > 0 ? `min ${formatNumber(minAmount, 8)}` : null,
    maxAmount > 0 ? `max ${formatNumber(maxAmount, 8)}` : null
  ].filter((part): part is string => part !== null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="withdraw-amount"
          className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]"
        >
          Amount to withdraw
        </label>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0F0F10] px-2 py-0.5 text-[11px] font-medium text-[#F5F5F7]">
          <img src={meta.logo} alt={meta.name} className="h-3.5 w-3.5" loading="lazy" />
          {option.symbolLabel}
        </span>
      </div>

      <div className="relative">
        <input
          id="withdraw-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.00"
          aria-invalid={showFormatError || limitMessage !== null}
          className={`financial-figure w-full rounded-xl bg-[#0F0F10] px-3 py-3 pr-28 text-sm text-[#F5F5F7] outline-none ring-1 ring-inset transition-colors placeholder:text-[#4B5563] focus:ring-[#C6A15B]/70 disabled:opacity-60 ${
            showFormatError || limitMessage ? "ring-[#EA3943]/60" : "ring-[#26272B]"
          }`}
        />
        <span className="absolute inset-y-0 right-2 flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled || effectiveMax <= 0}
            onClick={() => onChange(truncateToDecimals(effectiveMax, option.decimals))}
            className="rounded-full bg-[#17181A] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#C6A15B] transition-colors hover:bg-[#1F2023] disabled:opacity-50"
          >
            Max
          </button>
          <span className="rounded-full bg-[#17181A] px-2 py-1 text-[11px] font-medium text-[#F5F5F7]">
            {option.symbolLabel}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6B7280]">
        <span>{limitParts.join(" · ")}</span>
        <span>Up to {option.decimals} decimals</span>
      </div>

      {showFormatError && validation.message ? (
        <p className="text-[11px] text-[#EA3943]">{validation.message}</p>
      ) : limitMessage ? (
        <p className="text-[11px] text-[#EA3943]">{limitMessage}</p>
      ) : (
        <p className="text-[11px] text-[#6B7280]">
          Your request is validated server-side against your available balance and the network limits.
        </p>
      )}

      {fees ? (
        <div className="space-y-1.5 rounded-xl bg-[#0F0F10] px-3 py-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#9CA3AF]">Requested amount</span>
            <span className="financial-figure text-[#F5F5F7]">
              {formatNumber(parsed, option.decimals)} {option.symbolLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#9CA3AF]">Network fee</span>
            <span className="financial-figure text-[#9CA3AF]">
              {formatNumber(fees.networkFee, option.decimals)} {option.symbolLabel}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#9CA3AF]">
              Platform fee{platformFeePercent > 0 ? ` (${platformFeePercent}%)` : ""}
            </span>
            <span className="financial-figure text-[#9CA3AF]">
              {formatNumber(fees.platformFee, option.decimals)} {option.symbolLabel}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1.5 text-[11px] shadow-[inset_0_1px_0_0_#26272B]">
            <span className="text-[#F5F5F7]">Estimated net received</span>
            <span className="financial-figure font-medium text-[#16C784]">
              {formatNumber(fees.netAmount, option.decimals)} {option.symbolLabel}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
