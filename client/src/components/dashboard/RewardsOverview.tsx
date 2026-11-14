import {
  Section,
  SectionHeader,
  StatusBadge,
  StatStrip,
  Stat,
  LoadingRow,
  Panel,
  Divider
} from "./primitives";
import { formatDateTime, formatNumber } from "../../utils/format";
import type { ActiveBonus, ProgressionResponse } from "../../hooks/useDashboardData";

export function RewardsOverview({
  progression,
  bonuses,
  loading
}: {
  progression: ProgressionResponse | null;
  bonuses: ActiveBonus[];
  loading: boolean;
}) {
  const pendingEarnings = progression?.pendingEarningsTotal ?? 0;
  const withdrawable = progression?.withdrawableBalance ?? 0;
  const locked = progression?.lockedBalance ?? 0;
  const streak = progression?.streak ?? 0;
  const combinedMultiplier = bonuses.reduce((acc, bonus) => acc * bonus.multiplier, 1);

  return (
    <Section id="rewards">
      <SectionHeader
        title="Rewards"
        description="Earnings and active multiplier bonuses applied to your account."
        action={
          <StatusBadge
            tone={bonuses.length > 0 ? "positive" : "neutral"}
            label={bonuses.length > 0 ? `${bonuses.length} active` : "No active bonus"}
          />
        }
      />
      <Panel className="mt-4 space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">Earnings</p>
          {loading && !progression ? (
            <LoadingRow label="Loading earnings…" />
          ) : (
            <StatStrip className="mt-3">
              <Stat label="Pending" value={formatNumber(pendingEarnings, 4)} tone="positive" />
              <Stat label="Withdrawable" value={formatNumber(withdrawable, 4)} />
              <Stat label="Locked" value={formatNumber(locked, 4)} />
            </StatStrip>
          )}
          {streak > 0 ? (
            <p className="mt-4 text-[11px] leading-relaxed text-[#9CA3AF]">
              You have an active {streak}-day streak. Consistent activity keeps streak-based
              multipliers applied to your earnings.
            </p>
          ) : null}
        </div>

        <Divider />

        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              Multiplier bonuses
            </p>
            {bonuses.length > 1 ? (
              <span className="financial-figure text-[11px] text-[#C6A15B]">
                Combined x{combinedMultiplier.toFixed(2)}
              </span>
            ) : null}
          </div>
          {bonuses.length === 0 ? (
            <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
              No time-limited bonuses are active. Standard multipliers apply to your account.
            </p>
          ) : (
            <div className="mt-1">
              {bonuses.map((bonus) => (
                <div key={bonus.bonus_id} className="list-row justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[#F5F5F7]">{bonus.label}</p>
                    <p className="truncate text-[10px] text-[#6B7280]">
                      Ends {formatDateTime(bonus.end_time)}
                    </p>
                  </div>
                  <span className="financial-figure shrink-0 text-sm font-medium text-[#C6A15B]">
                    x{bonus.multiplier.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </Section>
  );
}
