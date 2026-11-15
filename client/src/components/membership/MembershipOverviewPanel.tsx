import { Panel, Section, SectionHeader, Stat, StatStrip, StatusBadge } from "../dashboard/primitives";
import { formatDateTime, formatUsd, parseDecimalString } from "../../utils/format";
import type { MembershipData } from "../../hooks/useMembershipData";
import { SolidCheck } from "../icons/SolidIcons";
import { TierEmblem } from "./TierEmblem";

export function MembershipOverviewPanel({ data }: { data: MembershipData }) {
  const { current, next, status } = data;
  const qualifying = parseDecimalString(data.qualifyingAmount);
  const remaining = parseDecimalString(data.remainingToNext);
  const currentOrder = current
    ? Math.max(
        0,
        data.tiers.findIndex((tier) => tier.tierId === current.tierId)
      )
    : 0;
  const tierRange = current
    ? current.maxAmount
      ? `$${current.minAmount} – $${current.maxAmount}`
      : `$${current.minAmount}+`
    : "N/A";

  return (
    <Section id="membership-overview">
      <Panel className="space-y-5">
        <SectionHeader
          eyebrow="Membership"
          title="Your standing"
          action={
            <StatusBadge
              tone={current ? (current.source === "admin" ? "gold" : "positive") : "neutral"}
              label={status.label}
            />
          }
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <TierEmblem tierName={current?.name ?? "Unassigned"} order={currentOrder} size="lg" />
          <div className="min-w-0 space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">Current tier</p>
            <p className="display-font truncate text-xl font-semibold text-[#F5F5F7] sm:text-2xl">
              {current?.name ?? "No tier assigned"}
            </p>
            <p className="text-xs leading-relaxed text-[#9CA3AF]">
              {current?.description ?? data.explanation}
            </p>
            {current ? (
              <p className="text-[11px] text-[#6B7280]">
                {current.source === "admin" ? "Assigned by the platform" : "Assigned automatically"}
                {" · Attained "}
                {current.achievedAt ? formatDateTime(current.achievedAt) : "N/A"}
              </p>
            ) : null}
          </div>
        </div>

        {current?.source === "admin" && current.manualReason ? (
          <p className="rounded-lg bg-[#C6A15B]/10 px-3 py-2 text-[11px] leading-relaxed text-[#C6A15B]">
            Platform note: {current.manualReason}
            {current.manualSetAt ? ` (${formatDateTime(current.manualSetAt)})` : ""}
          </p>
        ) : null}

        <StatStrip>
          <Stat
            label="Qualifying amount"
            value={qualifying === null ? "Pending" : formatUsd(qualifying)}
            tone={qualifying === null ? "neutral" : "gold"}
          />
          <Stat label="Tier range" value={tierRange} />
          <Stat label="Next tier" value={current?.isHighestTier ? "Highest" : next?.name ?? "N/A"} />
          <Stat
            label="Remaining"
            value={remaining === null ? "N/A" : formatUsd(Math.max(0, remaining))}
            tone={remaining !== null && remaining <= 0 ? "positive" : "neutral"}
          />
        </StatStrip>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              What your tier unlocks
            </p>
            {current?.benefits?.length ? (
              <ul className="space-y-1.5">
                {current.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-xs text-[#F5F5F7]">
                    <SolidCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C6A15B]" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#9CA3AF]">
                Benefits appear once a membership tier is assigned.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              {current?.isHighestTier ? "Highest tier reached" : `Unlocks at ${next?.name ?? "next tier"}`}
            </p>
            {current?.isHighestTier ? (
              <p className="text-xs leading-relaxed text-[#9CA3AF]">
                {current.name} is the highest tier. All platform benefits are included in your
                membership.
              </p>
            ) : data.nextTierBenefits.length > 0 ? (
              <ul className="space-y-1.5">
                {data.nextTierBenefits.map((benefit) => (
                  <li
                    key={benefit.benefitId}
                    className="flex items-start gap-2 text-xs text-[#F5F5F7]"
                  >
                    <span className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-[#6B7280]" />
                    <span>
                      {benefit.name}
                      {benefit.requiresActivation ? (
                        <span className="ml-1 text-[#6B7280]">· activation required</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#9CA3AF]">
                {next?.name ?? "The next tier"} adds no benefits beyond your current tier.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2 pt-4 hairline-t">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">Qualification</p>
          <p className="text-xs leading-relaxed text-[#F5F5F7]">
            {data.qualificationMetric.description}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {data.rules.creditedEvents.map((event) => (
              <li key={event} className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
                <SolidCheck className="h-3 w-3 text-[#16C784]" />
                {event}
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-[#6B7280]">{status.description}</p>
        </div>
      </Panel>
    </Section>
  );
}
