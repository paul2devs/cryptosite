import { formatDecimal, parseDecimal } from "./money";

export interface DailyPerformanceInput {
  openingCents: bigint;
  closingCents: bigint | null;
  cashFlowCents: bigint;
  verified: boolean;
}

export interface DailyPerformanceResult {
  status: "verified" | "unavailable";
  profitCents: bigint | null;
  roiPercent: string | null;
  adjustedOpeningCents: bigint;
}

export function calculateDailyPerformance(input: DailyPerformanceInput): DailyPerformanceResult {
  const adjustedOpening = input.openingCents + input.cashFlowCents;
  if (!input.verified || input.closingCents === null) {
    return {
      status: "unavailable",
      profitCents: null,
      roiPercent: null,
      adjustedOpeningCents: adjustedOpening
    };
  }
  const profit = input.closingCents - adjustedOpening;
  if (adjustedOpening === 0n) {
    return {
      status: "unavailable",
      profitCents: profit,
      roiPercent: null,
      adjustedOpeningCents: adjustedOpening
    };
  }
  const scaled = (profit * 100000000n) / adjustedOpening;
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const whole = absolute / 1000000n;
  const fraction = (absolute % 1000000n).toString().padStart(6, "0");
  return {
    status: "verified",
    profitCents: profit,
    roiPercent: `${negative ? "-" : ""}${whole.toString()}.${fraction}`,
    adjustedOpeningCents: adjustedOpening
  };
}

export interface LedgerLine {
  account: string;
  direction: "debit" | "credit";
  amountCents: bigint;
}

export function ledgerBalances(lines: LedgerLine[]): Record<string, bigint> {
  const balances: Record<string, bigint> = {};
  for (const line of lines) {
    const current = balances[line.account] ?? 0n;
    balances[line.account] = line.direction === "credit" ? current + line.amountCents : current - line.amountCents;
  }
  return balances;
}

export function canDistribute(unrealizedCents: bigint, realizedCents: bigint): boolean {
  return unrealizedCents > 0n ? false : realizedCents > 0n;
}

function formatPercentScaled(percentScaled: bigint): string {
  const negative = percentScaled < 0n;
  const absolute = negative ? -percentScaled : percentScaled;
  const whole = absolute / 1000000n;
  const fraction = (absolute % 1000000n).toString().padStart(6, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

export function computeDailyRoi(profitCents: bigint, adjustedOpeningCents: bigint): string | null {
  if (adjustedOpeningCents === 0n) return null;
  const scaled = (profitCents * 100000000n) / adjustedOpeningCents;
  return formatPercentScaled(scaled);
}

export function netProfitCents(openingCents: bigint, closingCents: bigint, externalFlowCents: bigint): bigint {
  return closingCents - (openingCents + externalFlowCents);
}

export function chainDailyReturns(rois: Array<string | null | undefined>): string | null {
  const present = rois.filter((roi): roi is string => typeof roi === "string" && roi.length > 0);
  if (present.length === 0) return null;
  let factor = 1000000n;
  for (const roi of present) {
    const roiScaled = parseDecimal(roi, 6);
    const growth = 1000000n + roiScaled / 100n;
    factor = (factor * growth) / 1000000n;
  }
  const percentScaled = (factor - 1000000n) * 100n;
  return formatPercentScaled(percentScaled);
}

export function capitalWeightedReturn(totalProfitCents: bigint, averageCapitalCents: bigint): string | null {
  return computeDailyRoi(totalProfitCents, averageCapitalCents);
}

export interface DailyPerformanceEntry {
  date: string;
  openingCents: bigint;
  closingCents: bigint | null;
  externalContributionCents: bigint;
  externalWithdrawalCents: bigint;
  feeCents: bigint;
  realizedCents: bigint;
  unrealizedCents: bigint | null;
  netProfitCents: bigint | null;
  roiPercent: string | null;
  verified: boolean;
  methodology: string;
  source: string | null;
}

export interface DailyPerformanceHistoryRow {
  date: string;
  openingValue: string;
  closingValue: string | null;
  externalContributions: string;
  externalWithdrawals: string;
  realizedProfitLoss: string;
  unrealizedProfitLoss: string | null;
  feesAndAdjustments: string;
  netProfitLoss: string | null;
  roiPercent: string | null;
  status: "verified" | "unavailable";
  methodology: string;
  source: string | null;
}

export function buildDailyPerformanceHistory(entries: DailyPerformanceEntry[]): DailyPerformanceHistoryRow[] {
  const byDate = new Map<string, DailyPerformanceHistoryRow>();
  const ordered = [...entries].sort((left, right) => left.date.localeCompare(right.date));
  for (const entry of ordered) {
    const existing = byDate.get(entry.date);
    if (!existing) {
      byDate.set(entry.date, {
        date: entry.date,
        openingValue: formatDecimal(entry.openingCents, 8),
        closingValue: entry.closingCents === null ? null : formatDecimal(entry.closingCents, 8),
        externalContributions: formatDecimal(entry.externalContributionCents, 8),
        externalWithdrawals: formatDecimal(entry.externalWithdrawalCents, 8),
        realizedProfitLoss: formatDecimal(entry.realizedCents, 8),
        unrealizedProfitLoss: entry.unrealizedCents === null ? null : formatDecimal(entry.unrealizedCents, 8),
        feesAndAdjustments: formatDecimal(entry.feeCents, 8),
        netProfitLoss: entry.netProfitCents === null ? null : formatDecimal(entry.netProfitCents, 8),
        roiPercent: entry.roiPercent,
        status: entry.verified ? "verified" : "unavailable",
        methodology: entry.methodology,
        source: entry.source
      });
      continue;
    }
    const opening = parseDecimal(existing.openingValue, 8) + entry.openingCents;
    const closing =
      existing.closingValue === null || entry.closingCents === null
        ? null
        : parseDecimal(existing.closingValue, 8) + entry.closingCents;
    const contributions = parseDecimal(existing.externalContributions, 8) + entry.externalContributionCents;
    const withdrawals = parseDecimal(existing.externalWithdrawals, 8) + entry.externalWithdrawalCents;
    const realized = parseDecimal(existing.realizedProfitLoss, 8) + entry.realizedCents;
    const unrealized =
      existing.unrealizedProfitLoss === null || entry.unrealizedCents === null
        ? null
        : parseDecimal(existing.unrealizedProfitLoss, 8) + entry.unrealizedCents;
    const fees = parseDecimal(existing.feesAndAdjustments, 8) + entry.feeCents;
    const profit =
      existing.netProfitLoss === null || entry.netProfitCents === null
        ? null
        : parseDecimal(existing.netProfitLoss, 8) + entry.netProfitCents;
    existing.openingValue = formatDecimal(opening, 8);
    existing.closingValue = closing === null ? null : formatDecimal(closing, 8);
    existing.externalContributions = formatDecimal(contributions, 8);
    existing.externalWithdrawals = formatDecimal(withdrawals, 8);
    existing.realizedProfitLoss = formatDecimal(realized, 8);
    existing.unrealizedProfitLoss = unrealized === null ? null : formatDecimal(unrealized, 8);
    existing.feesAndAdjustments = formatDecimal(fees, 8);
    existing.netProfitLoss = profit === null ? null : formatDecimal(profit, 8);
    existing.status = existing.status === "verified" && entry.verified ? "verified" : "unavailable";
    if (existing.status === "verified" && profit !== null) {
      existing.roiPercent = computeDailyRoi(profit, opening + (contributions - withdrawals));
    } else {
      existing.roiPercent = null;
    }
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function sumVerifiedPerformance(
  profits: Array<bigint | null>,
  principalCents: bigint
): { status: "verified" | "unavailable"; profitCents: bigint | null; roiPercent: string | null } {
  const present = profits.filter((profit): profit is bigint => profit !== null);
  if (present.length === 0) {
    return { status: "unavailable", profitCents: null, roiPercent: null };
  }
  const profit = present.reduce((total, value) => total + value, 0n);
  if (principalCents <= 0n) {
    return { status: "verified", profitCents: profit, roiPercent: null };
  }
  const scaled = (profit * 100000000n) / principalCents;
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const whole = absolute / 1000000n;
  const fraction = (absolute % 1000000n).toString().padStart(6, "0");
  return {
    status: "verified",
    profitCents: profit,
    roiPercent: `${negative ? "-" : ""}${whole.toString()}.${fraction}`
  };
}
