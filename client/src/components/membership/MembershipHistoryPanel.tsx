import { EmptyState, ListRow, Panel, Section, SectionHeader, StatusBadge } from "../dashboard/primitives";
import { formatDateTime, formatUsd, parseDecimalString } from "../../utils/format";
import type { MembershipData, MembershipSource } from "../../hooks/useMembershipData";
import { SolidArrowRight, SolidReceipt } from "../icons/SolidIcons";

function sourceMeta(source: MembershipSource): { label: string; tone: "neutral" | "gold" | "positive" } {
  if (source === "admin") return { label: "Administrator", tone: "gold" };
  if (source === "recalculation") return { label: "Recalculation", tone: "neutral" };
  return { label: "Automatic", tone: "positive" };
}

export function MembershipHistoryPanel({ data }: { data: MembershipData }) {
  const history = [...data.history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Section id="membership-history">
      <Panel className="space-y-4">
        <SectionHeader eyebrow="History" title="Membership history" />

        {history.length === 0 ? (
          <EmptyState
            title="No membership changes recorded"
            description="Tier changes appear here once they occur."
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
                        <span className="text-[#9CA3AF]">{entry.fromTierName ?? "No tier"}</span>
                        <SolidArrowRight className="h-3.5 w-3.5 text-[#6B7280]" />
                        <span className="font-medium text-[#F5F5F7]">
                          {entry.toTierName ?? "No tier"}
                        </span>
                      </span>
                      <StatusBadge tone={meta.tone} label={meta.label} />
                    </div>
                    <p className="text-xs leading-relaxed text-[#9CA3AF]">{entry.reason}</p>
                    <p className="text-[11px] text-[#6B7280]">
                      {formatDateTime(entry.createdAt)} · Qualifying amount{" "}
                      {amount === null ? "—" : formatUsd(amount)}
                      {entry.actorAdminId ? ` · Admin ${entry.actorAdminId}` : ""}
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
