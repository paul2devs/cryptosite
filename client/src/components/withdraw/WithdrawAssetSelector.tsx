import { getAssetMeta } from "../portfolio/assetMeta";
import type { SupportedWithdrawalAsset } from "../../hooks/useWithdrawData";
import type { WithdrawSymbol } from "../../utils/withdraw";

export function WithdrawAssetSelector({
  assets,
  value,
  onSelect,
  disabled = false
}: {
  assets: SupportedWithdrawalAsset[];
  value: WithdrawSymbol | null;
  onSelect: (symbol: WithdrawSymbol) => void;
  disabled?: boolean;
}) {
  if (assets.length === 0) {
    return (
      <p className="rounded-xl bg-[#0F0F10] px-3 py-3 text-[11px] text-[#9CA3AF]">
        No withdrawal assets are currently available on this platform.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {assets.map((asset) => {
        const meta = getAssetMeta(asset.symbol);
        const symbol = asset.symbol as WithdrawSymbol;
        const active = symbol === value;
        return (
          <button
            key={asset.symbol}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onSelect(symbol)}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
              active
                ? "bg-[#1F2023] ring-1 ring-inset ring-[#C6A15B]/60"
                : "bg-[#0F0F10] hover:bg-[#1F2023]"
            }`}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F0F10]">
              <img src={meta.logo} alt={meta.name} className="h-5 w-5" loading="lazy" />
            </span>
            <span className="min-w-0">
              <span
                className={`block text-xs font-medium ${active ? "text-[#F5F5F7]" : "text-[#9CA3AF]"}`}
              >
                {asset.symbol}
              </span>
              <span className="block truncate text-[10px] text-[#6B7280]">{asset.name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
