/**
 * Illustrative leaderboard dataset.
 *
 * These entries are fictional and exist only so the leaderboard page has
 * something meaningful to render before genuine, consented leaderboard data is
 * available. Nothing here is written to the database, and nothing here is
 * derived from real accounts, deposits, balances or earnings.
 *
 * To switch to live data:
 *  1. Set `DEMO_LEADERBOARD_ENABLED` to `false`.
 *  2. The page then renders the live `/api/leaderboard/*` response only.
 *
 * Once the real API returns verified entries the page automatically prefers it
 * and hides the demo label, even with demo mode left enabled.
 */

export type DemoLeaderboardKind = "depositors" | "earnings" | "streaks" | "growth";

export interface DemoLeaderboardEntry {
  rank: number;
  alias: string;
  tier: string;
  value: number;
}

export const DEMO_LEADERBOARD_ENABLED = true;

export const DEMO_LEADERBOARD_LABEL = "DEMO DATA — Illustrative leaderboard";

export const DEMO_LEADERBOARD_NOTE =
  "Sample entries shown for illustration only. They are not real accounts and do not represent verified deposits, balances, earnings or growth.";

export const DEMO_LEADERBOARD: Record<DemoLeaderboardKind, DemoLeaderboardEntry[]> = {
  depositors: [
    { rank: 1, alias: "CryptoVoyager", tier: "Private Client", value: 248000 },
    { rank: 2, alias: "EmeraldWave", tier: "Diamond", value: 186500 },
    { rank: 3, alias: "Alex_R", tier: "Diamond", value: 154200 },
    { rank: 4, alias: "BlockPilot", tier: "Diamond", value: 132800 },
    { rank: 5, alias: "DigitalHorizon", tier: "Platinum", value: 98750 },
    { rank: 6, alias: "AtlasCrypto", tier: "Platinum", value: 76400 },
    { rank: 7, alias: "NovaTrader", tier: "Diamond", value: 58200 },
    { rank: 8, alias: "WealthPath", tier: "Gold", value: 41300 },
    { rank: 9, alias: "ChainExplorer", tier: "Gold", value: 27600 },
    { rank: 10, alias: "BTCNomad", tier: "Gold", value: 15900 }
  ],
  earnings: [
    { rank: 1, alias: "EmeraldWave", tier: "Diamond", value: 8420 },
    { rank: 2, alias: "CryptoVoyager", tier: "Private Client", value: 7150 },
    { rank: 3, alias: "AtlasCrypto", tier: "Platinum", value: 5890 },
    { rank: 4, alias: "DigitalHorizon", tier: "Platinum", value: 4120 },
    { rank: 5, alias: "BlockPilot", tier: "Diamond", value: 3640 },
    { rank: 6, alias: "NovaTrader", tier: "Diamond", value: 2870 },
    { rank: 7, alias: "Alex_R", tier: "Diamond", value: 2210 },
    { rank: 8, alias: "BTCNomad", tier: "Gold", value: 1650 },
    { rank: 9, alias: "WealthPath", tier: "Gold", value: 1180 },
    { rank: 10, alias: "ChainExplorer", tier: "Gold", value: 740 }
  ],
  streaks: [
    { rank: 1, alias: "ChainExplorer", tier: "Gold", value: 268 },
    { rank: 2, alias: "WealthPath", tier: "Gold", value: 241 },
    { rank: 3, alias: "NovaTrader", tier: "Diamond", value: 214 },
    { rank: 4, alias: "BTCNomad", tier: "Gold", value: 187 },
    { rank: 5, alias: "DigitalHorizon", tier: "Platinum", value: 152 },
    { rank: 6, alias: "Alex_R", tier: "Diamond", value: 131 },
    { rank: 7, alias: "AtlasCrypto", tier: "Platinum", value: 108 },
    { rank: 8, alias: "BlockPilot", tier: "Diamond", value: 86 },
    { rank: 9, alias: "CryptoVoyager", tier: "Private Client", value: 64 },
    { rank: 10, alias: "EmeraldWave", tier: "Diamond", value: 42 }
  ],
  growth: [
    { rank: 1, alias: "NovaTrader", tier: "Diamond", value: 184 },
    { rank: 2, alias: "BTCNomad", tier: "Gold", value: 152 },
    { rank: 3, alias: "EmeraldWave", tier: "Diamond", value: 137 },
    { rank: 4, alias: "AtlasCrypto", tier: "Platinum", value: 118 },
    { rank: 5, alias: "ChainExplorer", tier: "Gold", value: 96 },
    { rank: 6, alias: "DigitalHorizon", tier: "Platinum", value: 79 },
    { rank: 7, alias: "BlockPilot", tier: "Diamond", value: 63 },
    { rank: 8, alias: "WealthPath", tier: "Gold", value: 47 },
    { rank: 9, alias: "Alex_R", tier: "Diamond", value: 34 },
    { rank: 10, alias: "CryptoVoyager", tier: "Private Client", value: 21 }
  ]
};
