import { Check } from "lucide-react";
import {
  SYMBOL_NETWORKS,
  getNetworkOption,
  type CryptoType,
  type DepositSymbol
} from "../../utils/deposit";

export function NetworkSelector({
  symbol,
  value,
  onChange,
  disabled = false
}: {
  symbol: DepositSymbol;
  value: CryptoType;
  onChange: (cryptoType: CryptoType) => void;
  disabled?: boolean;
}) {
  const networks = SYMBOL_NETWORKS[symbol];

  if (networks.length === 1) {
    const option = getNetworkOption(networks[0]);
    return (
      <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-[#0F0F10] px-3 py-3">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16C784]/12">
          <Check className="h-3.5 w-3.5 text-[#16C784]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#F5F5F7]">{option.networkLabel}</p>
          <p className="text-[10px] text-[#6B7280]">
            {option.symbolLabel} is only supported on {option.networkLabel}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {networks.map((cryptoType) => {
        const option = getNetworkOption(cryptoType);
        const active = cryptoType === value;
        return (
          <button
            key={cryptoType}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(cryptoType)}
            className={`flex min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-60 ${
              active
                ? "bg-[#1F2023] ring-1 ring-inset ring-[#C6A15B]/60"
                : "bg-[#0F0F10] hover:bg-[#1F2023]"
            }`}
          >
            <span className="min-w-0">
              <span
                className={`block text-xs font-medium ${active ? "text-[#F5F5F7]" : "text-[#9CA3AF]"}`}
              >
                {option.networkLabel}
              </span>
              <span className="block text-[10px] text-[#6B7280]">
                {option.networkType} network
              </span>
            </span>
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                active ? "bg-[#C6A15B]/20" : "bg-[#26272B]/60"
              }`}
              aria-hidden="true"
            >
              {active ? <Check className="h-3 w-3 text-[#C6A15B]" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
