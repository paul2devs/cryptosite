export interface LeaderboardSeedEntry {
  userId: string;
  alias: string;
  value: number;
}

export const topDepositorsSeed: LeaderboardSeedEntry[] = [
  { userId: "seed-1", alias: "CryptoKing", value: 120000 },
  { userId: "seed-2", alias: "AlphaWolf", value: 95000 },
  { userId: "seed-3", alias: "BTCMaster", value: 80000 },
  { userId: "seed-4", alias: "EtherLord", value: 65000 },
  { userId: "seed-5", alias: "SolanaPro", value: 52000 },
  { userId: "seed-6", alias: "ChainRunner", value: 45000 },
  { userId: "seed-7", alias: "MoonShot", value: 38000 },
  { userId: "seed-8", alias: "CryptoZen", value: 32000 },
  { userId: "seed-9", alias: "NodeMaster", value: 28000 },
  { userId: "seed-10", alias: "BitRiser", value: 25000 }
];

export const weeklyEarnersSeed: LeaderboardSeedEntry[] = [
  { userId: "seed-e1", alias: "LunaTrader", value: 3200 },
  { userId: "seed-e2", alias: "BlockHero", value: 2900 },
  { userId: "seed-e3", alias: "EtherLord", value: 2500 },
  { userId: "seed-e4", alias: "CryptoKing", value: 2200 },
  { userId: "seed-e5", alias: "AlphaWolf", value: 1900 },
  { userId: "seed-e6", alias: "SolanaPro", value: 1700 },
  { userId: "seed-e7", alias: "ChainRunner", value: 1500 },
  { userId: "seed-e8", alias: "MoonShot", value: 1300 },
  { userId: "seed-e9", alias: "CryptoZen", value: 1100 },
  { userId: "seed-e10", alias: "NodeMaster", value: 950 }
];

export const highestStreaksSeed: LeaderboardSeedEntry[] = [
  { userId: "seed-s1", alias: "ChainRunner", value: 42 },
  { userId: "seed-s2", alias: "CryptoZen", value: 38 },
  { userId: "seed-s3", alias: "NodeMaster", value: 35 },
  { userId: "seed-s4", alias: "CryptoKing", value: 32 },
  { userId: "seed-s5", alias: "AlphaWolf", value: 28 },
  { userId: "seed-s6", alias: "BTCMaster", value: 25 },
  { userId: "seed-s7", alias: "EtherLord", value: 22 },
  { userId: "seed-s8", alias: "SolanaPro", value: 19 },
  { userId: "seed-s9", alias: "MoonShot", value: 16 },
  { userId: "seed-s10", alias: "BitRiser", value: 14 }
];

export const fastestGrowingSeed: LeaderboardSeedEntry[] = [
  { userId: "seed-g1", alias: "MoonShot", value: 320 },
  { userId: "seed-g2", alias: "AltHunter", value: 280 },
  { userId: "seed-g3", alias: "BitRiser", value: 250 },
  { userId: "seed-g4", alias: "ChainRunner", value: 220 },
  { userId: "seed-g5", alias: "CryptoZen", value: 190 },
  { userId: "seed-g6", alias: "NodeMaster", value: 165 },
  { userId: "seed-g7", alias: "SolanaPro", value: 140 },
  { userId: "seed-g8", alias: "EtherLord", value: 120 },
  { userId: "seed-g9", alias: "AlphaWolf", value: 105 },
  { userId: "seed-g10", alias: "CryptoKing", value: 90 }
];

export function getSeedDataForCategory(
  category: "depositors" | "earnings" | "streaks" | "growth"
): LeaderboardSeedEntry[] {
  switch (category) {
    case "depositors":
      return topDepositorsSeed;
    case "earnings":
      return weeklyEarnersSeed;
    case "streaks":
      return highestStreaksSeed;
    case "growth":
      return fastestGrowingSeed;
    default:
      return [];
  }
}

export function mergeLeaderboardData(
  realData: LeaderboardSeedEntry[],
  seedData: LeaderboardSeedEntry[]
): LeaderboardSeedEntry[] {
  const combined = [...realData, ...seedData];
  const sorted = [...combined].sort((a, b) => b.value - a.value);
  const seen = new Set<string>();
  const merged: LeaderboardSeedEntry[] = [];
  
  for (const entry of sorted) {
    if (!seen.has(entry.userId)) {
      seen.add(entry.userId);
      merged.push(entry);
    }
  }
  
  return merged.slice(0, 20);
}
