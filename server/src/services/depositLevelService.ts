import { formatDecimal, parseDecimal } from "../domain/money";
import { InvestmentLevelRange, nextLevelAfter, qualifyLevel } from "../domain/investmentLevelRules";
import { InvestmentLevel } from "../models/InvestmentLevel";
import { User } from "../models/User";
import { calculateQualifyingInvestment } from "./investmentLevelService";

export interface DepositLevelStats {
  totalDepositedUsd: number;
  level: number;
  currentLevelRequiredTotal: number;
  nextLevel: number | null;
  nextLevelRequiredTotal: number | null;
  remainingToNext: number | null;
}

function toRange(level: InvestmentLevel): InvestmentLevelRange {
  return {
    id: level.level_config_id,
    levelNumber: level.level_number,
    thresholdCents: parseDecimal(String(level.qualification_threshold), 2),
    active: level.active,
    sortOrder: level.sort_order
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getDepositLevelDetailsFromTotal(
  totalUsd: number,
  levels: InvestmentLevelRange[]
): DepositLevelStats {
  const safeTotal = Number.isFinite(totalUsd) && totalUsd > 0 ? totalUsd : 0;
  const amountCents = parseDecimal(safeTotal.toFixed(2), 2);
  const qualified = qualifyLevel(amountCents, levels);
  const next = nextLevelAfter(qualified ? qualified.levelNumber : null, levels);
  const nextRequiredTotal = next ? toNumber(formatDecimal(next.thresholdCents, 2)) : null;
  const remainingToNext = next
    ? Math.max(0, toNumber(formatDecimal(next.thresholdCents - amountCents, 2)))
    : null;

  return {
    totalDepositedUsd: safeTotal,
    level: qualified ? qualified.levelNumber : 0,
    currentLevelRequiredTotal: qualified ? toNumber(formatDecimal(qualified.thresholdCents, 2)) : 0,
    nextLevel: next ? next.levelNumber : null,
    nextLevelRequiredTotal: nextRequiredTotal,
    remainingToNext
  };
}

export async function calculateDepositLevelForUser(userId: string): Promise<DepositLevelStats> {
  const [qualification, levels] = await Promise.all([
    calculateQualifyingInvestment(userId),
    InvestmentLevel.findAll({ order: [["level_number", "ASC"]] })
  ]);
  const ranges = levels.map(toRange);
  // Surface the known USD value even when a volatile deposit could not be
  // valued, so a single unpriced asset never collapses the whole figure to zero.
  const totalUsd = qualification.amount !== null ? toNumber(qualification.amount) : 0;
  return getDepositLevelDetailsFromTotal(totalUsd, ranges);
}

export async function refreshUserDepositLevel(user: User): Promise<DepositLevelStats> {
  const stats = await calculateDepositLevelForUser(user.user_id);
  user.level = stats.level;
  await user.save();
  return stats;
}
