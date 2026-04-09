import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { generateInitials, getAvatarColor } from "../utils/avatar";
import { Seo } from "../components/Seo";
import {
  getSeedDataForCategory,
  mergeLeaderboardData,
  type LeaderboardSeedEntry
} from "../data/leaderboardSeed";

type LeaderboardKind = "depositors" | "earnings" | "streaks" | "growth";

interface LeaderboardEntry {
  userId: string;
  alias: string;
  value: number;
}

const tabs: { id: LeaderboardKind; label: string; description: string }[] = [
  {
    id: "depositors",
    label: "Top Depositors",
    description: "Largest all-time approved deposits."
  },
  {
    id: "earnings",
    label: "Weekly Earners",
    description: "Highest pending earnings unlocked this week."
  },
  {
    id: "streaks",
    label: "Highest Streaks",
    description: "Most consistent daily deposit streaks."
  },
  {
    id: "growth",
    label: "Fastest Growing",
    description: "Accounts with the strongest recent growth."
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
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [communityStats, setCommunityStats] = useState({
    totalDeposits: 0,
    activeDepositors: 0,
    highestDeposit: 0
  });
  const navigate = useNavigate();

  const load = async (kind: LeaderboardKind) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<LeaderboardEntry[]>(`/leaderboard/${kind}`);
      const realData = res.data || [];
      const seedData = getSeedDataForCategory(kind);
      const merged = mergeLeaderboardData(realData, seedData);
      setEntries(merged);
    } catch {
      const seedData = getSeedDataForCategory(kind);
      setEntries(seedData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [portfolioRes] = await Promise.all([
          api.get<{ totalPlatformBalance: number }>("/portfolio/summary").catch(() => null)
        ]);
        if (portfolioRes?.data) {
          setCommunityStats({
            totalDeposits: portfolioRes.data.totalPlatformBalance || 0,
            activeDepositors: entries.length || 0,
            highestDeposit: entries.length > 0 ? entries[0].value : 0
          });
        }
      } catch {
        setCommunityStats({
          totalDeposits: 0,
          activeDepositors: entries.length,
          highestDeposit: entries.length > 0 ? entries[0].value : 0
        });
      }
    };
    loadStats();
  }, [entries]);

  const topThree = entries.slice(0, 3);
  const remainingEntries = entries.slice(3);

  const formatValueDisplay = (value: number): string => {
    return formatValue(value, activeTab);
  };

  return (
    <div className="page-responsive borderless-ui min-w-0 space-y-8 overflow-x-hidden">
      <Seo
        title="Leaderboards – social proof and top performers"
        description="Explore top depositors, weekly earners, highest streaks and fastest growing accounts across Crypto Levels."
        path="/leaderboards"
      />
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[#F5F5F7]">
          Leaderboards
        </h1>
        <p className="text-sm text-[#9CA3AF] max-w-2xl">
          See who is depositing the most, earning the fastest, and maintaining the
          strongest streaks across the platform.
        </p>
      </section>

      <section className="min-w-0 rounded-3xl bg-[#17181A]/60 px-4 py-5 sm:px-6 sm:py-6 space-y-6 backdrop-blur-sm">
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

        {error && (
          <div className="rounded-xl bg-[#EA3943]/10 px-4 py-3">
            <p className="text-xs text-[#EA3943]">{error}</p>
          </div>
        )}

        {loading && entries.length === 0 && (
          <div className="py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#C6A15B]/30 border-t-[#C6A15B]" />
            <p className="mt-3 text-sm text-[#9CA3AF]">Loading leaderboard...</p>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="py-16 text-center space-y-4">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-lg font-medium text-[#F5F5F7]">
              The leaderboard is waiting for its first champions.
            </h3>
            <p className="text-sm text-[#9CA3AF] max-w-md mx-auto">
              Start depositing and you could be the first top performer on the platform.
            </p>
            <button
              type="button"
              onClick={() => navigate("/deposit")}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#C6A15B] px-6 py-3 text-center text-sm font-medium text-[#0F0F10] shadow-[0_0_24px_rgba(198,161,91,0.4)] hover:shadow-[0_0_32px_rgba(198,161,91,0.6)] transition-shadow sm:w-auto mt-4"
            >
              Start Depositing
            </button>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <>
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
                            <p className="text-base font-semibold text-[#C6A15B]">
                              {formatValueDisplay(entry.value)}
                            </p>
                          </div>
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
              <div className="border-t border-[#26272B] pt-6">
                <div className="w-full overflow-x-auto rounded-xl bg-[#0F0F10]">
                  <table className="w-full min-w-[560px] table-fixed">
                    <thead className="bg-[#17181A]">
                      <tr>
                        <th className="w-16 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
                          Rank
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
                          User
                        </th>
                        <th className="w-32 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
                          Score
                        </th>
                        <th className="w-28 px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[#9CA3AF]">
                          Badge
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#26272B]">
                      <AnimatePresence>
                        {remainingEntries.map((entry, index) => {
                          const rank = index + 4;
                          const badge = getBadgeForRank(rank, entry.value, activeTab);
                          return (
                            <motion.tr
                              key={entry.userId}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: (index + 3) * 0.05 }}
                              className="transition-colors hover:bg-[#17181A]/50"
                            >
                              <td className="px-4 py-3 text-sm text-[#9CA3AF]">
                                {rank}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <div className="flex min-w-0 items-center gap-3">
                                  <AvatarCircle name={entry.alias} size={10} />
                                  <span className="min-w-0 truncate text-sm font-medium text-[#F5F5F7]">
                                    {entry.alias}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-medium text-[#F5F5F7]">
                                {formatValueDisplay(entry.value)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${badge.class}`}
                                >
                                  {badge.label}
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-3xl bg-[#17181A]/60 px-4 py-5 sm:px-6 sm:py-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-[#F5F5F7] mb-4">Community Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-[#0F0F10]/80 px-4 py-4">
            <p className="text-xs uppercase tracking-wider text-[#9CA3AF] mb-2">
              Total Platform Deposits
            </p>
            <p className="text-xl font-semibold text-[#F5F5F7]">
              ${communityStats.totalDeposits.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </p>
          </div>
          <div className="rounded-xl bg-[#0F0F10]/80 px-4 py-4">
            <p className="text-xs uppercase tracking-wider text-[#9CA3AF] mb-2">
              Active Depositors
            </p>
            <p className="text-xl font-semibold text-[#F5F5F7]">
              {communityStats.activeDepositors}
            </p>
          </div>
          <div className="rounded-xl bg-[#0F0F10]/80 px-4 py-4">
            <p className="text-xs uppercase tracking-wider text-[#9CA3AF] mb-2">
              Highest Deposit
            </p>
            <p className="text-xl font-semibold text-[#F5F5F7]">
              ${communityStats.highestDeposit.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
