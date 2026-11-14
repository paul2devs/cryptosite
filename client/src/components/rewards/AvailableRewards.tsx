import { Loader2 } from "lucide-react";
import { EmptyState, Panel, Section, SectionHeader, StatusBadge } from "../dashboard/primitives";
import { formatDateTime } from "../../utils/format";
import { RewardEmblem } from "./RewardEmblem";
import { formatRewardAmount } from "./rewardsUtils";
import { rewardCategoryTone, rewardStatusTone, type RewardItemView } from "../../utils/rewards";

export function AvailableRewards({
  rewards,
  redeemingId,
  onRedeem,
  redemptionError,
  redemptionNotice
}: {
  rewards: RewardItemView[];
  redeemingId: string | null;
  onRedeem: (userRewardId: string) => void;
  redemptionError: string | null;
  redemptionNotice: string | null;
}) {
  return (
    <Section id="rewards-available">
      <Panel className="space-y-4">
        <SectionHeader
          eyebrow="Available now"
          title="Redeem your rewards"
          description="Each reward can be redeemed once. Redeeming moves its value from promotional credits into your available balance."
          action={
            rewards.length > 0 ? (
              <StatusBadge tone="positive" label={`${rewards.length} ready`} />
            ) : undefined
          }
        />

        {redemptionError ? (
          <p className="rounded-lg bg-[#EA3943]/10 px-3 py-2 text-[11px] text-[#EA3943]">
            {redemptionError}
          </p>
        ) : null}
        {redemptionNotice ? (
          <p className="rounded-lg bg-[#16C784]/10 px-3 py-2 text-[11px] text-[#16C784]">
            {redemptionNotice}
          </p>
        ) : null}

        {rewards.length === 0 ? (
          <EmptyState
            title="No rewards are ready to redeem"
            description="Rewards appear here automatically as you satisfy each reward's requirement, or when an administrator grants one."
          />
        ) : (
          <ul>
            {rewards.map((reward) => {
              const busy = redeemingId === reward.id;
              return (
                <li key={reward.id} className="list-row flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <RewardEmblem category={reward.category} name={reward.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="display-font text-sm font-medium text-[#F5F5F7]">
                          {reward.name}
                        </p>
                        <StatusBadge
                          tone={rewardCategoryTone(reward.category)}
                          label={reward.categoryLabel}
                        />
                        <StatusBadge tone={rewardStatusTone(reward.status)} label={reward.statusLabel} />
                      </div>
                      {reward.description ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
                          {reward.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-[#6B7280]">
                        {reward.grantedByAdmin ? "Granted by administrator" : "Earned automatically"}
                        {reward.grantedAt ? ` · ${formatDateTime(reward.grantedAt)}` : ""}
                        {reward.reference ? ` · Ref ${reward.reference}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <p className="financial-figure text-sm font-semibold text-[#C6A15B]">
                      {formatRewardAmount(reward.amount)} {reward.asset}
                    </p>
                    <button
                      type="button"
                      onClick={() => onRedeem(reward.id)}
                      disabled={redeemingId !== null || !reward.canRedeem}
                      className="btn btn-sm btn-primary w-full sm:w-auto"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                      Redeem
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </Section>
  );
}
