import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Gift, Zap, Target, Wallet, ArrowUpCircle } from "lucide-react";
import type { RootState } from "../store";
import { LevelProgress } from "../components/LevelProgress";
import { MarketWidget } from "../components/MarketWidget";
import { api } from "../utils/api";
import { useNotificationContext } from "../components/NotificationProvider";
import type { ActivityEvent } from "../data/activityFeed";
import { Seo } from "../components/Seo";

interface ProgressionResponse {
  level: number;
  xp: number;
  currentLevel: {
    level_id: number;
    level_name: string;
    required_xp: number;
    multiplier_base: number;
  };
  nextLevel: {
    level_id: number;
    level_name: string;
    required_xp: number;
    multiplier_base: number;
  } | null;
  xpToNext: number | null;
  multiplierPreview: {
    baseMultiplier: number;
    streakBonus: number;
    timeBonus: number;
    referralBonus: number;
    totalMultiplier: number;
  };
  pendingEarningsTotal: number;
  streak: number;
  withdrawableBalance: number;
  lockedBalance: number;
  depositLevel: number;
  totalDepositedUsd: number;
  depositCurrentLevelRequiredTotal: number;
  depositNextLevel: number | null;
  depositNextLevelRequiredTotal: number | null;
  depositRemainingToNext: number | null;
}

interface SocialFeedItem {
  deposit_id: string;
  alias: string;
  amount: number;
  crypto_type: string;
  timestamp: string;
}

interface AIProfileResponse {
  deposit_pattern_score: number;
  engagement_score: number;
  churn_risk_score: number;
  optimal_bonus_type: string | null;
  last_ai_update: string | null;
  behavior_score: number;
  behavior_risk_level: string;
}

interface PortfolioAssetSummary {
  symbol: string;
  totalDeposited: number;
  currentValue: number;
}

interface PortfolioSummaryResponse {
  assets: PortfolioAssetSummary[];
  totalCurrentValue: number;
  pendingEarnings: number;
  totalPlatformBalance: number;
  growthSeries: { date: string; deposited: number; value: number }[];
  projectedEarnings: { currentMultiplier: number; projectedValue: number };
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) {
    return "$0.00";
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${value.toLocaleString(undefined, {
      maximumFractionDigits: 0
    })}`;
  }
  return `$${value.toFixed(2)}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export function DashboardPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const [progression, setProgression] = useState<ProgressionResponse | null>(
    null
  );
  const [socialFeed, setSocialFeed] = useState<SocialFeedItem[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [ai, setAi] = useState<AIProfileResponse | null>(null);
  const [activeBonuses, setActiveBonuses] = useState<
    { bonus_id: string; label: string; multiplier: number; end_time: string }[]
  >([]);
  const [portfolioSummary, setPortfolioSummary] =
    useState<PortfolioSummaryResponse | null>(null);
  const [animatedPortfolioValue, setAnimatedPortfolioValue] = useState(0);
  const portfolioAnimationRef = useRef<number | null>(null);
  const { activityEvents } = useNotificationContext();

  useEffect(() => {
    const load = async () => {
      try {
        const [progRes, feedRes, bonusRes, portfolioRes] = await Promise.all([
          api.get<ProgressionResponse>("/user/current_xp_level"),
          api.get<SocialFeedItem[]>("/social_feed"),
          api.get<
            { bonus_id: string; label: string; multiplier: number; end_time: string }[]
          >("/bonuses/active"),
          api.get<PortfolioSummaryResponse>("/portfolio/summary")
        ]);
        setProgression(progRes.data);
        setSocialFeed(feedRes.data);
        setActiveBonuses(bonusRes.data);
        setPortfolioSummary(portfolioRes.data);
      } catch {
        setProgression(null);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadAI = async () => {
      try {
        const res = await api.get<AIProfileResponse>("/ai/me");
        setAi(res.data);
      } catch {
        setAi(null);
      }
    };
    loadAI();
    const interval = setInterval(loadAI, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!portfolioSummary) {
      return;
    }

    if (portfolioAnimationRef.current !== null) {
      cancelAnimationFrame(portfolioAnimationRef.current);
    }

    const startValue = animatedPortfolioValue;
    const endValue = portfolioSummary.totalCurrentValue;
    const duration = 800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = startValue + (endValue - startValue) * eased;
      setAnimatedPortfolioValue(value);
      if (t < 1) {
        portfolioAnimationRef.current = requestAnimationFrame(tick);
      }
    };

    portfolioAnimationRef.current = requestAnimationFrame(tick);

    return () => {
      if (portfolioAnimationRef.current !== null) {
        cancelAnimationFrame(portfolioAnimationRef.current);
      }
    };
  }, [portfolioSummary]);

  useEffect(() => {
    if (!progression) {
      return;
    }
    if (user && progression.level > user.level) {
      setShowConfetti(true);
      const timeout = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timeout);
    }
  }, [progression, user]);

  if (!user) {
    return null;
  }

  const displayName = getDisplayName(user.name, user.email);

  return (
    <div className="space-y-8">
      <Seo
        title="Dashboard – live levels, multipliers and rewards"
        description="View your Crypto Levels dashboard with live XP, level progression, streaks, multipliers, pending earnings and real-time market-backed portfolio value."
        path="/"
      />
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#F5F5F7]">
            {getGreeting()}, {displayName}
          </p>
        </div>
      </section>
      <section className="relative flex flex-col gap-4 lg:flex-row">
        <AnimatePresence>
          {showConfetti && (
            <motion.div
              className="pointer-events-none absolute inset-0 flex items-start justify-center"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="mt-4 rounded-full bg-emerald-500/20 px-4 py-1 text-xs font-semibold text-emerald-200 border border-emerald-400/60">
                Level up unlocked
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="relative flex-1 rounded-3xl bg-[#17181A]/60 px-4 py-4 sm:px-6 sm:py-5 overflow-hidden backdrop-blur-sm">
          <div className="absolute inset-0 opacity-10 pointer-events-none dashboard-hero-chart" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
              <span>TOTAL PORTFOLIO VALUE</span>
              <span className="text-[10px]">
                Level {progression?.depositLevel ?? 0} · Streak{" "}
                {progression?.streak ?? user.streak ?? 0} days
              </span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F5F5F7]">
                  {formatUsd(animatedPortfolioValue || 0)}
                </div>
                <div className="mt-2 text-xs text-[#9CA3AF]">
                  Approved deposits valued at live market rates.
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-end gap-1 text-xs text-[#9CA3AF]">
                <span>
                  Approved deposits:{" "}
                  <span className="text-[#F5F5F7]">
                    {formatUsd(progression?.totalDepositedUsd ?? 0)}
                  </span>
                </span>
                <span>
                  Pending earnings:{" "}
                  <span className="text-[#16C784]">
                    {(progression?.pendingEarningsTotal ?? 0).toFixed(4)}
                  </span>
                </span>
              </div>
            </div>
            <div className="space-y-3 mt-1">
              <LevelProgress
                level={progression?.depositLevel ?? 0}
                xp={progression?.xp ?? user.xp}
                nextLevelRequiredXp={progression?.nextLevel?.required_xp ?? null}
              />
              <div className="flex flex-row flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/deposit")}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-4 py-2.5 text-sm font-medium text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_25px_rgba(198,161,91,0.45)] transition-shadow"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Deposit</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/withdraw")}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#C6A15B] bg-transparent px-4 py-2.5 text-sm font-medium text-[#C6A15B] hover:bg-[#C6A15B]/10 transition-colors"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  <span>Withdraw</span>
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-3 text-[11px] text-[#9CA3AF] sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-0.5">
                  <p>
                    Total approved deposits{" "}
                    <span className="block text-sm font-medium text-[#F5F5F7]">
                      {formatUsd(progression?.totalDepositedUsd ?? 0)}
                    </span>
                  </p>
                </div>
                <div className="space-y-0.5 sm:text-right">
                  <p className="flex items-center justify-between">
                    <span>Next Level</span>
                    <span className="text-xs text-[#F5F5F7]">
                      {progression?.depositNextLevel
                        ? `Level ${progression.depositNextLevel}`
                        : "Maxed"}
                    </span>
                  </p>
                  {progression?.depositNextLevelRequiredTotal && (
                    <p className="text-[11px]">
                      Required:{" "}
                      {formatUsd(
                        progression.depositNextLevelRequiredTotal ?? 0
                      )}{" "}
                      · Remaining:{" "}
                      <span className="text-[#C6A15B]">
                        {formatUsd(progression.depositRemainingToNext ?? 0)}
                      </span>
                    </p>
                  )}
                  {!progression?.depositNextLevelRequiredTotal && (
                    <p className="text-[11px]">
                      You have reached the highest deposit tier.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full max-w-xs rounded-3xl bg-[#17181A]/70 px-4 py-4 sm:px-5 sm:py-5 space-y-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
            <span>Pending Earnings</span>
          </div>
          <div className="text-2xl font-semibold text-[#16C784] tracking-tight">
            {(progression?.pendingEarningsTotal ?? 0).toFixed(4)}
          </div>
          <div className="space-y-1 text-[11px] text-[#9CA3AF]">
            <p>
              Current multiplier{" "}
              <span className="text-[#16C784]">
                x
                {progression
                  ? progression.multiplierPreview.totalMultiplier.toFixed(2)
                  : "1.10"}
              </span>
            </p>
            <p>
              Level base x
              {progression
                ? progression.multiplierPreview.baseMultiplier.toFixed(2)
                : "1.00"}{" "}
              · Streak bonus{" "}
              {progression
                ? (progression.multiplierPreview.streakBonus * 100).toFixed(0)
                : "0"}
              %
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-[#9CA3AF]">
                Withdrawable{" "}
                <span className="block text-xs text-[#F5F5F7]">
                  {(progression?.withdrawableBalance ?? 0).toFixed(4)}
                </span>
              </span>
              <span className="text-[#9CA3AF] text-right">
                Locked{" "}
                <span className="block text-xs text-[#F5F5F7]">
                  {(progression?.lockedBalance ?? 0).toFixed(4)}
                </span>
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-6 xl:flex-row">
        <div className="flex-1 rounded-3xl bg-[#17181A]/60 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-[#F5F5F7]">
                Rewards & Missions
              </h2>
              <p className="text-[11px] text-[#9CA3AF]">
                Your earnings, bonuses, and next deposit target.
              </p>
            </div>
            <span className="text-[10px] text-[#9CA3AF]">
              Updated{" "}
              {ai?.last_ai_update
                ? new Date(ai.last_ai_update).toLocaleString()
                : "—"}
            </span>
          </div>
          <div className="space-y-3">
              <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-2xl bg-[#17181A]/80 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16C784]/12 text-[#16C784]">
                  <Gift className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-[#F5F5F7]">
                      Rewards
                    </p>
                    <p className="text-xs text-[#16C784]">
                      {(progression?.pendingEarningsTotal ?? 0).toFixed(4)}{" "}
                      pending
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                    <span>
                      Withdrawable:{" "}
                      <span className="text-[#F5F5F7]">
                        {(progression?.withdrawableBalance ?? 0).toFixed(4)}
                      </span>
                    </span>
                    <span>
                      Locked:{" "}
                      <span className="text-[#F5F5F7]">
                        {(progression?.lockedBalance ?? 0).toFixed(4)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#17181A]/80 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#C6A15B]/12 text-[#C6A15B]">
                  <Zap className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium text-[#F5F5F7]">Bonuses</p>
                  {activeBonuses.length === 0 && (
                    <p className="text-[11px] text-[#9CA3AF]">
                      No time-limited bonuses active. Normal multipliers apply.
                    </p>
                  )}
                  {activeBonuses.length > 0 && (
                    <>
                      <p className="text-[11px] text-[#F5F5F7]">
                        {activeBonuses[0].label}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Combined bonus x
                        {activeBonuses
                          .reduce((acc, b) => acc * b.multiplier, 1)
                          .toFixed(2)}{" "}
                        on new deposits.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-[#17181A]/80 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16C784]/10 text-[#16C784]">
                  <Target className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-medium text-[#F5F5F7]">Missions</p>
                  <p className="text-[11px] text-[#F5F5F7]">
                    Next deposit target{" "}
                    {progression?.depositNextLevel
                      ? `Level ${progression.depositNextLevel}`
                      : "Maxed"}
                  </p>
                  {progression?.depositNextLevelRequiredTotal && (
                    <p className="text-[11px] text-[#9CA3AF]">
                      Need{" "}
                      <span className="text-[#C6A15B]">
                        {formatUsd(progression.depositRemainingToNext ?? 0)}
                      </span>{" "}
                      more approved deposits.
                    </p>
                  )}
                  <p className="text-[11px] text-[#9CA3AF]">
                    Maintain streak of{" "}
                    {progression?.streak ?? user.streak ?? 0} days to keep
                    multipliers active.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full max-w-sm rounded-3xl bg-[#17181A]/60 px-4 py-4 sm:px-5 sm:py-5 space-y-3">
          <h2 className="text-sm font-medium text-[#F5F5F7]">Safety Status</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
              <span>Behavior Score</span>
              <span className="text-xs text-[#F5F5F7]">
                {ai ? Math.round(ai.behavior_score) : 50}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#26272B] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#16C784] transition-all"
                style={{
                  width: `${
                    ai ? Math.max(4, Math.min(100, ai.behavior_score)) : 50
                  }%`
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
              <span>Risk Level</span>
              <span className="inline-flex items-center rounded-full bg-[#16C784]/15 px-2 py-0.5 text-[11px] text-[#16C784]">
                {(ai?.behavior_risk_level || "low").toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF]">
              Consistent, moderate deposit behavior helps keep your risk profile
              low and your account in good standing.
            </p>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-6 lg:flex-row">
        <div className="md:col-span-2">
          <MarketWidget />
        </div>
        <div className="rounded-3xl bg-[#17181A]/60 px-4 py-4 sm:px-5 sm:py-5 space-y-3 overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-[#F5F5F7]">
                Community Activity
              </h2>
              <p className="text-[11px] text-[#9CA3AF]">
                Live deposits and milestones from the community.
              </p>
            </div>
          </div>
          {socialFeed.length === 0 && activityEvents.length === 0 && (
            <p className="mt-2 text-[11px] text-[#9CA3AF]">
              You are early. New deposits from the community will appear here.
            </p>
          )}
          {(socialFeed.length > 0 || activityEvents.length > 0) && (
            <div className="mt-2 space-y-2">
              {buildCommunityItems(socialFeed, activityEvents)
                .slice(0, 5)
                .map((item, index) => (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={`${item.id}-${index}`}
                    className="flex items-center gap-2 rounded-xl bg-[#17181A] px-3 py-2 text-[11px] text-[#F5F5F7]"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-[#C6A15B] via-[#17181A] to-[#16C784] text-[10px] font-semibold flex-shrink-0">
                      {item.initials}
                    </div>
                    <span className="text-[#F5F5F7]">{item.text}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getDisplayName(name: string | null | undefined, email: string): string {
  if (name && name.trim().length > 0) {
    const trimmed = name.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  const localPart = email.split("@")[0] || "";
  if (!localPart) {
    return "Guest";
  }
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

function buildCommunityItems(
  backendItems: SocialFeedItem[],
  activityItems: ActivityEvent[]
) {
  const backendMapped = backendItems.map((item) => ({
    id: item.deposit_id,
    initials: item.alias.charAt(0).toUpperCase(),
    text: `${item.alias} deposited ${item.amount} ${item.crypto_type}`,
    timestamp: item.timestamp
  }));
  const activityMapped = activityItems.map((event) => ({
    id: event.id,
    initials: event.userName.charAt(0).toUpperCase(),
    text: event.description,
    timestamp: Date.now().toString()
  }));
  const combined = [...backendMapped, ...activityMapped];
  
  const seen = new Set<string>();
  const deduplicated: typeof combined = [];
  const timeWindow = 60000;
  
  for (const item of combined) {
    const key = `${item.text}-${item.initials}`;
    const now = Date.now();
    const itemTime = new Date(item.timestamp || now).getTime();
    
    let isDuplicate = false;
    for (const existing of deduplicated) {
      const existingTime = new Date(existing.timestamp || now).getTime();
      if (
        existing.text === item.text &&
        existing.initials === item.initials &&
        Math.abs(existingTime - itemTime) < timeWindow
      ) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate && !seen.has(key)) {
      seen.add(key);
      deduplicated.push(item);
    }
  }
  
  return deduplicated;
}

