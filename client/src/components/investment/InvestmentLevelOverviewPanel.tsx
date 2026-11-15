import {
  Panel,
  ProgressBar,
  Section,
  SectionHeader,
  Stat,
  StatStrip,
  StatusBadge
} from "../dashboard/primitives";
import { formatDateTime, formatUsdCompact, parseDecimalString } from "../../utils/format";
import { SolidShield, SolidTrendingUp } from "../icons/SolidIcons";
import type { InvestmentLevelData } from "../../hooks/useInvestmentLevelData";
import { LevelEmblem } from "./LevelEmblem";
import { levelAccent } from "./investmentLevelUtils";

function thresholdValue(threshold: string): string {
  const parsed = parseDecimalString(threshold);
  return parsed === null ? "N/A" : `${formatUsdCompact(parsed)}+`;
}

export function InvestmentLevelOverviewPanel({ data }: { data: InvestmentLevelData }) {
  const { current, next, status } = data;
  const qualifying = parseDecimalString(data.qualifyingAmount);
  const progress = Math.max(0, Math.min(100, data.progressPercent || 0));
  const accent = levelAccent(current?.theme);
  const totalLevels = data.levels.length;
  const reachedLevels = data.levels.filter(
    (level) => level.state === "completed" || level.state === "current"
  ).length;
  const highest = data.topLevelReached || !next;

  return (
    <Section id="investment-level-overview">
      <Panel className="h-full space-y-5">
        <SectionHeader
          eyebrow="Investment level"
          title="Your investment level"
          description="Levels are earned from approved, verified invested principal only, never from membership, portfolio value, or daily performance."
          action={
            <StatusBadge
              tone={current ? (current.source === "admin" ? "gold" : "positive") : "neutral"}
              label={status.label}
            />
          }
        />

        <div className="flex items-start gap-4">
          <LevelEmblem
            levelName={current?.name ?? "Unassigned"}
            order={current?.levelNumber ?? 0}
            size="lg"
            locked={!current}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">Current level</p>
            <h2 className="display-font truncate text-xl font-semibold text-[#F5F5F7]">
              {current?.name ?? "No level assigned"}
            </h2>
            <p className="text-xs leading-relaxed text-[#9CA3AF]">
              {current?.description ?? data.explanation}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-[11px] text-[#9CA3AF]">
              <span className="inline-flex items-center gap-1.5">
                <SolidShield className="h-3.5 w-3.5 text-[#16C784]" aria-hidden="true" />
                {current?.source === "admin" ? "Set by the platform" : "Advanced automatically"}
              </span>
              {current ? (
                <span>Attained {current.achievedAt ? formatDateTime(current.achievedAt) : "N/A"}</span>
              ) : null}
            </div>
            {current?.source === "admin" && current.manualReason ? (
              <p className="rounded-lg bg-[#C6A15B]/10 px-3 py-2 text-[11px] leading-relaxed text-[#C6A15B]">
                Platform note: {current.manualReason}
                {current.manualSetAt ? ` (${formatDateTime(current.manualSetAt)})` : ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="hairline-t pt-4">
          <StatStrip>
            <Stat
              label="Qualifying principal"
              value={qualifying === null ? "Pending pricing" : formatUsdCompact(qualifying)}
              hint={data.qualificationMetric.label}
            />
            <Stat label="Level threshold" value={current ? thresholdValue(current.threshold) : "N/A"} />
            <Stat
              label="Levels reached"
              value={totalLevels > 0 ? `${reachedLevels} / ${totalLevels}` : "N/A"}
              hint={current?.isHighestLevel ? "Highest level" : "Configured levels"}
              tone="gold"
            />
          </StatStrip>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[#9CA3AF]">
              <SolidTrendingUp className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} aria-hidden="true" />
              <span className="truncate">
                {highest ? "You have reached the highest investment level." : `Progress to ${next?.name}`}
              </span>
            </span>
            <span className="financial-figure shrink-0 text-[#9CA3AF]">{progress.toFixed(1)}%</span>
          </div>
          <ProgressBar value={highest ? 100 : progress} tone={highest ? "positive" : "gold"} />
        </div>

        <p className="text-[11px] leading-relaxed text-[#6B7280]">
          Advancing a level changes the platform benefits and limits available to you. It does not
          change your portfolio value, your daily performance, or guarantee any return.
        </p>
      </Panel>
    </Section>
  );
}
