import { EmptyState, Panel, Section, SectionHeader, StatusBadge } from "../dashboard/primitives";
import type { MembershipData } from "../../hooks/useMembershipData";
import { rangeLabel } from "./membershipUtils";
import { SolidCheck } from "../icons/SolidIcons";

export function TierComparison({ data }: { data: MembershipData }) {
  const { tiers, benefits } = data.comparison;

  if (tiers.length === 0) {
    return null;
  }

  return (
    <Section id="membership-comparison">
      <Panel className="space-y-4">
        <SectionHeader eyebrow="Comparison" title="Compare tiers" />

        {benefits.length === 0 ? (
          <EmptyState
            title="Nothing to compare"
            description="Membership benefits are not published yet."
          />
        ) : (
          <>
            <div className="hidden min-w-0 md:block">
              <div className="no-scrollbar overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[#141517] py-3 pr-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
                        Benefit
                      </th>
                      {tiers.map((tier) => (
                        <th key={tier.tierId} className="px-3 pb-3 text-center align-bottom">
                          <span className="block text-xs font-medium text-[#F5F5F7]">
                            {tier.name}
                          </span>
                          <span className="financial-figure mt-0.5 block text-[10px] text-[#6B7280]">
                            {rangeLabel(tier.minAmount, tier.maxAmount)}
                          </span>
                          {tier.isCurrent ? (
                            <span className="mt-1 inline-block">
                              <StatusBadge tone="gold" label="Current" />
                            </span>
                          ) : null}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {benefits.map((benefit) => (
                      <tr key={benefit.benefitId} className="hairline-t">
                        <td className="sticky left-0 z-10 bg-[#141517] py-3 pr-4 align-top">
                          <span className="block text-xs font-medium text-[#F5F5F7]">
                            {benefit.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#6B7280]">
                            {benefit.description}
                          </span>
                        </td>
                        {tiers.map((tier) => {
                          const included = benefit.includedInTierIds.includes(tier.tierId);
                          return (
                            <td key={tier.tierId} className="px-3 py-3 text-center align-top">
                              {included ? (
                                <SolidCheck className="mx-auto h-4 w-4 text-[#16C784]" />
                              ) : (
                                <span className="block text-sm text-[#4B5563]">–</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <ul className="space-y-3 md:hidden">
              {benefits.map((benefit, index) => (
                <li
                  key={benefit.benefitId}
                  className={`space-y-2 ${index > 0 ? "hairline-t pt-3" : ""}`}
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium text-[#F5F5F7]">{benefit.name}</p>
                      {benefit.availableAtCurrentTier ? (
                        <StatusBadge tone="positive" label="Included" />
                      ) : null}
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
                      {benefit.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tiers.map((tier) => {
                      const included = benefit.includedInTierIds.includes(tier.tierId);
                      return (
                        <span
                          key={tier.tierId}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            included
                              ? "bg-[#16C784]/12 text-[#16C784]"
                              : "bg-[#26272B]/60 text-[#6B7280]"
                          }`}
                        >
                          {included ? <SolidCheck className="h-3 w-3" /> : null}
                          {tier.name}
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </Section>
  );
}
