import { Panel, Section, SectionHeader, Stat, StatStrip, StatusBadge } from "../dashboard/primitives";
import { formatUsdCompact, parseDecimalString } from "../../utils/format";
import { SolidCheck } from "../icons/SolidIcons";
import type { InvestmentLevelData } from "../../hooks/useInvestmentLevelData";
import { LevelEmblem } from "./LevelEmblem";

function thresholdValue(threshold: string): string {
  const parsed = parseDecimalString(threshold);
  return parsed === null ? "—" : `${formatUsdCompact(parsed)}+`;
}

export function ProgressToNextLevel({ data }: { data: InvestmentLevelData }) {
  const qualifying = parseDecimalString(data.qualifyingAmount);
  const remaining = parseDecimalString(data.remainingToNext);
  const progress = Math.max(0, Math.min(100, data.progressPercent || 0));
  const highest = data.topLevelReached || !data.next;

  if (highest) {
    return (
      <Section id="investment-level-progress">
        <Panel className="h-full space-y-5">
          <SectionHeader
            eyebrow="Progression"
            title="Highest level reached"
            description="No further investment level exists above your current level."
            action={<StatusBadge tone="positive" label="Top level" />}
          />
          <div className="flex items-start gap-4">
            <LevelEmblem
              levelName={data.current?.name ?? "Top level"}
              order={data.current?.levelNumber ?? 0}
              size="md"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">Current level</p>
              <p className="display-font text-lg font-semibold text-[#F5F5F7]">
                {data.current?.name ?? "Highest level"}
              </p>
              <p className="text-xs leading-relaxed text-[#9CA3AF]">
                Every configured level is unlocked at your qualifying principal. If the platform
                publishes a higher level later, your qualifying amount is already recorded and your
                level is reviewed automatically.
              </p>
            </div>
          </div>
          <div className="hairline-t pt-4">
            <StatStrip>
              <Stat
                label="Qualifying principal"
                value={qualifying === null ? "—" : formatUsdCompact(qualifying)}
              />
              <Stat
                label="Level threshold"
                value={data.current ? thresholdValue(data.current.threshold) : "—"}
              />
              <Stat label="Progress" value="100.0%" tone="positive" />
            </StatStrip>
          </div>
        </Panel>
      </Section>
    );
  }

  return (
    <Section id="investment-level-progress">
      <Panel className="h-full space-y-5">
        <SectionHeader
          eyebrow="Next level"
          title={`Preview: ${data.next?.name}`}
          description="What your qualifying principal unlocks once you cross the next threshold."
        />

        <div className="flex items-start gap-4">
          <LevelEmblem
            levelName={data.next?.name ?? "Next level"}
            order={data.next?.levelNumber ?? 0}
            size="md"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">Next level</p>
            <p className="display-font text-lg font-semibold text-[#F5F5F7]">{data.next?.name}</p>
            <p className="text-xs leading-relaxed text-[#9CA3AF]">
              {data.next ? `Requires ${thresholdValue(data.next.threshold)} approved invested principal.` : ""}
            </p>
          </div>
        </div>

        <div className="hairline-t pt-4">
          <StatStrip>
            <Stat
              label="Next threshold"
              value={data.next ? thresholdValue(data.next.threshold) : "—"}
            />
            <Stat
              label="Remaining"
              value={remaining === null ? "—" : formatUsdCompact(Math.max(0, remaining))}
              tone={remaining !== null && remaining <= 0 ? "positive" : "gold"}
            />
            <Stat label="Progress" value={`${progress.toFixed(1)}%`} />
          </StatStrip>
        </div>

        <div className="hairline-t space-y-2 pt-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
            What unlocks at {data.next?.name}
          </p>
          {data.nextLevelBenefits.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.nextLevelBenefits.map((benefit) => (
                <li key={benefit.benefitId} className="flex items-start gap-2 text-xs text-[#F5F5F7]">
                  <SolidCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C6A15B]" aria-hidden="true" />
                  <span className="min-w-0">
                    {benefit.name}
                    {benefit.requiresActivation ? (
                      <span className="ml-1 text-[#6B7280]">· activation required</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
              {data.next?.name} does not introduce additional benefits beyond your current level.
            </p>
          )}
        </div>

        {!data.qualifyingComplete ? (
          <p className="text-[11px] leading-relaxed text-[#C6A15B]">
            Some approved deposits cannot be priced with a reliable market price right now, so the
            qualifying amount is held back until every approved deposit can be valued.
          </p>
        ) : null}
      </Panel>
    </Section>
  );
}
