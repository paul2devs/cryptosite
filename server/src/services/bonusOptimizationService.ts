import { Op } from "sequelize";
import { Deposit } from "../models/Deposit";
import { Withdrawal } from "../models/Withdrawal";
import { setCachedJson, getCachedJson } from "../config/cache";
import { BonusOptimizationLog } from "../models/BonusOptimizationLog";

const DYNAMIC_BONUS_KEY = "bonuses:dynamic_factor";

export async function getDynamicBonusFactor(): Promise<number> {
  const cached = await getCachedJson<{ factor: number }>(DYNAMIC_BONUS_KEY);
  if (cached && Number.isFinite(cached.factor) && cached.factor > 0) {
    return cached.factor;
  }
  return 1;
}

async function setDynamicBonusFactor(factor: number): Promise<void> {
  await setCachedJson(DYNAMIC_BONUS_KEY, { factor }, 6 * 60 * 60);
}

function clamp(x: number, min: number, max: number): number {
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

export async function runBonusOptimization(): Promise<void> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const deposits24 = await Deposit.sum("amount", {
    where: { status: "Approved", timestamp: { [Op.gte]: dayAgo } }
  });
  const deposits7d = await Deposit.sum("amount", {
    where: { status: "Approved", timestamp: { [Op.gte]: weekAgo } }
  });

  const withdrawals24 = await Withdrawal.sum("amount", {
    where: { timestamp: { [Op.gte]: dayAgo } }
  });

  const dep24 = Number(deposits24 || 0);
  const dep7 = Number(deposits7d || 0);
  const avgDaily = dep7 > 0 ? dep7 / 7 : dep24;
  const dropRatio = avgDaily > 0 ? clamp((avgDaily - dep24) / avgDaily, 0, 1) : 0;
  const withdrawalPressure = avgDaily > 0 ? clamp(Number(withdrawals24 || 0) / avgDaily, 0, 3) : 0;

  const current = await getDynamicBonusFactor();
  let next = current;
  let reason = "stable";

  if (dropRatio >= 0.25) {
    next = clamp(current + 0.05 + dropRatio * 0.1, 1, 1.25);
    reason = "deposits_down";
  }

  if (withdrawalPressure >= 0.9) {
    next = clamp(next - 0.08 * clamp(withdrawalPressure - 0.9, 0, 1.5), 0.85, 1.25);
    reason = reason === "stable" ? "withdrawals_up" : `${reason}+withdrawals_up`;
  }

  next = Math.round(next * 100) / 100;

  if (next !== current) {
    await setDynamicBonusFactor(next);
    await BonusOptimizationLog.create({
      adjustment_type: "dynamic_bonus_factor",
      reason,
      impact: `factor ${current} -> ${next}`
    });
  }
}

