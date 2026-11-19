import { Seo } from "../components/Seo";
import { useDashboardData } from "../hooks/useDashboardData";
import { PortfolioOverview } from "../components/dashboard/PortfolioOverview";
import { QuickActions } from "../components/dashboard/QuickActions";
import { PerformanceOverview } from "../components/dashboard/PerformanceOverview";
import { MembershipOverview } from "../components/dashboard/MembershipOverview";
import { InvestmentProgress } from "../components/dashboard/InvestmentProgress";
import { RewardsOverview } from "../components/dashboard/RewardsOverview";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { MarketOverview } from "../components/dashboard/MarketOverview";

export function DashboardPage() {
  const {
    loading,
    error,
    portfolio,
    progression,
    membership,
    membershipError,
    transactions,
    transactionsError,
    bonuses,
    performance,
    performanceLoading,
    performanceError,
    performanceRange,
    setPerformanceRange,
    refresh
  } = useDashboardData();

  return (
    <div className="space-y-6 sm:space-y-8">
      <Seo
        title="Dashboard – portfolio, performance and progression"
        description="Your NexaCrypto overview: live portfolio value, verified performance, membership, investment level progression, rewards, recent activity and live market prices."
        path="/"
        robots="noindex,nofollow"
      />

      <PortfolioOverview
        portfolio={portfolio}
        progression={progression}
        loading={loading}
        error={error}
        onRetry={refresh}
      />

      <QuickActions />

      <PerformanceOverview
        performance={performance}
        loading={performanceLoading}
        error={performanceError}
        range={performanceRange}
        onRangeChange={setPerformanceRange}
        onRetry={refresh}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <MembershipOverview
          membership={membership}
          loading={loading}
          error={membershipError}
          onRetry={refresh}
        />
        <InvestmentProgress
          progression={progression}
          loading={loading}
          error={error}
          onRetry={refresh}
        />
      </div>

      <RewardsOverview progression={progression} bonuses={bonuses} loading={loading} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <RecentActivity
          transactions={transactions}
          loading={loading}
          error={transactionsError}
          onRetry={refresh}
        />
        <MarketOverview />
      </div>
    </div>
  );
}
