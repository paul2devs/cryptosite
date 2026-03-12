import { Op, fn, col, literal } from "sequelize";
import { Deposit } from "../models/Deposit";
import { Withdrawal } from "../models/Withdrawal";
import { User } from "../models/User";
import { getDynamicBonusFactor } from "./bonusOptimizationService";
import { ChurnPrediction } from "../models/ChurnPrediction";
import { Referral } from "../models/Referral";

export async function getAdminOverview(days: number): Promise<{
  dynamicBonusFactor: number;
  deposits: Array<{ date: string; volume: number; count: number }>;
  withdrawals: Array<{ date: string; volume: number; count: number }>;
  newUsers: Array<{ date: string; count: number }>;
  activeUsers: Array<{ date: string; count: number }>;
  churnBuckets: { low: number; medium: number; high: number };
  referralTop: Array<{ referrer_id: string; invited: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const dateExpr = (c: string) => fn("DATE", col(c));

  const deposits = (await Deposit.findAll({
    where: { timestamp: { [Op.gte]: since }, status: "Approved" },
    attributes: [
      [dateExpr("timestamp"), "date"],
      [fn("SUM", col("amount")), "volume"],
      [fn("COUNT", col("deposit_id")), "count"]
    ],
    group: [literal("date") as any],
    order: [[literal("date") as any, "ASC"]]
  })) as any[];

  const withdrawals = (await Withdrawal.findAll({
    where: { timestamp: { [Op.gte]: since } },
    attributes: [
      [dateExpr("timestamp"), "date"],
      [fn("SUM", col("amount")), "volume"],
      [fn("COUNT", col("withdrawal_id")), "count"]
    ],
    group: [literal("date") as any],
    order: [[literal("date") as any, "ASC"]]
  })) as any[];

  const newUsers = (await User.findAll({
    where: { created_at: { [Op.gte]: since } },
    attributes: [[dateExpr("created_at"), "date"], [fn("COUNT", col("user_id")), "count"]],
    group: [literal("date") as any],
    order: [[literal("date") as any, "ASC"]]
  })) as any[];

  const activeUsers = (await User.findAll({
    where: { last_activity_at: { [Op.gte]: since } },
    attributes: [[dateExpr("last_activity_at"), "date"], [fn("COUNT", col("user_id")), "count"]],
    group: [literal("date") as any],
    order: [[literal("date") as any, "ASC"]]
  })) as any[];

  const churnRows = await ChurnPrediction.findAll();
  const churnBuckets = churnRows.reduce(
    (acc, r) => {
      acc[r.risk_level] += 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 } as { low: number; medium: number; high: number }
  );

  const referralTop = (await Referral.findAll({
    attributes: [
      ["referrer_id", "referrer_id"],
      [fn("COUNT", col("id")), "invited"]
    ],
    group: ["referrer_id"],
    order: [[literal("invited") as any, "DESC"]],
    limit: 20
  })) as any[];

  return {
    dynamicBonusFactor: await getDynamicBonusFactor(),
    deposits: deposits.map((r) => ({
      date: new Date(r.get("date")).toISOString().slice(0, 10),
      volume: Number(r.get("volume") || 0),
      count: Number(r.get("count") || 0)
    })),
    withdrawals: withdrawals.map((r) => ({
      date: new Date(r.get("date")).toISOString().slice(0, 10),
      volume: Number(r.get("volume") || 0),
      count: Number(r.get("count") || 0)
    })),
    newUsers: newUsers.map((r) => ({
      date: new Date(r.get("date")).toISOString().slice(0, 10),
      count: Number(r.get("count") || 0)
    })),
    activeUsers: activeUsers.map((r) => ({
      date: new Date(r.get("date")).toISOString().slice(0, 10),
      count: Number(r.get("count") || 0)
    })),
    churnBuckets,
    referralTop: referralTop.map((r) => ({
      referrer_id: String(r.get("referrer_id")),
      invited: Number(r.get("invited") || 0)
    }))
  };
}

