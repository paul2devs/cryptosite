import { Panel, Section, SectionHeader, Stat, StatStrip, StatusBadge } from "../dashboard/primitives";
import { RewardEmblem } from "./RewardEmblem";
import { formatRewardAmount } from "./rewardsUtils";
import type { RewardDashboard } from "../../utils/rewards";

export function RewardOverviewPanel({ data }: { data: RewardDashboard }) {
  const { summary, categories, balance, upcoming, rules } = data;
  const nextMilestone = upcoming[0];

  return (
    <Section id="rewards-overview">
      <Panel className="space-y-5">
        <SectionHeader
          eyebrow="Rewards"
          title="Your rewards balance"
          action={
            <StatusBadge
              tone={summary.availableCount > 0 ? "positive" : "neutral"}
              label={
                summary.availableCount > 0
                  ? `${summary.availableCount} available`
                  : "None available yet"
              }
            />
          }
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
              Available to redeem
            </p>
            <p className="display-font financial-figure mt-1 text-3xl font-semibold text-[#C6A15B] sm:text-4xl">
              {formatRewardAmount(summary.availableAmount)}
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#9CA3AF]">
              Rewards are held as promotional credits. Redeeming one moves its value into your
              available balance, it is never counted as investment principal or trading profit.
            </p>
          </div>
          <RewardEmblem
            category="loyalty"
            name="Rewards"
            size="lg"
            locked={summary.availableCount === 0}
          />
        </div>

        <StatStrip>
          <Stat label="Total earned" value={formatRewardAmount(summary.totalEarned)} tone="positive" />
          <Stat label="Redeemed" value={formatRewardAmount(summary.redeemedAmount)} />
          <Stat label="Pending" value={formatRewardAmount(summary.pendingAmount)} tone="gold" />
          <Stat
            label="Next unlock"
            value={nextMilestone ? nextMilestone.name : "All rewards earned"}
          />
        </StatStrip>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[#0F0F10] px-4 py-3 ring-1 ring-inset ring-[#26272B]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              Held promotional credits
            </p>
            <p className="financial-figure mt-1 text-lg font-medium text-[#F5F5F7]">
              {formatRewardAmount(balance.promotionalCredits)}
            </p>
            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
              Granted rewards awaiting redemption.
            </p>
          </div>
          <div className="rounded-xl bg-[#0F0F10] px-4 py-3 ring-1 ring-inset ring-[#26272B]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              Withdrawable balance
            </p>
            <p className="financial-figure mt-1 text-lg font-medium text-[#16C784]">
              {formatRewardAmount(balance.withdrawable)}
            </p>
            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
              Redeemed rewards become available to withdraw.
            </p>
          </div>
        </div>

        <div className="space-y-0.5 pt-1">
          <p className="pb-1 text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
            Reward categories
          </p>
          {categories.map((category) => (
            <div key={category.id} className="list-row items-start gap-3">
              <RewardEmblem
                category={category.id}
                name={category.label}
                size="sm"
                locked={category.grantedCount === 0}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-xs font-medium text-[#F5F5F7]">{category.label}</p>
                  <p className="financial-figure text-xs text-[#C6A15B]">
                    {formatRewardAmount(category.totalAmount)}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-[#9CA3AF]">
                  {category.description}
                </p>
                <p className="mt-0.5 text-[10px] text-[#6B7280]">
                  {category.grantedCount} granted · {category.availableCount} available
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5 pt-4 hairline-t">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">How rewards work</p>
          <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{rules.fundingModel}</p>
          <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{rules.eligibilityModel}</p>
          <p className="text-[11px] leading-relaxed text-[#6B7280]">{rules.expiryModel}</p>
        </div>
      </Panel>
    </Section>
  );
}
