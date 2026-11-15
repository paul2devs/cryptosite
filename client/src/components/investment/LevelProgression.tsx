import { Panel, Section, SectionHeader, StatusBadge } from "../dashboard/primitives";
import { formatUsdCompact, parseDecimalString } from "../../utils/format";
import type { InvestmentJourneyLevel, InvestmentLevelData } from "../../hooks/useInvestmentLevelData";
import { LevelEmblem } from "./LevelEmblem";
import { journeyLabel, journeyTone } from "./investmentLevelUtils";

function thresholdValue(threshold: string): string {
  const parsed = parseDecimalString(threshold);
  return parsed === null ? "N/A" : `$${formatUsdCompact(parsed)}+`;
}

function connectorColor(level: InvestmentJourneyLevel): string {
  if (level.state === "completed") return "#16C784";
  if (level.state === "current") return "#C6A15B";
  return "#26272B";
}

function benefitCount(level: InvestmentJourneyLevel): string {
  return `${level.benefits.length} benefit${level.benefits.length === 1 ? "" : "s"}`;
}

export function LevelProgression({ data }: { data: InvestmentLevelData }) {
  return (
    <Section id="investment-level-journey">
      <Panel className="space-y-5">
        <SectionHeader
          eyebrow="Progression path"
          title="Investment level journey"
          description="Each level is defined by the approved invested principal required to reach it. Completed levels sit behind you, your current level is marked, and the rest unlock as your principal grows."
        />

        {data.levels.length === 0 ? (
          <p className="text-xs text-[#9CA3AF]">No investment levels are configured yet.</p>
        ) : (
          <>
            <div className="hidden md:block">
              <div className="no-scrollbar overflow-x-auto pb-1">
                <ol className="flex w-full items-stretch">
                  {data.levels.map((level, index) => {
                    const isLast = index === data.levels.length - 1;
                    return (
                      <li
                        key={level.levelId}
                        className="relative flex min-w-[88px] flex-1 flex-col items-center px-1 text-center"
                      >
                        {!isLast ? (
                          <span
                            className="absolute left-1/2 top-5 h-[2px] w-full"
                            style={{ backgroundColor: connectorColor(level) }}
                            aria-hidden="true"
                          />
                        ) : null}
                        <LevelEmblem
                          levelName={level.name}
                          order={level.levelNumber}
                          size="sm"
                          locked={level.state === "locked"}
                        />
                        <p className="mt-2 w-full truncate text-[11px] font-medium text-[#F5F5F7]">
                          {level.name}
                        </p>
                        <p className="financial-figure w-full truncate text-[10px] text-[#6B7280]">
                          {thresholdValue(level.threshold)}
                        </p>
                        <span className="mt-1.5">
                          <StatusBadge tone={journeyTone(level.state)} label={journeyLabel(level.state)} />
                        </span>
                        <p className="mt-1 text-[10px] text-[#6B7280]">{benefitCount(level)}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            <ol className="md:hidden">
              {data.levels.map((level) => (
                <li
                  key={level.levelId}
                  className="flex items-start gap-3 py-3 shadow-[inset_0_-1px_0_0_#1F2023] last:shadow-none"
                >
                  <LevelEmblem
                    levelName={level.name}
                    order={level.levelNumber}
                    size="sm"
                    locked={level.state === "locked"}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="display-font text-sm font-medium text-[#F5F5F7]">{level.name}</p>
                      <StatusBadge tone={journeyTone(level.state)} label={journeyLabel(level.state)} />
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{level.description}</p>
                    <p className="financial-figure text-[11px] text-[#6B7280]">
                      {level.requirement} · {benefitCount(level)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </Panel>
    </Section>
  );
}
