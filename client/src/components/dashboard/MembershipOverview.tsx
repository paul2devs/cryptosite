import { Link } from "react-router-dom";
import {
  Section,
  SectionHeader,
  StatusBadge,
  ProgressBar,
  ErrorRow,
  LoadingRow,
  Panel
} from "./primitives";
import { formatUsd, parseDecimalString } from "../../utils/format";
import { TierEmblem } from "../membership/TierEmblem";
import type { MembershipView } from "../../hooks/useDashboardData";

export function MembershipOverview({
  membership,
  loading,
  error,
  onRetry
}: {
  membership: MembershipView | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const progress = membership ? Math.max(0, Math.min(100, membership.progressPercent || 0)) : 0;
  const qualifying = membership ? parseDecimalString(membership.qualifyingAmount) : null;
  const remaining = membership ? parseDecimalString(membership.remainingToNext) : null;
  const tiers = membership?.tiers ?? [];
  const currentOrder = membership?.current
    ? membership.current.sortOrder ??
      Math.max(0, tiers.findIndex((tier) => tier.tierId === membership.current?.tierId))
    : 0;

  return (
    <Section id="membership">
      <SectionHeader
        title="Membership"
        description="Membership reflects your aggregate qualifying volume. It is separate from investment level progression."
        action={
          <div className="flex items-center gap-3">
            {membership?.current ? (
              <StatusBadge tone="gold" label={membership.current.name} />
            ) : (
              <StatusBadge tone="neutral" label="Not yet qualified" />
            )}
            <Link
              to="/membership"
              className="text-[11px] font-medium text-[#C6A15B] transition-colors hover:text-[#E0C084]"
            >
              View membership
            </Link>
          </div>
        }
      />
      <Panel className="mt-4">
        {loading && !membership ? (
          <LoadingRow label="Loading membership…" />
        ) : error && !membership ? (
          <ErrorRow message={error} onRetry={onRetry} />
        ) : !membership ? (
          <p className="text-xs text-[#9CA3AF]">Membership information is unavailable.</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {membership.current ? (
                  <TierEmblem
                    tierName={membership.current.name}
                    order={currentOrder}
                    size="md"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">Current tier</p>
                  <p className="display-font mt-1 truncate text-lg font-semibold text-[#F5F5F7]">
                    {membership.current?.name ?? "No tier yet"}
                  </p>
                  {membership.current?.description ? (
                    <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#9CA3AF]">
                      {membership.current.description}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                  Qualifying volume
                </p>
                <p className="financial-figure mt-1 truncate text-sm text-[#F5F5F7]">
                  {qualifying === null ? "—" : formatUsd(qualifying)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
                <span className="text-[#9CA3AF]">
                  {membership.next ? `Next: ${membership.next.name}` : "Highest tier reached"}
                </span>
                <span className="text-right text-[#9CA3AF]">
                  {remaining !== null && remaining > 0
                    ? `${formatUsd(remaining)} remaining`
                    : membership.next
                    ? "Progress tracks your qualifying volume"
                    : "No higher tier"}
                </span>
              </div>
              <ProgressBar value={progress} tone="gold" />
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                {membership.current?.benefits?.length ? "Tier benefits" : "How membership works"}
              </p>
              {membership.current?.benefits?.length ? (
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {membership.current.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-[11px] text-[#F5F5F7]">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#C6A15B]" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] leading-relaxed text-[#9CA3AF]">
                  {membership.explanation}
                </p>
              )}
            </div>

            {membership.tiers.length > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">All tiers</p>
                <div className="mt-2">
                  {membership.tiers.map((tier, index) => {
                    const isCurrent = membership.current?.tierId === tier.tierId;
                    return (
                      <div key={tier.tierId} className="list-row flex-wrap justify-between gap-y-1">
                        <span className="flex min-w-0 items-center gap-2">
                          <TierEmblem
                            tierName={tier.name}
                            order={tier.sortOrder ?? index}
                            size="sm"
                          />
                          <span
                            className={`truncate text-xs font-medium ${
                              isCurrent ? "text-[#C6A15B]" : "text-[#F5F5F7]"
                            }`}
                          >
                            {tier.name}
                          </span>
                          {isCurrent ? <StatusBadge tone="gold" label="Current" /> : null}
                        </span>
                        <span className="financial-figure shrink-0 text-[11px] text-[#9CA3AF]">
                          {tier.minAmount}
                          {tier.maxAmount ? ` – ${tier.maxAmount}` : "+"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </Section>
  );
}
