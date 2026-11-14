import { EmptyState, Panel, ProgressBar, Section, SectionHeader, Stat, StatStrip, StatusBadge } from "../dashboard/primitives";
import { formatDateTime, formatUsd, parseDecimalString } from "../../utils/format";
import { RewardEmblem } from "./RewardEmblem";
import { formatRewardAmount, remainingLabel, requirementProgressLabel } from "./rewardsUtils";
import { rewardCategoryTone, type RewardEligibilityView, type RewardItemView } from "../../utils/rewards";

export function RewardProgression({
  locked,
  eligibility
}: {
  locked: RewardItemView[];
  eligibility: RewardEligibilityView;
}) {
  const deposits = parseDecimalString(eligibility.depositTotal);
  const invested = parseDecimalString(eligibility.investTotal);

  return (
    <Section id="rewards-progression">
      <Panel className="space-y-4">
        <SectionHeader
          eyebrow="Progression"
          title="Rewards to unlock"
          description="Each reward below is published but not yet earned. Progress is measured only from independently verified platform activity."
          action={
            locked.length > 0 ? (
              <StatusBadge tone="neutral" label={`${locked.length} locked`} />
            ) : undefined
          }
        />

        <StatStrip>
          <Stat
            label="Verified deposits"
            value={
              eligibility.depositTotalVerified && deposits !== null
                ? formatUsd(deposits)
                : "Not verified"
            }
            tone={eligibility.depositTotalVerified ? "positive" : "neutral"}
          />
          <Stat
            label="Invested principal"
            value={invested === null ? "—" : formatUsd(invested)}
          />
          <Stat label="Membership tier" value={eligibility.membershipTierName ?? "No tier"} />
          <Stat label="Referred accounts" value={String(eligibility.referralCount)} />
        </StatStrip>

        {locked.length === 0 ? (
          <EmptyState
            title="Every published reward is unlocked"
            description="You have earned all currently published rewards. New rewards will appear here when the platform publishes them."
          />
        ) : (
          <ul>
            {locked.map((reward) => {
              const remaining = remainingLabel(reward.progress);
              return (
                <li key={reward.id} className="list-row flex-col items-stretch gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <RewardEmblem
                      category={reward.category}
                      name={reward.name}
                      size="md"
                      locked
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="display-font text-sm font-medium text-[#F5F5F7]">
                          {reward.name}
                        </p>
                        <StatusBadge
                          tone={rewardCategoryTone(reward.category)}
                          label={reward.categoryLabel}
                        />
                        <StatusBadge tone="neutral" label="Locked" />
                      </div>
                      {reward.description ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
                          {reward.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#6B7280]">
                        Requirement · {reward.requirementLabel}
                      </p>
                    </div>
                  </div>

                  <div className="w-full space-y-1.5 sm:max-w-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="financial-figure text-[11px] text-[#9CA3AF]">
                        {requirementProgressLabel(reward.progress)}
                      </span>
                      <span className="financial-figure text-sm font-semibold text-[#C6A15B]">
                        {formatRewardAmount(reward.amount)} {reward.asset}
                      </span>
                    </div>
                    {reward.progress.type === "manual" ? (
                      <p className="text-[10px] text-[#6B7280]">
                        Issued by an administrator. No automatic progress applies.
                      </p>
                    ) : (
                      <>
                        <ProgressBar value={reward.progress.progressPercent} tone="gold" />
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                          <span className="financial-figure text-[10px] text-[#6B7280]">
                            {reward.progress.progressPercent.toFixed(0)}%
                          </span>
                          {remaining ? (
                            <span className="text-[10px] text-[#6B7280]">{remaining}</span>
                          ) : null}
                        </div>
                      </>
                    )}
                    {reward.expiresAt ? (
                      <p className="text-[10px] text-[#6B7280]">
                        Expires {formatDateTime(reward.expiresAt)}
                      </p>
                    ) : null}
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
