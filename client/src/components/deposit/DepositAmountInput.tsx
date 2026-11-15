import { RefreshCw } from "lucide-react";
import { getAssetMeta } from "../portfolio/assetMeta";
import { formatDateTime, formatUsd } from "../../utils/format";
import {
  depositQuickSelectUsd,
  type AmountValidation,
  type DepositNetworkOption
} from "../../utils/deposit";
import type { DepositQuote } from "../../hooks/useDepositQuote";
import { ERRORS } from "../../constants/copy";

function ConversionRow({
  label,
  value,
  hint,
  emphasise = false
}: {
  label: string;
  value: string;
  hint?: string;
  emphasise?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="text-[#9CA3AF]">{label}</span>
      <span className="min-w-0 text-right">
        <span
          className={`financial-figure block break-words ${
            emphasise ? "font-medium text-[#16C784]" : "text-[#F5F5F7]"
          }`}
        >
          {value}
        </span>
        {hint ? <span className="mt-0.5 block text-[10px] text-[#6B7280]">{hint}</span> : null}
      </span>
    </div>
  );
}

export function DepositAmountInput({
  option,
  value,
  onChange,
  validation,
  disabled = false,
  quote,
  quoteLoading,
  quoteError,
  onRefreshRate
}: {
  option: DepositNetworkOption;
  value: string;
  onChange: (value: string) => void;
  validation: AmountValidation;
  disabled?: boolean;
  quote: DepositQuote | null;
  quoteLoading: boolean;
  quoteError: string | null;
  onRefreshRate: () => void;
}) {
  const meta = getAssetMeta(option.symbol);
  const presets = depositQuickSelectUsd();
  const showFormatError = !validation.empty && !validation.valid;
  const rateAvailable = quote?.available === true && quote.rate !== null;
  const cryptoAmountLabel =
    rateAvailable && quote?.cryptoAmountLabel ? quote.cryptoAmountLabel : null;

  const parsedValue = Number(value);
  const hasValue = validation.valid && Number.isFinite(parsedValue) && parsedValue > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="deposit-amount"
          className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]"
        >
          Deposit amount (USD)
        </label>
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-[#0F0F10] px-2 py-0.5 text-[11px] font-medium text-[#F5F5F7]">
          <img src={meta.logo} alt={meta.name} className="h-3.5 w-3.5" loading="lazy" />
          {option.symbolLabel} · {option.networkLabel}
        </span>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[#6B7280]">
          $
        </span>
        <input
          id="deposit-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="3,000"
          aria-invalid={showFormatError}
          className={`financial-figure w-full rounded-xl border bg-[#0F0F10] py-3 pl-7 pr-16 text-sm text-[#F5F5F7] outline-none transition-colors placeholder:text-[#4B5563] focus:border-[#C6A15B]/70 disabled:opacity-60 ${
            showFormatError ? "border-[#EA3943]/60" : "border-[#26272B] focus:border-[#C6A15B]/70"
          }`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <span className="rounded-full bg-[#17181A] px-2 py-1 text-[11px] font-medium text-[#F5F5F7]">
            USD
          </span>
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] text-[#6B7280]">Quick select</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
          {presets.map((preset) => {
            const active = String(preset) === value.trim();
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                onClick={() => onChange(String(preset))}
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
      </div>

      {showFormatError && validation.message ? (
        <p className="text-[11px] text-[#EA3943]">{validation.message}</p>
      ) : null}

      <div className="space-y-2 rounded-xl bg-[#0F0F10] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
            Estimated conversion
          </p>
          <button
            type="button"
            onClick={onRefreshRate}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full bg-[#17181A] px-2 py-1 text-[10px] font-medium text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${quoteLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh rate
          </button>
        </div>

        {quoteError ? (
          <p className="text-[11px] text-[#EA3943]">{quoteError}</p>
        ) : !rateAvailable ? (
          <p className="text-[11px] text-[#EA3943]">
            {quote?.reason ?? "We could not calculate a conversion. Please try again shortly."}
          </p>
        ) : (
          <>
            <ConversionRow
              label="Amount to send"
              value={cryptoAmountLabel ?? "-"}
              hint={
                cryptoAmountLabel
                  ? undefined
                  : "Enter a USD amount within the deposit range to see the equivalent"
              }
            />
            <ConversionRow
              label="Exchange rate"
              value={quote?.rate !== null && quote?.rate !== undefined ? `1 ${option.symbolLabel} = ${formatUsd(quote.rate)}` : "-"}
              hint={`${option.symbolLabel}/USD`}
            />
            <ConversionRow
              label="Rate source"
              value={quote?.rateSource ?? "-"}
              hint={
                quote?.rateUpdatedAt
                  ? `Updated ${formatDateTime(quote.rateUpdatedAt)}`
                  : undefined
              }
            />
            <ConversionRow label="Deposit fee" value="None" hint={quote?.feeNote} />
            <ConversionRow
              label="Network fee"
              value="Set by the network"
              hint={quote?.networkFeeNote}
            />
            <div className="border-t border-[#26272B] pt-1.5">
              <ConversionRow
                label="Estimated amount received"
                value={quote?.estimatedReceivedLabel ?? "-"}
                emphasise
              />
            </div>
            {quote?.stale ? (
              <p className="text-[10px] leading-relaxed text-[#C6A15B]">{ERRORS.rateStale}</p>
            ) : null}
          </>
        )}
      </div>

      {hasValue && rateAvailable ? (
        <p className="text-[10px] leading-relaxed text-[#6B7280]">
          You deposit {formatUsd(parsedValue)}. We convert it at the verified rate above; the
          crypto amount shown is what you transfer on the {option.networkLabel} network.
        </p>
      ) : null}
    </div>
  );
}
