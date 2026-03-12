import { fn, col, literal, Op } from "sequelize";
import { Deposit } from "../models/Deposit";
import { User } from "../models/User";
import { getCachedJson, setCachedJson } from "../config/cache";

interface LeaderboardEntry {
  userId: string;
  alias: string;
  value: number;
}

const LEADERBOARD_CACHE_TTL_SECONDS = 30;

async function cacheOrLoad(
  key: string,
  loader: () => Promise<LeaderboardEntry[]>
): Promise<LeaderboardEntry[]> {
  const cached = await getCachedJson<LeaderboardEntry[]>(key);
  if (cached) {
    return cached;
  }
  const data = await loader();
  await setCachedJson(key, data, LEADERBOARD_CACHE_TTL_SECONDS);
  return data;
}

function makeAlias(user: User): string {
  const base = user.name || user.email;
  const prefix = base.slice(0, 3).toUpperCase();
  const suffix = user.user_id.slice(0, 2).toUpperCase();
  return `${prefix}${suffix}`;
}

export async function getTopDepositors(): Promise<LeaderboardEntry[]> {
  return cacheOrLoad("leaderboard:depositors", async () => {
    const rows = await Deposit.findAll({
      attributes: [
        "user_id",
        [fn("SUM", col("amount")), "totalDeposited"]
      ],
      where: { status: "Approved" },
      group: ["Deposit.user_id", "User.user_id"],
      order: [[literal("totalDeposited"), "DESC"]],
      limit: 20,
      include: [
        {
          model: User,
          attributes: ["user_id", "name", "email"]
        }
      ]
    });

    return rows.map((row: any) => {
      const user = row.User as User;
      return {
        userId: row.user_id,
        alias: makeAlias(user),
        value: Number(row.get("totalDeposited"))
      };
    });
  });
}

export async function getWeeklyTopEarnings(): Promise<LeaderboardEntry[]> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return cacheOrLoad("leaderboard:earnings", async () => {
    const rows = await Deposit.findAll({
      attributes: [
        "user_id",
        [fn("SUM", col("pending_earning")), "totalEarnings"]
      ],
      where: {
        status: "Approved",
        timestamp: { [Op.gte]: weekAgo }
      },
      group: ["Deposit.user_id", "User.user_id"],
      order: [[literal("totalEarnings"), "DESC"]],
      limit: 20,
      include: [
        {
          model: User,
          attributes: ["user_id", "name", "email"]
        }
      ]
    });

    return rows.map((row: any) => {
      const user = row.User as User;
      return {
        userId: row.user_id,
        alias: makeAlias(user),
        value: Number(row.get("totalEarnings"))
      };
    });
  });
}

export async function getHighestStreaks(): Promise<LeaderboardEntry[]> {
  return cacheOrLoad("leaderboard:streaks", async () => {
    const users = await User.findAll({
      where: { streak: { [Op.gt]: 0 } },
      order: [["streak", "DESC"]],
      limit: 20
    });

    return users.map((u) => ({
      userId: u.user_id,
      alias: makeAlias(u),
      value: u.streak
    }));
  });
}

export async function getFastestGrowing(): Promise<LeaderboardEntry[]> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return cacheOrLoad("leaderboard:growth", async () => {
    const rows = await Deposit.findAll({
      attributes: [
        "user_id",
        [fn("SUM", col("pending_earning")), "growthScore"]
      ],
      where: {
        status: "Approved",
        timestamp: { [Op.gte]: weekAgo }
      },
      group: ["Deposit.user_id", "User.user_id"],
      order: [[literal("growthScore"), "DESC"]],
      limit: 20,
      include: [
        {
          model: User,
          attributes: ["user_id", "name", "email"]
        }
      ]
    });

    return rows.map((row: any) => {
      const user = row.User as User;
      return {
        userId: row.user_id,
        alias: makeAlias(user),
        value: Number(row.get("growthScore"))
      };
    });
  });
}

