import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import {
  Section,
  SectionHeader,
  Stat,
  StatStrip,
  ProgressBar,
  ErrorRow,
  LoadingRow,
  EmptyState,
  Panel
} from "./primitives";
import { formatUsd } from "../../utils/format";
import type { ProgressionResponse } from "../../hooks/useDashboardData";
import { LevelEmblem } from "../investment/LevelEmblem";

export function InvestmentProgress({
  progression,
  loading,
  error,
  onRetry
}: {
  progression: ProgressionResponse | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const totalDeposited = progression?.totalDepositedUsd ?? 0;
  const currentLevel = progression?.depositLevel ?? 0;
  const currentRequired = progression?.depositCurrentLevelRequiredTotal ?? 0;
  const nextLevel = progression?.depositNextLevel ?? null;
  const nextRequired = progression?.depositNextLevelRequiredTotal ?? null;
  const remaining = progression?.depositRemainingToNext ?? null;

  const hasStarted = totalDeposited > 0 || currentLevel > 0;
  const isMaxed = nextLevel === null;

  let percent = 0;
  if (isMaxed) {
    percent = 100;
  } else if (nextRequired !== null && nextRequired > currentRequired) {
    percent = Math.max(
      0,
      Math.min(100, ((totalDeposited - currentRequired) / (nextRequired - currentRequired)) * 100)
    );
  }

  return (
    <Section id="investment-levels">
      <SectionHeader
        title="Investment level progression"
        description="Levels advance from approved, verified invested principal. This is independent of membership."
        action={
          <Link
            to="/investment-levels"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C6A15B] transition-colors hover:text-[#F5F5F7]"
          >
            View investment levels
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />
      <Panel className="mt-4">
        {loading && !progression ? (
          <LoadingRow label="Loading level progression…" />
        ) : error && !progression ? (
          <ErrorRow message={error} onRetry={onRetry} />
        ) : !hasStarted ? (
          <EmptyState
            title="Your progression starts with your first deposit"
            description="Approved, verified invested principal counts toward your investment level. Levels unlock platform benefits, never guaranteed returns."
          />
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <LevelEmblem
                levelName={`Level ${currentLevel}`}
                order={currentLevel}
                size="md"
                locked={currentLevel === 0}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                  Current level
                </p>
                <p className="display-font text-lg font-semibold text-[#F5F5F7]">
                  Level {currentLevel}
                </p>
                <p className="text-xs leading-relaxed text-[#9CA3AF]">
                  {isMaxed
                    ? "You have reached the highest investment level."
                    : "Keep growing your approved invested principal to advance."}
                </p>
              </div>
            </div>

            <StatStrip>
              <Stat label="Approved deposits" value={formatUsd(totalDeposited)} />
              <Stat label="Next level" value={isMaxed ? "Highest" : `Level ${nextLevel}`} />
              <Stat
                label="Remaining"
                value={isMaxed || remaining === null ? "N/A" : formatUsd(Math.max(0, remaining))}
                tone={isMaxed ? "positive" : "gold"}
              />
            </StatStrip>

            <div className="space-y-2">
              <ProgressBar value={percent} tone={isMaxed ? "positive" : "gold"} />
              <p className="text-[11px] text-[#9CA3AF]">
                {isMaxed
                  ? "All configured levels are unlocked at your qualifying principal."
                  : nextRequired !== null
                  ? `${formatUsd(totalDeposited)} of ${formatUsd(nextRequired)} toward Level ${nextLevel}.`
                  : "Keep depositing to advance to the next level."}
              </p>
            </div>
          </div>
        )}
      </Panel>
    </Section>
  );
}
