import { Panel, ProgressBar, Section, SectionHeader, Stat, StatStrip } from "../dashboard/primitives";
import { formatUsd, parseDecimalString } from "../../utils/format";
import type { MembershipData } from "../../hooks/useMembershipData";
import { SolidArrowRight, SolidCheck, SolidTrendingUp } from "../icons/SolidIcons";
import { TierEmblem } from "./TierEmblem";

export function ProgressToNextTier({ data }: { data: MembershipData }) {
  const { current, next } = data;
  const qualifying = parseDecimalString(data.qualifyingAmount);
  const remaining = parseDecimalString(data.remainingToNext);
  const nextMin = next ? parseDecimalString(next.minAmount) : null;
  const progress = Math.max(0, Math.min(100, Number.isFinite(data.progressPercent) ? data.progressPercent : 0));
  const highest = data.topTierReached || !next;
  const currentOrder = current
    ? Math.max(
        0,
        data.tiers.findIndex((tier) => tier.tierId === current.tierId)
      )
    : 0;
  const nextTier = next ? data.tiers.find((tier) => tier.tierId === next.tierId) ?? null : null;
  const nextOrder = nextTier ? nextTier.sortOrder : currentOrder + 1;

  return (
    <Section id="membership-progress">
      <Panel className="space-y-5">
        <SectionHeader
          eyebrow="Progress"
          title={highest ? "Highest tier reached" : `Progress to ${next?.name ?? "next tier"}`}
          action={highest ? <SolidTrendingUp className="h-4 w-4 text-[#16C784]" /> : null}
        />

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center sm:w-20">
            <TierEmblem tierName={current?.name ?? "Unassigned"} order={currentOrder} size="sm" />
            <span className="w-full truncate text-[11px] font-medium text-[#F5F5F7]">
              {current?.name ?? "No tier"}
            </span>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-[#9CA3AF]">
                {highest ? "Fully qualified" : `${progress.toFixed(1)}% complete`}
              </span>
              {!highest && remaining !== null ? (
                <span className="financial-figure shrink-0 text-[#C6A15B]">
                  {formatUsd(Math.max(0, remaining))} to go
                </span>
              ) : (
                <span className="financial-figure shrink-0 text-[#16C784]">100%</span>
              )}
            </div>
            <ProgressBar value={highest ? 100 : progress} tone={highest ? "positive" : "gold"} />
          </div>

          {highest ? (
            <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center sm:w-20">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16C784]/12 text-[#16C784]">
                <SolidCheck className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-medium text-[#16C784]">Top tier</span>
            </div>
          ) : (
            <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center sm:w-20">
              <TierEmblem tierName={next?.name ?? "Next"} order={nextOrder} locked size="sm" />
              <span className="w-full truncate text-[11px] font-medium text-[#9CA3AF]">
                {next?.name ?? "—"}
              </span>
            </div>
          )}
        </div>

        <StatStrip>
          <Stat
            label="Qualifying amount"
            value={qualifying === null ? "Pending" : formatUsd(qualifying)}
            hint={data.qualificationMetric.label}
          />
          <Stat
            label={highest ? "Tier floor" : `${next?.name ?? "Next"} threshold`}
            value={
              highest
                ? current
                  ? `$${current.minAmount}+`
                  : "—"
                : nextMin === null
                ? "—"
                : formatUsd(nextMin)
            }
          />
          <Stat
            label="Remaining"
            value={highest ? "—" : remaining === null ? "—" : formatUsd(Math.max(0, remaining))}
            tone={highest || (remaining !== null && remaining <= 0) ? "positive" : "gold"}
          />
        </StatStrip>

        {!highest && data.nextTierBenefits.length > 0 ? (
          <div className="space-y-2 pt-4 hairline-t">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              Unlocks at {next?.name}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
              {data.nextTierBenefits.map((benefit) => (
                <li
                  key={benefit.benefitId}
                  className="flex items-center gap-1.5 text-[11px] text-[#F5F5F7]"
                >
                  <SolidArrowRight className="h-3 w-3 shrink-0 text-[#C6A15B]" />
                  {benefit.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!data.qualifyingComplete ? (
          <p className="text-[11px] leading-relaxed text-[#C6A15B]">
            Some confirmed deposits cannot be priced yet, so the qualifying amount is withheld until
            every deposit can be valued.
          </p>
        ) : null}
      </Panel>
    </Section>
  );
}
