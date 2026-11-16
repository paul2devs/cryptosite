import { Loader2, RefreshCw } from "lucide-react";
import { getAssetMeta } from "../portfolio/assetMeta";
import { formatDateTime, formatUsd } from "../../utils/format";
import {
  depositQuickSelectUsd,
  type AmountValidation,
  type DepositNetworkOption
} from "../../utils/deposit";
import type { DepositQuote } from "../../hooks/useDepositQuote";
import { DEPOSIT_CONVERSION, ERRORS } from "../../constants/copy";

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

  const rate = quote?.rate ?? null;
  const rateAvailable = quote?.available === true && rate !== null;
  const cryptoAmountLabel = rateAvailable ? quote?.cryptoAmountLabel ?? null : null;
  // A rate the backend marked expired can be shown, but never as a live rate:
  // it is surfaced as unavailable until the user refreshes it.
  const showStale = quoteError === null && quote?.available === false && quote.stale === true;
  const unavailable = quoteError !== null || (quote !== null && quote.available === false);
  const showLoading = !unavailable && !rateAvailable;

  const parsedValue = Number(value);
  const hasValue = validation.valid && Number.isFinite(parsedValue) && parsedValue > 0;

  const retryDisabled = disabled || quoteLoading;

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
            disabled={retryDisabled}
            className="inline-flex items-center gap-1 rounded-full bg-[#17181A] px-2 py-1 text-[10px] font-medium text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${quoteLoading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh rate
          </button>
        </div>

        {unavailable ? (
          <div className="space-y-2 rounded-lg bg-[#EA3943]/8 px-3 py-2.5">
            <p className="text-[11px] font-medium text-[#EA3943]">
              {showStale ? ERRORS.rateStale.title : ERRORS.rateUnavailable.title}
            </p>
            <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
              {showStale ? ERRORS.rateStale.body : ERRORS.rateUnavailable.body}
            </p>
            {showStale && quote?.rateUpdatedAt ? (
              <p className="text-[10px] text-[#6B7280]">
                Last rate received {formatDateTime(quote.rateUpdatedAt)}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onRefreshRate}
              disabled={retryDisabled}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#17181A] px-2.5 py-1.5 text-[11px] font-medium text-[#F5F5F7] transition-colors hover:bg-[#1F2023] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${quoteLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {DEPOSIT_CONVERSION.retry}
            </button>
          </div>
        ) : showLoading ? (
          <div className="flex items-center gap-2 py-0.5 text-[11px] text-[#9CA3AF]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C6A15B]" aria-hidden="true" />
            {DEPOSIT_CONVERSION.fetching}
          </div>
        ) : (
          <>
            <ConversionRow
              label="Deposit amount"
              value={hasValue ? formatUsd(parsedValue) : "-"}
              hint={hasValue ? undefined : "USD value you deposit"}
            />
            <ConversionRow
              label="Exchange rate"
              value={rate !== null ? `1 ${option.symbolLabel} = ${formatUsd(rate)}` : "-"}
              hint={`${option.symbolLabel}/USD`}
            />
            <div className="border-t border-[#26272B] pt-1.5">
              <ConversionRow
                label="Estimated amount received"
                value={cryptoAmountLabel ?? "-"}
                hint={
                  hasValue
                    ? `Send exactly this amount on ${option.networkLabel}`
                    : `Enter a USD amount to see the estimated ${option.symbolLabel} you will receive`
                }
                emphasise
              />
            </div>
            <ConversionRow label="Deposit fee" value="None" hint={quote?.feeNote} />
            <ConversionRow
              label="Network fee"
              value="Set by the network"
              hint={quote?.networkFeeNote}
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
            <p className="text-[10px] leading-relaxed text-[#6B7280]">
              {DEPOSIT_CONVERSION.estimateNote}
            </p>
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
