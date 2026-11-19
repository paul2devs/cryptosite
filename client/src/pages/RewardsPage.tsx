import { RefreshCw } from "lucide-react";
import { Seo } from "../components/Seo";
import { EmptyState, ErrorRow, LoadingRow, Panel } from "../components/dashboard/primitives";
import { RewardOverviewPanel } from "../components/rewards/RewardOverviewPanel";
import { RewardProgression } from "../components/rewards/RewardProgression";
import { AvailableRewards } from "../components/rewards/AvailableRewards";
import { RewardHistoryPanel } from "../components/rewards/RewardHistoryPanel";
import { useRewardsData } from "../hooks/useRewardsData";

export function RewardsPage() {
  const {
    data,
    loading,
    error,
    reload,
    redeemingId,
    redemptionError,
    redemptionNotice,
    redeem
  } = useRewardsData();

  const availableRewards =
    data?.rewards.filter((reward) => reward.status === "available") ?? [];

  return (
    <div className="page-responsive space-y-6 pb-16">
      <Seo
        title="Rewards"
        description="Your NexaCrypto rewards: available promotional rewards, progression toward locked rewards, and full reward history, separate from investment returns."
        path="/rewards"
        robots="noindex,nofollow"
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">Growth</p>
          <h1 className="display-font text-2xl font-semibold text-[#F5F5F7]">Rewards</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#9CA3AF]">
            Loyalty, promotional, referral, and special rewards earned on the platform. Rewards are
            held separately from your invested principal and realised trading performance.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#26272B] px-3 py-1.5 text-[11px] font-medium text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading && !data ? (
        <Panel>
          <LoadingRow label="Loading rewards…" />
        </Panel>
      ) : error && !data ? (
        <Panel>
          <ErrorRow message={error} onRetry={reload} />
        </Panel>
      ) : !data ? (
        <Panel>
          <EmptyState
            title="Rewards information is unavailable"
            description="We could not load your rewards. Try refreshing the page."
          />
        </Panel>
      ) : (
        <>
          <RewardOverviewPanel data={data} />
          <RewardProgression locked={data.locked} eligibility={data.eligibility} />
          <AvailableRewards
            rewards={availableRewards}
            redeemingId={redeemingId}
            onRedeem={(userRewardId) => {
              void redeem(userRewardId);
            }}
            redemptionError={redemptionError}
            redemptionNotice={redemptionNotice}
          />
          <RewardHistoryPanel history={data.history} />
        </>
      )}
    </div>
  );
}
