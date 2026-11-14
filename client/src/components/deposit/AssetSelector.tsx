import { getAssetMeta } from "../portfolio/assetMeta";
import { DEPOSIT_SYMBOLS, type DepositSymbol } from "../../utils/deposit";

export function AssetSelector({
  value,
  onSelect,
  disabled = false
}: {
  value: DepositSymbol;
  onSelect: (symbol: DepositSymbol) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {DEPOSIT_SYMBOLS.map(({ symbol, name }) => {
        const meta = getAssetMeta(symbol);
        const active = symbol === value;
        return (
          <button
            key={symbol}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onSelect(symbol)}
            className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${
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
                {symbol}
              </span>
              <span className="block truncate text-[10px] text-[#6B7280]">{name}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
