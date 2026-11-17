import { ProgressBar, type Tone } from "../dashboard/primitives";
import { requiredConfirmations, isCryptoType } from "../../utils/deposit";

function toneForStatus(status: string): Tone {
  const detailed = status.trim().toUpperCase();
  if (detailed === "COMPLETED" || status === "Approved") {
    return "positive";
  }
  if (detailed === "REJECTED" || detailed === "EXPIRED" || detailed === "FAILED" || status === "Rejected") {
    return "negative";
  }
  return "gold";
}

export function DepositConfirmationProgress({
  cryptoType,
  confirmations,
  status
}: {
  cryptoType: string;
  confirmations: number;
  status: string;
}) {
  const required = isCryptoType(cryptoType) ? requiredConfirmations(cryptoType) : null;
  const safeConfirmations = Number.isFinite(confirmations) && confirmations > 0 ? confirmations : 0;
  const tone = toneForStatus(status);
  const percent = required && required > 0 ? Math.min(100, (safeConfirmations / required) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
          Confirmation progress
        </p>
        <p className="financial-figure text-[11px] text-[#9CA3AF]">
          {required
            ? `${safeConfirmations} of ${required} confirmations`
            : `${safeConfirmations} confirmations`}
        </p>
      </div>
      <ProgressBar value={percent} tone={tone} />
    </div>
  );
}
