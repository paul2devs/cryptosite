import { Check } from "lucide-react";
import { formatNumber } from "../../utils/format";
import type { SupportedWithdrawalNetwork } from "../../hooks/useWithdrawData";
import type { WithdrawCryptoType } from "../../utils/withdraw";

function limitsLabel(network: SupportedWithdrawalNetwork): string {
  const parts: string[] = [];
  if (network.minAmount > 0) {
    parts.push(`min ${formatNumber(network.minAmount, 8)}`);
  }
  if (network.maxAmount > 0) {
    parts.push(`max ${formatNumber(network.maxAmount, 8)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No amount limits";
}

function feeLabel(network: SupportedWithdrawalNetwork): string {
  return network.networkFee > 0
    ? `Network fee ${formatNumber(network.networkFee, 8)}`
    : "No network fee";
}

export function WithdrawNetworkSelector({
  networks,
  value,
  onChange,
  disabled = false
}: {
  networks: SupportedWithdrawalNetwork[];
  value: WithdrawCryptoType | null;
  onChange: (cryptoType: WithdrawCryptoType) => void;
  disabled?: boolean;
}) {
  if (networks.length === 0) {
    return null;
  }

  if (networks.length === 1) {
    const option = networks[0];
    return (
      <div className="flex items-center gap-2.5 rounded-xl bg-[#0F0F10] px-3 py-3">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16C784]/12">
          <Check className="h-3.5 w-3.5 text-[#16C784]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#F5F5F7]">{option.networkLabel}</p>
          <p className="text-[10px] text-[#6B7280]">
            {option.networkType} network · {feeLabel(option)} · {limitsLabel(option)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {networks.map((network) => {
        const active = network.cryptoType === value;
        return (
          <button
            key={network.cryptoType}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(network.cryptoType)}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-60 ${
              active
                ? "bg-[#1F2023] ring-1 ring-inset ring-[#C6A15B]/60"
                : "bg-[#0F0F10] hover:bg-[#1F2023]"
            }`}
          >
            <span className="min-w-0 space-y-0.5">
              <span
                className={`block text-xs font-medium ${active ? "text-[#F5F5F7]" : "text-[#9CA3AF]"}`}
              >
                {network.networkLabel}
              </span>
              <span className="block text-[10px] text-[#6B7280]">
                {network.networkType} · {feeLabel(network)}
              </span>
              <span className="block text-[10px] text-[#6B7280]">{limitsLabel(network)}</span>
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
