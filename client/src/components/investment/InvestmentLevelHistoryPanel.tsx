import { EmptyState, ListRow, Panel, Section, SectionHeader, StatusBadge } from "../dashboard/primitives";
import { formatDateTime, formatUsd, parseDecimalString } from "../../utils/format";
import type {
  InvestmentHistoryEntry,
  InvestmentLevelData,
  InvestmentLevelSource
} from "../../hooks/useInvestmentLevelData";
import { SolidArrowRight, SolidReceipt } from "../icons/SolidIcons";

function sourceMeta(source: InvestmentLevelSource): { label: string; tone: "neutral" | "gold" | "positive" } {
  if (source === "admin") return { label: "Platform", tone: "gold" };
  if (source === "recalculation") return { label: "Recalculation", tone: "neutral" };
  return { label: "Automatic", tone: "positive" };
}

function levelName(entry: InvestmentHistoryEntry, side: "from" | "to"): string {
  const name = side === "from" ? entry.fromLevelName : entry.toLevelName;
  const number = side === "from" ? entry.fromLevelNumber : entry.toLevelNumber;
  if (name) return name;
  if (number !== null) return `Level ${number}`;
  return "No level";
}

export function InvestmentLevelHistoryPanel({ data }: { data: InvestmentLevelData }) {
  const history = [...data.history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Section id="investment-level-history">
      <Panel className="space-y-5">
        <SectionHeader
          eyebrow="History"
          title="Investment level history"
          description="Every level change is recorded with the qualifying amount at the time, the reason, and the effective date."
        />

        {history.length === 0 ? (
          <EmptyState
            title="No level changes recorded"
            description="Investment level history entries appear here once a level is achieved or adjusted."
          />
        ) : (
          <ol>
            {history.map((entry) => {
              const meta = sourceMeta(entry.source);
              const amount = parseDecimalString(entry.qualifyingAmount);
              return (
                <ListRow key={entry.historyId}>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1F2023] text-[#9CA3AF]"
                    aria-hidden="true"
                  >
                    <SolidReceipt className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="text-[#9CA3AF]">{levelName(entry, "from")}</span>
                        <SolidArrowRight className="h-3.5 w-3.5 text-[#6B7280]" />
                        <span className="font-medium text-[#F5F5F7]">{levelName(entry, "to")}</span>
                      </span>
                      <StatusBadge tone={meta.tone} label={meta.label} />
                    </div>
                    <p className="text-xs leading-relaxed text-[#9CA3AF]">{entry.reason}</p>
                    <p className="text-[11px] text-[#6B7280]">
                      Effective {formatDateTime(entry.createdAt)} · Qualifying amount{" "}
                      {amount === null ? "N/A" : formatUsd(amount)}
                      {entry.actorAdminId ? ` · Platform ${entry.actorAdminId}` : ""}
                    </p>
                  </div>
                </ListRow>
              );
            })}
          </ol>
        )}
      </Panel>
    </Section>
  );
}
