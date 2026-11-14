import { EmptyState, Panel, Section, SectionHeader, StatusBadge } from "../dashboard/primitives";
import type { MembershipData } from "../../hooks/useMembershipData";
import { eligibilityLabel, eligibilityTone, rangeLabel } from "./membershipUtils";
import { TierEmblem } from "./TierEmblem";

export function TierProgression({ data }: { data: MembershipData }) {
  const tiers = [...data.tiers].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Section id="membership-tiers">
      <Panel className="space-y-4">
        <SectionHeader eyebrow="Progression" title="Tier path" />

        {tiers.length === 0 ? (
          <EmptyState
            title="No tiers configured"
            description="The platform has not published membership tiers yet."
          />
        ) : (
          <div className="min-w-0">
            <div className="no-scrollbar overflow-x-auto pb-1">
              <ol className="flex min-w-max items-start">
                {tiers.map((tier, index) => {
                  const locked = tier.state === "locked";
                  const preview = tier.benefits[0]?.name ?? tier.requirement;
                  const isLast = index === tiers.length - 1;
                  return (
                    <li key={tier.tierId} className="flex items-start">
                      <div className="flex w-[6.75rem] flex-col items-center gap-2 text-center">
                        <TierEmblem
                          tierName={tier.name}
                          order={tier.sortOrder}
                          locked={locked}
                          size="md"
                        />
                        <div className="w-full space-y-1">
                          <p
                            className={`display-font truncate text-xs font-medium ${
                              tier.state === "current" ? "text-[#C6A15B]" : "text-[#F5F5F7]"
                            }`}
                          >
                            {tier.name}
                          </p>
                          <p className="financial-figure text-[10px] text-[#6B7280]">
                            {rangeLabel(tier.minAmount, tier.maxAmount)}
                          </p>
                        </div>
                        <StatusBadge
                          tone={eligibilityTone(tier.state)}
                          label={eligibilityLabel(tier.state)}
                        />
                        {locked && preview ? (
                          <p className="line-clamp-2 w-full text-[10px] leading-snug text-[#6B7280]">
                            {preview}
                          </p>
                        ) : null}
                      </div>
                      {!isLast ? (
                        <span className="mt-6 h-px w-6 shrink-0 bg-[#26272B]" aria-hidden="true" />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </Panel>
    </Section>
  );
}
