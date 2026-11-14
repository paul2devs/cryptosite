import { AlertTriangle } from "lucide-react";
import { CopyButton } from "../deposit/CopyButton";
import {
  detectWithdrawNetwork,
  type AddressValidation,
  type WithdrawNetworkOption
} from "../../utils/withdraw";

const NETWORK_LABELS: Record<string, string> = {
  BTC: "Bitcoin",
  ERC20: "Ethereum (ERC20)",
  SOL: "Solana",
  TRC20: "Tron (TRC20)"
};

export function WithdrawDestinationInput({
  option,
  value,
  onChange,
  validation,
  disabled = false
}: {
  option: WithdrawNetworkOption;
  value: string;
  onChange: (value: string) => void;
  validation: AddressValidation;
  disabled?: boolean;
}) {
  const detected = detectWithdrawNetwork(value);
  const mismatchNetwork =
    detected && detected !== option.networkType ? (NETWORK_LABELS[detected] ?? detected) : null;
  const showFormatError = !validation.empty && !validation.valid;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="withdraw-address"
          className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]"
        >
          Destination wallet address
        </label>
        <span className="rounded-full bg-[#0F0F10] px-2 py-0.5 text-[11px] font-medium text-[#F5F5F7]">
          {option.networkLabel}
        </span>
      </div>

      <div className="relative">
        <input
          id="withdraw-address"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Paste your ${option.symbolLabel} (${option.networkLabel}) address`}
          aria-invalid={showFormatError || mismatchNetwork !== null}
          className={`w-full rounded-xl bg-[#0F0F10] px-3 py-3 pr-24 font-mono text-xs text-[#F5F5F7] outline-none ring-1 ring-inset transition-colors placeholder:font-sans placeholder:text-[#4B5563] focus:ring-[#C6A15B]/70 disabled:opacity-60 ${
            showFormatError || mismatchNetwork ? "ring-[#EA3943]/60" : "ring-[#26272B]"
          }`}
        />
        {value.trim().length > 0 ? (
          <span className="absolute inset-y-0 right-2 flex items-center">
            <CopyButton
              value={value.trim()}
              className="inline-flex items-center gap-1 rounded-full bg-[#17181A] px-2.5 py-1.5 text-[11px] text-[#9CA3AF] ring-1 ring-inset ring-[#26272B] transition-colors hover:text-[#F5F5F7]"
            />
          </span>
        ) : null}
      </div>

      {mismatchNetwork ? (
        <div className="flex items-start gap-2 rounded-xl bg-[#EA3943]/8 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#EA3943]" aria-hidden="true" />
          <p className="text-[11px] text-[#EA3943]">
            This address looks like a {mismatchNetwork} address, but you selected{" "}
            {option.networkLabel}. Sending to the wrong network can permanently lose your funds.
          </p>
        </div>
      ) : showFormatError && validation.message ? (
        <p className="text-[11px] text-[#EA3943]">{validation.message}</p>
      ) : (
        <p className="text-[11px] text-[#6B7280]">
          Enter an address on the {option.networkLabel} network. The address must match the selected
          asset and network exactly.
        </p>
      )}
    </div>
  );
}
