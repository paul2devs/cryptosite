import { useEffect, useState } from "react";
import { Panel, SectionHeader, StatusBadge, StatStrip, Stat, SkeletonBlock } from "../dashboard/primitives";
import { formatDateTime, formatShortDate, formatUsd } from "../../utils/format";
import { formatDuration } from "../../utils/withdraw";
import { maskValue } from "../portfolio/utils";
import { useBalanceVisibility } from "../BalanceVisibilityProvider";
import type { MaturityEligibility } from "../../hooks/useWithdrawData";

/**
 * Presents the disclosed contractual maturity terms that the backend actually
 * reports. Nothing here invents a lockup: when `policyInEffect` is false the
 * card states plainly that no holding period applies, and it never adds a
 * waiting period beyond the reported `expectedMaturityDate`.
 */
export function MaturityPolicyCard({
  maturity,
  loading
}: {
  maturity: MaturityEligibility | null;
  loading: boolean;
}) {
  const { hidden } = useBalanceVisibility();
  const [remaining, setRemaining] = useState<number>(maturity?.remainingSeconds ?? 0);

  useEffect(() => {
    setRemaining(maturity?.remainingSeconds ?? 0);
  }, [maturity?.remainingSeconds]);

  useEffect(() => {
    if (!maturity?.policyInEffect || maturity.remainingSeconds <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setRemaining((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [maturity?.policyInEffect, maturity?.remainingSeconds]);

  if (loading && !maturity) {
    return (
      <Panel className="space-y-4">
        <SkeletonBlock className="h-3 w-36" />
        <SkeletonBlock className="h-16 w-full rounded-xl" />
        <SkeletonBlock className="h-10 w-40 rounded-full" />
      </Panel>
    );
  }

  if (!maturity) {
    return null;
  }

  if (!maturity.policyInEffect) {
    return (
      <Panel className="space-y-3">
        <SectionHeader
          eyebrow="Maturity"
          title="No maturity period applies"
          action={<StatusBadge tone="neutral" label="No lockup" />}
        />
        <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{maturity.reason}</p>
        <p className="text-[11px] leading-relaxed text-[#6B7280]">{maturity.terms}</p>
      </Panel>
    );
  }

  const hasMaturing = maturity.maturingAmount > 0;

  return (
    <Panel className="space-y-4">
      <SectionHeader
        eyebrow="Maturity"
        title={`${maturity.lockupDays}-day maturity policy ${maturity.policyVersion}`}
        description="A disclosed investment term, not an added delay: funds received under this policy become withdrawable once the period elapses."
        action={
          <StatusBadge
            tone={hasMaturing ? "gold" : "positive"}
            label={hasMaturing ? "Holding" : "Matured"}
          />
        }
      />

      <div className="rounded-xl bg-[#0F0F10] px-3 py-3">
        <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
          Remaining maturity period
        </p>
        <p className="financial-figure mt-1 text-lg font-medium text-[#F5F5F7]">
          {hasMaturing ? formatDuration(remaining) : "Matured"}
        </p>
        <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
          {hasMaturing && maturity.expectedMaturityDate
            ? `Next maturity ${formatDateTime(maturity.expectedMaturityDate)}`
            : "All funds received under this policy have matured."}
        </p>
      </div>

      <StatStrip>
        <Stat
          label="Eligible to withdraw"
          value={maskValue(hidden, formatUsd(maturity.maturedAmount))}
          tone="positive"
          hint="Matured and available now"
        />
        <Stat
          label="Under maturity"
          value={maskValue(hidden, formatUsd(maturity.maturingAmount))}
          tone="gold"
          hint={
            maturity.expectedMaturityDate
              ? `Released ${formatShortDate(maturity.expectedMaturityDate)}`
              : "Subject to the agreed period"
          }
        />
      </StatStrip>

      <dl className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[11px] text-[#6B7280]">Maturity date</dt>
          <dd className="financial-figure text-right text-[11px] text-[#F5F5F7]">
            {formatDateTime(maturity.expectedMaturityDate)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[11px] text-[#6B7280]">Period start</dt>
          <dd className="financial-figure text-right text-[11px] text-[#F5F5F7]">
            {formatDateTime(maturity.startDate)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[11px] text-[#6B7280]">Policy</dt>
          <dd className="text-right text-[11px] text-[#F5F5F7]">
            {maturity.lockupDays} days · {maturity.policyVersion}
          </dd>
        </div>
      </dl>

      <div className="space-y-1 rounded-xl bg-[#0F0F10] px-3 py-3">
        <p className="text-[11px] text-[#F5F5F7]">{maturity.reason}</p>
        <p className="text-[11px] leading-relaxed break-words text-[#6B7280]">{maturity.terms}</p>
      </div>
    </Panel>
  );
}
