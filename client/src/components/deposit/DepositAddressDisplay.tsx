import { CopyButton } from "./CopyButton";

export function DepositAddressDisplay({
  address,
  networkLabel
}: {
  address: string;
  networkLabel: string;
}) {
  if (!address) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
          Deposit address · {networkLabel}
        </p>
        <CopyButton value={address} label="Copy address" />
      </div>
      <div className="min-w-0 rounded-xl bg-[#0F0F10] px-3 py-2.5">
        <p className="no-scrollbar min-w-0 overflow-x-auto break-all font-mono text-[11px] leading-relaxed text-[#F5F5F7]">
          {address}
        </p>
      </div>
    </div>
  );
}
