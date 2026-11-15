import { EmptyState, Panel, Section, SectionHeader, StatusBadge } from "../dashboard/primitives";
import { formatDateTime } from "../../utils/format";
import { RewardEmblem } from "./RewardEmblem";
import { formatRewardAmount } from "./rewardsUtils";
import { rewardCategoryTone, rewardStatusTone, type RewardHistoryEntry } from "../../utils/rewards";

export function RewardHistoryPanel({ history }: { history: RewardHistoryEntry[] }) {
  return (
    <Section id="rewards-history">
      <Panel className="space-y-4">
        <SectionHeader
          eyebrow="Activity"
          title="Reward history"
          description="Every reward granted to your account, with its category, value, earning and redemption dates, status, and ledger reference."
        />

        {history.length === 0 ? (
          <EmptyState
            title="No reward activity yet"
            description="Rewards you earn or are granted will be listed here with their full history."
          />
        ) : (
          <ul>
            {history.map((entry) => (
              <li key={entry.id} className="list-row items-start gap-3">
                <RewardEmblem
                  category={entry.category}
                  name={entry.name}
                  size="sm"
                  locked={entry.status === "expired" || entry.status === "revoked"}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-xs font-medium text-[#F5F5F7]">{entry.name}</p>
                    <StatusBadge
                      tone={rewardCategoryTone(entry.category)}
                      label={entry.categoryLabel}
                    />
                  </div>
                  <p className="truncate font-mono text-[10px] text-[#6B7280]">
                    {entry.reference}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#6B7280]">
                    <span>Earned {entry.dateEarned ? formatDateTime(entry.dateEarned) : "N/A"}</span>
                    <span>
                      Redeemed {entry.dateRedeemed ? formatDateTime(entry.dateRedeemed) : "N/A"}
                    </span>
                    <span>
                      {entry.grantSource === "admin" ? "Platform grant" : "Earned automatically"}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <p className="financial-figure whitespace-nowrap text-xs font-semibold text-[#C6A15B]">
                    {formatRewardAmount(entry.amount)} {entry.asset}
                  </p>
                  <div className="flex justify-end">
                    <StatusBadge
                      tone={rewardStatusTone(entry.status)}
                      label={entry.statusLabel}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Section>
  );
}
