import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { api } from "../utils/api";
import { generateInitials, getAvatarColor } from "../utils/avatar";
import { Seo } from "../components/Seo";
import {
  DEMO_LEADERBOARD,
  DEMO_LEADERBOARD_ENABLED,
  DEMO_LEADERBOARD_LABEL,
  DEMO_LEADERBOARD_NOTE
} from "../data/demoLeaderboard";
import {
  EmptyState,
  ErrorRow,
  ListRow,
  Metric,
  SkeletonBlock,
  StatStrip
} from "../components/dashboard/primitives";

type LeaderboardKind = "depositors" | "earnings" | "streaks" | "growth";

interface LeaderboardEntry {
  userId: string;
  alias: string;
  value: number;
  tier?: string | null;
  isDemo?: boolean;
}

const tabs: { id: LeaderboardKind; label: string; description: string }[] = [
  {
    id: "depositors",
    label: "Top Depositors",
    description: "Largest all-time confirmed deposits."
  },
  {
    id: "earnings",
    label: "Top Earners",
    description: "Highest confirmed value recorded this week."
  },
  {
    id: "streaks",
    label: "Highest Streaks",
    description: "Most consistent daily deposit streaks."
  },
  {
    id: "growth",
    label: "Fastest Growing",
    description: "Accounts with the strongest recent deposit growth."
  }
];

function getBadgeForRank(rank: number, value: number, category: LeaderboardKind): {
  label: string;
  class: string;
} {
  if (rank === 1) {
    return { label: "Whale", class: "bg-[#C6A15B]/20 text-[#C6A15B] border-[#C6A15B]/50" };
  }
  if (rank === 2) {
    return { label: "Elite", class: "bg-[#9CA3AF]/20 text-[#9CA3AF] border-[#9CA3AF]/50" };
  }
  if (rank === 3) {
    return { label: "Elite", class: "bg-[#9CA3AF]/20 text-[#9CA3AF] border-[#9CA3AF]/50" };
  }
  if (rank <= 5) {
    return { label: "Pro", class: "bg-[#627EEA]/20 text-[#627EEA] border-[#627EEA]/50" };
  }
  if (rank <= 10) {
    return { label: "Rising", class: "bg-[#16C784]/20 text-[#16C784] border-[#16C784]/50" };
  }
  return { label: "Newcomer", class: "bg-[#26272B] text-[#9CA3AF] border-[#26272B]" };
}

function formatValue(value: number, category: LeaderboardKind): string {
  if (category === "streaks") {
    return `${value} days`;
  }
  if (category === "growth") {
    return `+${value}%`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return `$${value.toFixed(2)}`;
}

function formatCountStat(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString();
}

function AvatarCircle({ name, size = 10 }: { name: string; size?: number }) {
  const initials = generateInitials(name);
  const color = getAvatarColor(name);
  const sizePx = size * 4;
  return (
    <div
      className="rounded-full flex items-center justify-center font-medium text-[#F5F5F7] flex-shrink-0"
      style={{
        backgroundColor: color,
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        fontSize: `${Math.max(10, sizePx * 0.4)}px`
      }}
    >
      {initials}
    </div>
  );
}

export function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<LeaderboardKind>("depositors");
  const [realEntries, setRealEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async (kind: LeaderboardKind) => {
    setLoading(true);
    setError(null);
    setRealEntries([]);
    try {
      const res = await api.get<LeaderboardEntry[]>(`/leaderboard/${kind}`);
      setRealEntries(
        Array.isArray(res.data)
          ? res.data.map((entry) => ({ ...entry, tier: entry.tier ?? null, isDemo: false }))
          : []
      );
    } catch {
      setRealEntries([]);
      setError("The live leaderboard is unavailable right now. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeTab);
  }, [activeTab]);

  // Demo entries are used only as a fallback while verified leaderboard data is
  // unavailable, and are always rendered under an explicit demo label.
  const usingDemo = DEMO_LEADERBOARD_ENABLED && !loading && realEntries.length === 0;
  const entries: LeaderboardEntry[] = usingDemo
    ? DEMO_LEADERBOARD[activeTab].map((entry) => ({
        userId: `demo-${activeTab}-${entry.rank}`,
        alias: entry.alias,
        value: entry.value,
        tier: entry.tier,
        isDemo: true
      }))
    : realEntries;

  // Community stats reflect live data only — never the illustrative dataset.
  const communityStats = {
    liveEntries: realEntries.length,
    topValue: realEntries.length > 0 ? formatValue(realEntries[0].value, activeTab) : null
  };

  const topThree = entries.slice(0, 3);
  const remainingEntries = entries.slice(3);

  const formatValueDisplay = (value: number): string => {
    return formatValue(value, activeTab);
  };

  return (
    <div className="page-responsive borderless-ui min-w-0 space-y-8 overflow-x-hidden">
      <Seo
        title="Leaderboards – platform activity"
        description="Explore confirmed deposit activity across NexaCrypto: top depositors, top earners, highest streaks and fastest growing accounts."
        path="/leaderboards"
      />
      <section className="space-y-2">
        <h1 className="display-font text-2xl font-semibold tracking-tight text-[#F5F5F7] sm:text-3xl">
          Leaderboards
        </h1>
        <p className="max-w-2xl text-sm text-[#9CA3AF]">
          See which accounts hold the largest confirmed deposits, the strongest streaks
          and the fastest recent growth across the platform.
        </p>
      </section>

      <section className="min-w-0 space-y-6 rounded-3xl bg-[#17181A]/60 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-6">
        <div className="pb-1 md:overflow-visible">
          <div className="grid grid-cols-2 gap-2 pb-2 sm:flex sm:flex-wrap sm:gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative w-full px-3 py-2 rounded-full text-xs font-medium transition-colors sm:w-auto ${
                    isActive
                      ? "text-[#C6A15B]"
                      : "text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-[#17181A]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="pointer-events-none absolute inset-x-3 -bottom-1 h-[2px] rounded-full bg-[#C6A15B]" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-[#9CA3AF]">
          {tabs.find((t) => t.id === activeTab)?.description}
        </p>

        {usingDemo && (
          <div className="flex flex-col gap-1 rounded-2xl border border-[#C6A15B]/30 bg-[#C6A15B]/8 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-2.5">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C6A15B]">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              {DEMO_LEADERBOARD_LABEL}
            </span>
            <span className="text-[11px] leading-relaxed text-[#9CA3AF]">
              {DEMO_LEADERBOARD_NOTE}
            </span>
          </div>
        )}

        {error && <ErrorRow message={error} onRetry={() => load(activeTab)} />}

        {loading && realEntries.length === 0 && (
          <div className="space-y-3 py-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBlock key={`leaderboard-skeleton-${index}`} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {!loading && entries.length === 0 && (
          <EmptyState
            title="No leaderboard entries yet"
            description="Rankings appear here once accounts have confirmed platform activity. Make a deposit to get started."
            action={
              <button
                type="button"
                onClick={() => navigate("/deposit")}
                className="btn btn-md btn-primary w-full sm:w-auto"
              >
                Start depositing
              </button>
            }
          />
        )}

        {entries.length > 0 && (
          <>
            {entries.some((entry) => entry.isDemo) && (
              <p
                aria-hidden="true"
                className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]"
              >
                Rank · Account · Membership tier · Illustrative value
              </p>
            )}
            {topThree.length > 0 && (
              <div className="space-y-6 overflow-hidden">
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {topThree.map((entry, index) => {
                    const rank = index + 1;
                    const isFirst = rank === 1;
                    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
                    const medalClass =
                      rank === 1
                        ? "bg-gradient-to-br from-[#C6A15B]/30 to-[#C6A15B]/10 border-[#C6A15B]/50 shadow-[0_0_32px_rgba(198,161,91,0.3)]"
                        : rank === 2
                        ? "bg-gradient-to-br from-[#9CA3AF]/20 to-[#9CA3AF]/10 border-[#9CA3AF]/40"
                        : "bg-gradient-to-br from-[#F7931A]/20 to-[#F7931A]/10 border-[#F7931A]/40";

                    return (
                      <motion.div
                        key={entry.userId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`relative mx-auto min-w-0 w-full max-w-[19rem] rounded-2xl border p-4 sm:max-w-none ${medalClass} ${
                          isFirst ? "md:order-2" : rank === 2 ? "md:order-1" : "md:order-3"
                        }`}
                      >
                        <div className="flex flex-col items-center space-y-2.5">
                          <div className="text-3xl">{medal}</div>
                          <AvatarCircle name={entry.alias} size={14} />
                          <div className="w-full max-w-[14rem] text-center space-y-1">
                            <p className="truncate text-sm font-medium text-[#F5F5F7]">
                              {entry.alias}
                            </p>
                            {entry.tier ? (
                              <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[#9CA3AF]">
                                {entry.tier}
                              </p>
                            ) : null}
                            <p className="financial-figure text-base font-semibold text-[#C6A15B]">
                              {formatValueDisplay(entry.value)}
                            </p>
                          </div>
                          {entry.isDemo ? (
                            <span className="rounded-full border border-[#C6A15B]/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#C6A15B]">
                              Demo
                            </span>
                          ) : null}
                          {isFirst && (
                            <div className="absolute right-1 top-1 h-3.5 w-3.5 rounded-full bg-[#C6A15B] animate-pulse" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {remainingEntries.length > 0 && (
              <div className="border-t border-[#26272B] pt-4">
                {remainingEntries.map((entry, index) => {
                  const rank = index + 4;
                  const badge = getBadgeForRank(rank, entry.value, activeTab);
                  return (
                    <ListRow key={entry.userId} className="gap-3">
                      <span className="financial-figure w-5 shrink-0 text-xs text-[#6B7280]">
                        {rank}
                      </span>
                      <AvatarCircle name={entry.alias} size={9} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#F5F5F7]">
                        {entry.alias}
                      </span>
                      {entry.tier ? (
                        <span className="hidden shrink-0 items-center rounded-full border border-[#26272B] px-2.5 py-1 text-[10px] font-medium text-[#9CA3AF] md:inline-flex">
                          {entry.tier}
                        </span>
                      ) : null}
                      <span className="financial-figure shrink-0 text-sm font-medium text-[#F5F5F7]">
                        {formatValueDisplay(entry.value)}
                      </span>
                      <span
                        className={`hidden shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${badge.class}`}
                      >
                        {badge.label}
                      </span>
                    </ListRow>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-3xl bg-[#17181A]/60 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-6">
        <h2 className="display-font mb-1 text-lg font-semibold text-[#F5F5F7]">Live platform stats</h2>
        <p className="mb-4 text-xs text-[#9CA3AF]">
          Verified figures from the live leaderboard. Illustrative demo entries above are excluded.
        </p>
        <StatStrip>
          <Metric label="Live leaderboard entries" value={formatCountStat(communityStats.liveEntries)} />
          <Metric label="Top live value" value={communityStats.topValue ?? "—"} />
          <Metric
            label="Data source"
            value={communityStats.liveEntries > 0 ? "Live API" : "Awaiting verified data"}
          />
        </StatStrip>
      </section>
    </div>
  );
}
