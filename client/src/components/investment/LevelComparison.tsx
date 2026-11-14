import { Panel, Section, SectionHeader, Stat, StatStrip, StatusBadge } from "../dashboard/primitives";
import { formatUsdCompact, parseDecimalString } from "../../utils/format";
import type { InvestmentLevelData } from "../../hooks/useInvestmentLevelData";
import { SolidCheck } from "../icons/SolidIcons";

function thresholdValue(threshold: string): string {
  const parsed = parseDecimalString(threshold);
  return parsed === null ? "—" : `${formatUsdCompact(parsed)}+`;
}

export function LevelComparison({ data }: { data: InvestmentLevelData }) {
  const { levels, benefits } = data.comparison;
  const nextLevelNumber = data.next?.levelNumber ?? null;
  const highest = data.topLevelReached || !data.next;
  const remaining = parseDecimalString(data.remainingToNext);

  if (levels.length === 0) {
    return null;
  }

  const additionalBenefits = data.nextLevelBenefits.length;
  const nextHint = highest
    ? "All configured levels reached"
    : `${additionalBenefits} additional benefit${additionalBenefits === 1 ? "" : "s"} unlocked`;

  return (
    <Section id="investment-level-comparison">
      <Panel className="space-y-5">
        <SectionHeader
          eyebrow="Comparison"
          title="Compare investment levels"
          description="Which platform benefits are configured at each investment level. Benefits are provided by the platform and never represent guaranteed investment performance."
        />

        <StatStrip>
          <Stat
            label="Your level"
            value={data.current?.name ?? "No level assigned"}
            hint={data.current ? thresholdValue(data.current.threshold) : "Not qualified yet"}
          />
          <Stat
            label={highest ? "Highest level" : "Next level"}
            value={highest ? data.current?.name ?? "—" : data.next?.name ?? "—"}
            hint={nextHint}
            tone={highest ? "positive" : "neutral"}
          />
          <Stat
            label="To advance"
            value={highest ? "No further threshold" : thresholdValue(data.next?.threshold ?? "")}
            hint={
              !highest && remaining !== null
                ? `${formatUsdCompact(Math.max(0, remaining))} remaining`
                : "Calculated by the platform"
            }
            tone={highest ? "positive" : "gold"}
          />
        </StatStrip>

        {benefits.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">
            No level benefits are configured yet, so there is nothing to compare.
          </p>
        ) : (
          <>
            <div className="hidden min-w-0 md:block">
              <div className="no-scrollbar overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[#141517] py-3 pr-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[#6B7280]">
                        Benefit
                      </th>
                      {levels.map((level) => (
                        <th key={level.levelId} className="px-3 pb-3 text-center align-bottom">
                          <span className="block text-xs font-medium text-[#F5F5F7]">{level.name}</span>
                          <span className="financial-figure mt-0.5 block text-[10px] text-[#6B7280]">
                            {thresholdValue(level.threshold)}
                          </span>
                          {level.isCurrent ? (
                            <span className="mt-1 inline-block">
                              <StatusBadge tone="gold" label="Current" />
                            </span>
                          ) : level.levelNumber === nextLevelNumber ? (
                            <span className="mt-1 inline-block">
                              <StatusBadge tone="neutral" label="Next" />
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
                          <span className="block text-xs font-medium text-[#F5F5F7]">{benefit.name}</span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#6B7280]">
                            {benefit.description}
                          </span>
                        </td>
                        {levels.map((level) => {
                          const included = benefit.includedInLevelIds.includes(level.levelId);
                          return (
                            <td key={level.levelId} className="px-3 py-3 text-center align-top">
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
                      {benefit.availableAtCurrentLevel ? (
                        <StatusBadge tone="positive" label="Included" />
                      ) : null}
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{benefit.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {levels.map((level) => {
                      const included = benefit.includedInLevelIds.includes(level.levelId);
                      return (
                        <span
                          key={level.levelId}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            included
                              ? "bg-[#16C784]/12 text-[#16C784]"
                              : "bg-[#26272B]/60 text-[#6B7280]"
                          }`}
                        >
                          {included ? <SolidCheck className="h-3 w-3" /> : null}
                          {level.name}
                        </span>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="text-[11px] leading-relaxed text-[#6B7280]">
          Higher levels are reached purely by increasing approved invested principal. They never promise
          returns, a fixed rate, or profit of any kind.
        </p>
      </Panel>
    </Section>
  );
}
