import { getAssetMeta } from "../portfolio/assetMeta";
import { formatNumber, formatUsd } from "../../utils/format";
import {
  depositQuickSelectUsd,
  usdToCryptoAmount,
  type AmountValidation,
  type DepositNetworkOption
} from "../../utils/deposit";

export function DepositAmountInput({
  option,
  value,
  onChange,
  validation,
  disabled = false,
  usdPrice,
  priceLoading = false,
  priceError = null,
  limitMessage = null
}: {
  option: DepositNetworkOption;
  value: string;
  onChange: (value: string) => void;
  validation: AmountValidation;
  disabled?: boolean;
  usdPrice: number | null;
  priceLoading?: boolean;
  priceError?: string | null;
  limitMessage?: string | null;
}) {
  const meta = getAssetMeta(option.symbol);
  const parsed = Number(value);
  const hasValue = validation.valid && Number.isFinite(parsed) && parsed > 0;
  const amountUsd =
    hasValue && usdPrice !== null && usdPrice > 0 ? parsed * usdPrice : null;
  const showFormatError = !validation.empty && !validation.valid;
  const presets = depositQuickSelectUsd();

  const selectPreset = (usd: number) => {
    if (usdPrice === null) {
      return;
    }
    const next = usdToCryptoAmount(usd, usdPrice, option.decimals);
    if (next) {
      onChange(next);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="deposit-amount"
          className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]"
        >
          Amount to deposit
        </label>
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[#0F0F10] px-2 py-0.5 text-[11px] font-medium text-[#F5F5F7]">
          <img src={meta.logo} alt={meta.name} className="h-3.5 w-3.5" loading="lazy" />
          {option.symbolLabel} · {option.networkLabel}
        </span>
      </div>

      <div className="relative">
        <input
          id="deposit-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0.00"
          aria-invalid={showFormatError || limitMessage !== null}
          className={`financial-figure w-full rounded-xl border bg-[#0F0F10] px-3 py-3 pr-20 text-sm text-[#F5F5F7] outline-none transition-colors placeholder:text-[#4B5563] focus:border-[#C6A15B]/70 disabled:opacity-60 ${
            showFormatError || limitMessage
              ? "border-[#EA3943]/60"
              : "border-[#26272B] focus:border-[#C6A15B]/70"
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <span className="rounded-full bg-[#17181A] px-2 py-1 text-[11px] font-medium text-[#F5F5F7]">
            {option.symbolLabel}
          </span>
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-[#6B7280]">Quick select (USD value)</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {presets.map((preset) => {
            const presetAmount =
              usdPrice !== null
                ? usdToCryptoAmount(preset, usdPrice, option.decimals)
                : null;
            const active = presetAmount !== null && presetAmount === value;
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled || presetAmount === null}
                onClick={() => selectPreset(preset)}
                aria-pressed={active}
                className={`rounded-lg px-2 py-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "bg-[#C6A15B]/15 text-[#C6A15B] ring-1 ring-inset ring-[#C6A15B]/40"
                    : "bg-[#0F0F10] text-[#9CA3AF] hover:bg-[#1F2023] hover:text-[#F5F5F7]"
                }`}
              >
                {formatUsd(preset, 0)}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] leading-relaxed text-[#6B7280]">
          {usdPrice !== null
            ? "Presets are converted at the live price — the crypto amount shown above is what you transfer."
            : "Live pricing is unavailable, so presets are disabled. Enter the amount manually."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="text-[#6B7280]">
          Up to {option.decimals} decimal places · {option.networkLabel}
        </span>
        {amountUsd !== null ? (
          <span className="financial-figure text-[#9CA3AF]">≈ {formatUsd(amountUsd)}</span>
        ) : priceLoading ? (
          <span className="text-[#6B7280]">Estimating value…</span>
        ) : (
          <span className="text-[#6B7280]">
            {priceError ? "Live price unavailable" : "Enter an amount to estimate value"}
          </span>
        )}
      </div>

      {showFormatError && validation.message ? (
        <p className="text-[11px] text-[#EA3943]">{validation.message}</p>
      ) : limitMessage ? (
        <p className="text-[11px] text-[#EA3943]">{limitMessage}</p>
      ) : null}

      {hasValue ? (
        <div className="space-y-1.5 rounded-xl bg-[#0F0F10] px-3 py-3">
          <div className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-[#9CA3AF]">Amount to send</span>
            <span className="financial-figure text-right text-[#F5F5F7]">
              {formatNumber(parsed, option.decimals)} {option.symbolLabel}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-[#9CA3AF]">Estimated value</span>
            <span className="financial-figure text-right text-[#9CA3AF]">
              {amountUsd !== null ? `≈ ${formatUsd(amountUsd)}` : "Unavailable"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 text-[11px]">
            <span className="text-[#9CA3AF]">Platform deposit fee</span>
            <span className="financial-figure text-right text-[#9CA3AF]">None</span>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-[#26272B] pt-1.5 text-[11px]">
            <span className="text-[#F5F5F7]">Expected amount received</span>
            <span className="financial-figure text-right font-medium text-[#16C784]">
              {formatNumber(parsed, option.decimals)} {option.symbolLabel}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
