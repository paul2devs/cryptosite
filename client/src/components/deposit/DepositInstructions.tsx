import { AlertTriangle } from "lucide-react";
import { Panel, SectionHeader, SkeletonBlock, ErrorRow } from "../dashboard/primitives";
import { formatUsd } from "../../utils/format";
import { DISCLOSURES } from "../../constants/copy";
import type { DepositAddress } from "../../hooks/useDepositData";
import type { DepositQuote } from "../../hooks/useDepositQuote";
import type { DepositNetworkOption } from "../../utils/deposit";
import { DepositQRCode } from "./DepositQRCode";
import { DepositAddressDisplay } from "./DepositAddressDisplay";

const SAFETY_WARNING = DISCLOSURES.wrongNetworkRisk;

function DetailRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
      <p className="financial-figure break-words text-sm text-[#F5F5F7]">{value}</p>
      {hint ? <p className="text-[11px] text-[#6B7280]">{hint}</p> : null}
    </div>
  );
}

export function DepositInstructions({
  option,
  address,
  quote,
  loading,
  error,
  onRetry
}: {
  option: DepositNetworkOption;
  address: DepositAddress | null;
  quote: DepositQuote | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const hasAmount = quote?.available === true && quote.cryptoAmountLabel !== null;
  const amountLabel = hasAmount ? quote!.cryptoAmountLabel! : "—";
  const amountHint = hasAmount
    ? quote!.usdAmount !== null
      ? `≈ ${formatUsd(quote!.usdAmount!)} · send exactly this amount on this network`
      : "Send exactly this amount on this network"
    : "Return to the amount step to set the deposit value";

  return (
    <Panel className="space-y-5">
      <SectionHeader
        eyebrow="Step 4"
        title="Deposit address"
        description={`Send ${option.symbolLabel} on the ${option.networkLabel} network to the address below.`}
      />

      {error && !address ? (
        <ErrorRow message={error} onRetry={onRetry} />
      ) : loading && !address ? (
        <div className="space-y-4">
          <SkeletonBlock className="mx-auto h-44 w-44 rounded-2xl" />
          <SkeletonBlock className="h-16 w-full rounded-xl" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
        </div>
      ) : !address ? (
        <div className="rounded-xl bg-[#EA3943]/8 px-3 py-3 text-xs text-[#EA3943]">
          {option.networkLabel} deposits are not available right now. Choose a different asset or
          network, or contact support.
        </div>
      ) : (
        <>
          <DepositQRCode value={address.address} symbol={option.symbol} />

          <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#0F0F10] px-3 py-3">
            <DetailRow label="Asset" value={option.symbolLabel} />
            <DetailRow
              label="Network"
              value={option.networkLabel}
              hint={`${option.networkType} network`}
            />
          </div>

          <div className="rounded-xl bg-[#0F0F10] px-3 py-3">
            <DetailRow label="Amount to send" value={amountLabel} hint={amountHint} />
          </div>

          <DepositAddressDisplay address={address.address} networkLabel={option.networkLabel} />

          <div className="flex gap-2 rounded-xl bg-[#C6A15B]/8 px-3 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-[#F5F5F7]">{SAFETY_WARNING}</p>
          </div>
        </>
      )}
    </Panel>
  );
}
