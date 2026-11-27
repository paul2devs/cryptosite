import { Op } from "sequelize";
import {
  buildDailyPerformanceHistory,
  capitalWeightedReturn,
  chainDailyReturns,
  type DailyPerformanceEntry,
  type DailyPerformanceHistoryRow
} from "../domain/performanceRules";
import {
  applyUsdRatio,
  isStablecoinDeposit,
  usdPerAssetUnitUnits
} from "../domain/depositValuation";
import { formatDecimal, parseDecimal } from "../domain/money";
import { portfolioValuation, type PortfolioValuation } from "../domain/portfolioRules";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { DailyPerformanceSnapshot } from "../models/DailyPerformanceSnapshot";
import { Deposit } from "../models/Deposit";
import { InvestmentPosition } from "../models/InvestmentPosition";
import { LedgerAccount, type LedgerAccountCode } from "../models/LedgerAccount";
import { LedgerEntry } from "../models/LedgerEntry";
import { PerformanceCalculationLog } from "../models/PerformanceCalculationLog";
import { User } from "../models/User";

export const PERFORMANCE_METHODOLOGY = {
  investment: "time_weighted_return",
  account: "money_weighted_return",
  version: "twr-mwr.1",

};

type LedgerFlowKind = "contribution" | "withdrawal" | "fee" | "realized" | "adjustment";

const FLOW_ACCOUNT: Record<string, { code: LedgerAccountCode; kind: LedgerFlowKind }> = {
  deposit_confirmed: { code: "invested_principal", kind: "contribution" },
  withdrawal_completed: { code: "withdrawals", kind: "withdrawal" },
  fee_charged: { code: "fees", kind: "fee" },
  profit_distribution: { code: "realized_earnings", kind: "realized" },
  account_adjustment: { code: "adjustments", kind: "adjustment" },
  adjustment_reversal: { code: "adjustments", kind: "adjustment" }
};

interface FlowBucket {
  contribution: bigint;
  withdrawal: bigint;
  fee: bigint;
  realized: bigint;
  adjustment: bigint;
}

function emptyBucket(): FlowBucket {
  return { contribution: 0n, withdrawal: 0n, fee: 0n, realized: 0n, adjustment: 0n };
}

function dateKeyOf(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

const USD_UNIT = 10n ** 8n;

/**
 * Resolve the stored USD-per-asset-unit ratio for a ledger asset. USD and
 * dollar-pegged stablecoins are exactly 1:1; anything else must have a ratio
 * derived from the user's own deposits, otherwise it cannot be valued in USD
 * and the caller treats the amount as unpriced.
 */
function resolveAssetRatio(asset: string, byAsset: Map<string, bigint>): bigint | null {
  const key = String(asset ?? "").toUpperCase();
  if (key === "USD" || isStablecoinDeposit(key)) return USD_UNIT;
  return byAsset.get(key) ?? null;
}

function bucketFlows(
  accounts: LedgerAccount[],
  entries: LedgerEntry[],
  ratioForAsset: (asset: string) => bigint | null
): Map<string, FlowBucket> {
  const byAccountId = new Map(accounts.map((account) => [account.account_id, account]));
  const buckets = new Map<string, FlowBucket>();
  for (const entry of entries) {
    const account = byAccountId.get(entry.account_id);
    if (!account) continue;
    const rule = FLOW_ACCOUNT[entry.transaction_type];
    if (!rule || rule.code !== account.code) continue;
    // Ledger entries are denominated in their own asset; convert to USD with the
    // stored ratio so cash flows can be compared with the USD position values.
    const ratio = ratioForAsset(entry.asset);
    if (ratio === null) continue;
    const key = dateKeyOf(entry.created_at);
    const bucket = buckets.get(key) ?? emptyBucket();
    bucket[rule.kind] += applyUsdRatio(parseDecimal(String(entry.amount), 8), ratio);
    buckets.set(key, bucket);
  }
  return buckets;
}

async function ledgerFlowSources(userId: string) {
  const [accounts, entries] = await Promise.all([
    LedgerAccount.findAll({ where: { user_id: userId } }),
    LedgerEntry.findAll({ where: { user_id: userId }, order: [["created_at", "ASC"]] })
  ]);
  return { accounts, entries };
}

interface UsdRatios {
  byPosition: Map<string, bigint>;
  byAsset: Map<string, bigint>;
}

/**
 * Build the stored USD ratios for a user's positions from the USD value recorded
 * on each position's originating deposit. Positions that are already denominated
 * in USD (or a stablecoin) are 1:1. A position with no recorded USD value is left
 * out of the map so it is reported as unvalued instead of being mislabelled USD.
 */
async function usdRatiosForUser(positions: InvestmentPosition[]): Promise<UsdRatios> {
  const depositIds = [
    ...new Set(
      positions
        .map((position) => position.deposit_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  ];
  const deposits = depositIds.length
    ? await Deposit.findAll({ where: { deposit_id: { [Op.in]: depositIds } } })
    : [];
  const byId = new Map(deposits.map((deposit) => [String(deposit.deposit_id), deposit]));

  const byPosition = new Map<string, bigint>();
  const byAsset = new Map<string, bigint>();
  for (const position of positions) {
    const asset = String(position.asset);
    const key = asset.toUpperCase();
    let ratio: bigint | null = null;
    if (key === "USD" || isStablecoinDeposit(key)) {
      ratio = USD_UNIT;
    } else {
      const deposit = position.deposit_id ? byId.get(String(position.deposit_id)) : undefined;
      if (deposit) {
        const quantity = deposit.received_amount ?? deposit.amount;
        const usd = deposit.usd_amount;
        if (usd !== null && usd !== undefined) {
          ratio = usdPerAssetUnitUnits(quantity, usd);
        }
      }
    }
    if (ratio === null) continue;
    byPosition.set(position.position_id, ratio);
    if (!byAsset.has(key)) byAsset.set(key, ratio);
  }
  return { byPosition, byAsset };
}

function scaleAmountToUsd(value: string | number | null, ratio: bigint): string | null {
  if (value === null) return null;
  return formatDecimal(applyUsdRatio(parseDecimal(String(value), 8), ratio), 8);
}

interface ValuationSnapshot {
  snapshot_id: string;
  position_id: string;
  snapshot_date: string;
  opening_valuation: string;
  closing_valuation: string | null;
  profit_loss: string | null;
  roi_percent: string | null;
  verification_status: string;
  data_source: string;
  correction_of: string | null;
  created_at: Date;
}

/**
 * Re-express a position's stored asset-unit snapshot in USD using the position's
 * stored ratio. A null ratio means the position cannot be valued in USD, so the
 * snapshot is dropped rather than shown as a tiny unrelated number.
 */
function scaleSnapshotToUsd(
  snapshot: ValuationSnapshot,
  ratios: UsdRatios
): ValuationSnapshot | null {
  const ratio = ratios.byPosition.get(snapshot.position_id);
  if (ratio === undefined) return null;
  return {
    ...snapshot,
    opening_valuation: scaleAmountToUsd(snapshot.opening_valuation, ratio) ?? "0.00000000",
    closing_valuation: scaleAmountToUsd(snapshot.closing_valuation, ratio),
    profit_loss: scaleAmountToUsd(snapshot.profit_loss, ratio)
  };
}

function toValuationSnapshot(row: DailyPerformanceSnapshot): ValuationSnapshot {
  return {
    snapshot_id: row.snapshot_id,
    position_id: row.position_id,
    snapshot_date: String(row.snapshot_date),
    opening_valuation: String(row.opening_valuation),
    closing_valuation: row.closing_valuation === null ? null : String(row.closing_valuation),
    profit_loss: row.profit_loss === null ? null : String(row.profit_loss),
    roi_percent: row.roi_percent === null ? null : String(row.roi_percent),
    verification_status: row.verification_status,
    data_source: row.data_source,
    correction_of: row.correction_of,
    created_at: row.created_at
  };
}

function latestVerifiedSnapshots(rows: DailyPerformanceSnapshot[]): DailyPerformanceSnapshot[] {
  const chosen = new Map<string, DailyPerformanceSnapshot>();
  for (const row of rows) {
    const key = `${row.position_id}:${row.snapshot_date}`;
    const current = chosen.get(key);
    if (!current) {
      chosen.set(key, row);
      continue;
    }
    const rowIsCorrection = row.correction_of !== null;
    const currentIsCorrection = current.correction_of !== null;
    if (rowIsCorrection && !currentIsCorrection) {
      chosen.set(key, row);
    } else if (rowIsCorrection === currentIsCorrection && current.created_at < row.created_at) {
      chosen.set(key, row);
    }
  }
  return [...chosen.values()];
}

function buildEntries(
  snapshots: ValuationSnapshot[],
  flows: Map<string, FlowBucket>
): { entries: DailyPerformanceEntry[]; history: DailyPerformanceHistoryRow[] } {
  const entries: DailyPerformanceEntry[] = [];
  for (const snapshot of snapshots) {
    const date = String(snapshot.snapshot_date).slice(0, 10);
    const verified = snapshot.verification_status === "verified";
    const opening = parseDecimal(String(snapshot.opening_valuation), 8);
    const closing = snapshot.closing_valuation === null ? null : parseDecimal(String(snapshot.closing_valuation), 8);
    const bucket = flows.get(date) ?? emptyBucket();
    const profitLoss = snapshot.profit_loss === null ? null : parseDecimal(String(snapshot.profit_loss), 8);
    const realized = bucket.realized;
    const unrealized = profitLoss === null ? null : profitLoss - realized;
    entries.push({
      date,
      openingCents: opening,
      closingCents: closing,
      externalContributionCents: bucket.contribution,
      externalWithdrawalCents: bucket.withdrawal,
      feeCents: bucket.fee + bucket.adjustment,
      realizedCents: realized,
      unrealizedCents: unrealized,
      netProfitCents: profitLoss,
      roiPercent: snapshot.roi_percent === null ? null : String(snapshot.roi_percent),
      verified,
      methodology: PERFORMANCE_METHODOLOGY.investment,
      source: snapshot.data_source
    });
  }
  return { entries, history: buildDailyPerformanceHistory(entries) };
}

export interface PerformanceOverview {
  range: string;
  methodology: typeof PERFORMANCE_METHODOLOGY;
  overview: {
    currentInvestmentValue: string;
    investedPrincipal: string;
    valuationComplete: boolean;
    todayProfitLoss: string | null;
    todayRoiPercent: string | null;
    todayStatus: "verified" | "unavailable";
    totalRealizedProfitLoss: string;
    totalUnrealizedProfitLoss: string | null;
    overallReturnPercent: string | null;
    periodReturnPercent: string | null;
    periodProfitLoss: string | null;
    periodStatus: "verified" | "unavailable";
  };
  chart: {
    rangeStart: string | null;
    rangeEnd: string | null;
    openingValue: string | null;
    closingValue: string | null;
    externalContributions: string;
    externalWithdrawals: string;
    points: Array<{
      date: string;
      portfolioValue: string | null;
      profitLoss: string | null;
      cumulativeProfitLoss: string | null;
      roiPercent: string | null;
      externalFlow: string;
      status: "verified" | "unavailable";
    }>;
  };
  history: DailyPerformanceHistoryRow[];
  snapshots: Array<{
    snapshot_id: string;
    snapshot_date: string;
    profit_loss: string | null;
    roi_percent: string | null;
    verification_status: string;
    data_source: string;
  }>;
  today: {
    roiPercent: string | null;
    profitLoss: string | null;
    status: "verified" | "unavailable";
    source: string | null;
    realized: false;
  };
  cumulative: {
    roiPercent: string | null;
    profitLoss: string | null;
    status: "verified" | "unavailable";
    realized: false;
  };
  realizedEarnings: string;
  note: string;
}

function rangeStart(range: string, end: Date): Date | null {
  const days: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  const span = days[range];
  if (!span) return null;
  const start = new Date(end.getTime());
  if (range === "24h") start.setUTCHours(start.getUTCHours() - 24);
  else start.setUTCDate(start.getUTCDate() - span);
  return start;
}

export async function getPerformanceOverview(userId: string, range: string): Promise<PerformanceOverview> {
  const [positions, snapshotRows, sources] = await Promise.all([
    InvestmentPosition.findAll({ where: { user_id: userId } }),
    DailyPerformanceSnapshot.findAll({
      where: { user_id: userId, verification_status: "verified" },
      order: [["snapshot_date", "ASC"], ["created_at", "ASC"]]
    }),
    ledgerFlowSources(userId)
  ]);

  // Positions, snapshots and ledger entries are all denominated in the asset
  // that was deposited (e.g. BTC), so they must be re-expressed in USD before
  // being summed into a dollar total. The USD-per-asset ratio comes from each
  // deposit's own recorded USD value, never a live market price.
  const ratios = await usdRatiosForUser(positions);
  const flows = bucketFlows(sources.accounts, sources.entries, (asset) =>
    resolveAssetRatio(asset, ratios.byAsset)
  );

  const latest = latestVerifiedSnapshots(snapshotRows);
  const scaled = latest
    .map((snapshot) => scaleSnapshotToUsd(toValuationSnapshot(snapshot), ratios))
    .filter((snapshot): snapshot is ValuationSnapshot => snapshot !== null);
  const { history } = buildEntries(scaled, flows);

  const activePositions = positions.filter((position) => position.status === "active");
  let investedPrincipal = 0n;
  let currentValue = 0n;
  let valuationComplete = true;
  for (const position of activePositions) {
    const ratio = ratios.byPosition.get(position.position_id) ?? null;
    if (ratio === null) {
      // No recorded USD value for this position's originating deposit, so its
      // asset-unit principal cannot be honestly presented as dollars. Flag the
      // valuation as incomplete instead of mixing units into the USD total.
      valuationComplete = false;
      continue;
    }
    const principal = applyUsdRatio(parseDecimal(String(position.principal), 8), ratio);
    investedPrincipal += principal;
    if (position.current_valuation !== null && position.verification_status === "verified") {
      currentValue += applyUsdRatio(parseDecimal(String(position.current_valuation), 8), ratio);
    } else {
      currentValue += principal;
      valuationComplete = false;
    }
  }

  const now = new Date();
  const start = rangeStart(range, now);
  const scoped = start
    ? history.filter((row) => {
        const date = new Date(`${row.date}T00:00:00.000Z`);
        return date.getTime() >= start.getTime();
      })
    : history;

  const periodRois = scoped.map((row) => row.roiPercent);
  const periodReturn = chainDailyReturns(periodRois);
  const periodProfit = scoped.reduce(
    (total, row) => (row.netProfitLoss === null ? total : total + parseDecimal(row.netProfitLoss, 8)),
    0n
  );
  const anyVerifiedPeriod = scoped.some((row) => row.status === "verified" && row.netProfitLoss !== null);

  // Capital-weighted (money-weighted) overall return across the full verified history.
  let totalProfit = 0n;
  let capitalSum = 0n;
  let capitalDays = 0n;
  for (const row of history) {
    if (row.status !== "verified" || row.netProfitLoss === null) continue;
    totalProfit += parseDecimal(row.netProfitLoss, 8);
    capitalSum +=
      parseDecimal(row.openingValue, 8) +
      parseDecimal(row.externalContributions, 8) -
      parseDecimal(row.externalWithdrawals, 8);
    capitalDays += 1n;
  }
  const averageCapital = capitalDays > 0n ? capitalSum / capitalDays : 0n;
  const overallReturn = averageCapital > 0n ? capitalWeightedReturn(totalProfit, averageCapital) : null;

  let realizedTotal = 0n;
  for (const bucket of flows.values()) {
    realizedTotal += bucket.realized;
  }

  const todayKey = now.toISOString().slice(0, 10);
  const todayRow = history.find((row) => row.date === todayKey) ?? null;

  const chartPoints = scoped.map((row) => {
    const externalFlow =
      parseDecimal(row.externalContributions, 8) - parseDecimal(row.externalWithdrawals, 8);
    return {
      date: row.date,
      portfolioValue: row.closingValue,
      profitLoss: row.netProfitLoss,
      cumulativeProfitLoss: null as string | null,
      roiPercent: row.roiPercent,
      externalFlow: formatDecimal(externalFlow, 8),
      status: row.status
    };
  });
  let running = 0n;
  let runningVerified = false;
  for (const point of chartPoints) {
    if (point.profitLoss !== null) {
      running += parseDecimal(point.profitLoss, 8);
      runningVerified = true;
    }
    point.cumulativeProfitLoss = runningVerified ? formatDecimal(running, 8) : null;
  }

  const firstRow = scoped[0] ?? null;
  const lastRow = scoped[scoped.length - 1] ?? null;
  const totalContributions = scoped.reduce(
    (total, row) => total + parseDecimal(row.externalContributions, 8),
    0n
  );
  const totalWithdrawals = scoped.reduce(
    (total, row) => total + parseDecimal(row.externalWithdrawals, 8),
    0n
  );

  const unrealizedTotal = history.reduce<{ value: bigint | null }>((acc, row) => {
    if (row.unrealizedProfitLoss === null) return acc;
    const next = (acc.value ?? 0n) + parseDecimal(row.unrealizedProfitLoss, 8);
    return { value: next };
  }, { value: null }).value;

  return {
    range,
    methodology: PERFORMANCE_METHODOLOGY,
    overview: {
      currentInvestmentValue: formatDecimal(currentValue, 8),
      investedPrincipal: formatDecimal(investedPrincipal, 8),
      valuationComplete,
      todayProfitLoss: todayRow?.netProfitLoss ?? null,
      todayRoiPercent: todayRow?.roiPercent ?? null,
      todayStatus: todayRow?.status ?? "unavailable",
      totalRealizedProfitLoss: formatDecimal(realizedTotal, 8),
      totalUnrealizedProfitLoss: unrealizedTotal === null ? null : formatDecimal(unrealizedTotal, 8),
      overallReturnPercent: overallReturn,
      periodReturnPercent: periodReturn,
      periodProfitLoss: periodProfit === 0n && !anyVerifiedPeriod ? null : formatDecimal(periodProfit, 8),
      periodStatus: anyVerifiedPeriod ? "verified" : "unavailable"
    },
    chart: {
      rangeStart: start ? start.toISOString() : null,
      rangeEnd: now.toISOString(),
      openingValue: firstRow?.openingValue ?? null,
      closingValue: lastRow?.closingValue ?? null,
      externalContributions: formatDecimal(totalContributions, 8),
      externalWithdrawals: formatDecimal(totalWithdrawals, 8),
      points: chartPoints
    },
    history,
    snapshots: scaled.map((snapshot) => ({
      snapshot_id: snapshot.snapshot_id,
      snapshot_date: String(snapshot.snapshot_date),
      profit_loss: snapshot.profit_loss,
      roi_percent: snapshot.roi_percent === null ? null : String(snapshot.roi_percent),
      verification_status: snapshot.verification_status,
      data_source: snapshot.data_source
    })),
    today: {
      roiPercent: todayRow?.roiPercent ?? null,
      profitLoss: todayRow?.netProfitLoss ?? null,
      status: todayRow?.status ?? "unavailable",
      source: todayRow?.source ?? null,
      realized: false
    },
    cumulative: {
      roiPercent: overallReturn,
      profitLoss: history.some((row) => row.netProfitLoss !== null) ? formatDecimal(totalProfit, 8) : null,
      status: history.some((row) => row.status === "verified") ? "verified" : "unavailable",
      realized: false
    },
    realizedEarnings: formatDecimal(realizedTotal, 8),
    note:
      "."
  };
}

/**
 * The single authoritative portfolio valuation used by every surface.
 *
 * Total portfolio value is derived only from verified investment positions: the
 * principal allocated to active positions plus the earnings those positions have
 * actually accrued. It is deliberately decoupled from live market prices, so a
 * fixed-principal investment is never re-valued by BTC/ETH price swings.
 *
 * The rule itself lives in the pure domain layer (`domain/portfolioRules`) and is
 * re-exported here so every service shares one implementation.
 */
export { portfolioValuation };
export type { PortfolioValuation };

export async function getPortfolioValuation(
  userId: string,
  range = "all"
): Promise<PortfolioValuation> {
  const overview = await getPerformanceOverview(userId, range);
  return portfolioValuation(overview.overview);
}

export interface DailyPerformanceDetail {
  date: string;
  summary: DailyPerformanceHistoryRow | null;
  positions: Array<{
    positionId: string;
    asset: string;
    strategy: string;
    openingValuation: string;
    closingValuation: string | null;
    cashFlow: string;
    profitLoss: string | null;
    roiPercent: string | null;
    verificationStatus: string;
    dataSource: string;
    reason: string | null;
    correctionOf: string | null;
  }>;
  events: Array<{ entryId: string; direction: string; amount: string; asset: string; transactionType: string; createdAt: string }>;
}

export async function getDailyPerformanceDetail(userId: string, date: string): Promise<DailyPerformanceDetail> {
  const overview = await getPerformanceOverview(userId, "all");
  const summary = overview.history.find((row) => row.date === date) ?? null;
  const [snapshots, entries, positions] = await Promise.all([
    DailyPerformanceSnapshot.findAll({ where: { user_id: userId, snapshot_date: date }, order: [["created_at", "ASC"]] }),
    LedgerEntry.findAll({
      where: { user_id: userId, created_at: { [Op.gte]: new Date(`${date}T00:00:00.000Z`), [Op.lt]: new Date(`${date}T23:59:59.999Z`) } },
      order: [["created_at", "ASC"]]
    }),
    InvestmentPosition.findAll({ where: { user_id: userId } })
  ]);
  const assetByPosition = new Map(positions.map((position) => [position.position_id, position.asset]));
  const latest = latestVerifiedSnapshots(snapshots);
  return {
    date,
    summary,
    positions: latest.map((snapshot) => ({
      positionId: snapshot.position_id,
      asset: assetByPosition.get(snapshot.position_id) ?? "UNKNOWN",
      strategy: snapshot.strategy,
      openingValuation: String(snapshot.opening_valuation),
      closingValuation: snapshot.closing_valuation === null ? null : String(snapshot.closing_valuation),
      cashFlow: String(snapshot.cash_flow),
      profitLoss: snapshot.profit_loss === null ? null : String(snapshot.profit_loss),
      roiPercent: snapshot.roi_percent === null ? null : String(snapshot.roi_percent),
      verificationStatus: snapshot.verification_status,
      dataSource: snapshot.data_source,
      reason: snapshot.reason,
      correctionOf: snapshot.correction_of
    })),
    events: entries.map((entry) => ({
      entryId: entry.entry_id,
      direction: entry.direction,
      amount: String(entry.amount),
      asset: entry.asset,
      transactionType: entry.transaction_type,
      createdAt: entry.created_at.toISOString()
    }))
  };
}

export interface ReconciliationResult {
  date: string;
  checked: number;
  mismatched: number;
  correctionsRecorded: number;
  issues: Array<{ code: string; reference: string; detail: string }>;
}

export async function reconcilePerformance(adminId: string, date: string): Promise<ReconciliationResult> {
  const [positions, snapshots, entries] = await Promise.all([
    InvestmentPosition.findAll({ where: { status: "active" } }),
    DailyPerformanceSnapshot.findAll({ where: { snapshot_date: date, verification_status: "verified" } }),
    LedgerEntry.findAll({ where: { source_type: "deposit", transaction_type: "deposit_confirmed" } })
  ]);
  const issues: Array<{ code: string; reference: string; detail: string }> = [];
  const positionsById = new Map(positions.map((position) => [position.position_id, position]));

  for (const snapshot of snapshots) {
    const position = positionsById.get(snapshot.position_id);
    if (!position) {
      issues.push({
        code: "snapshot_without_position",
        reference: snapshot.snapshot_id,
        detail: "A verified snapshot references a position that is no longer active."
      });
      continue;
    }
    const opening = parseDecimal(String(snapshot.opening_valuation), 8);
    const closing = snapshot.closing_valuation === null ? null : parseDecimal(String(snapshot.closing_valuation), 8);
    const profit = snapshot.profit_loss === null ? null : parseDecimal(String(snapshot.profit_loss), 8);
    if (closing !== null && profit !== null) {
      const expected = closing - (opening + parseDecimal(String(snapshot.cash_flow), 8));
      if (expected !== profit) {
        issues.push({
          code: "profit_mismatch",
          reference: snapshot.snapshot_id,
          detail: `Recorded profit ${profit.toString()} does not equal closing minus adjusted opening ${expected.toString()}.`
        });
      }
    }
    const principal = parseDecimal(String(position.principal), 8);
    const lastKnown = position.current_valuation === null ? null : parseDecimal(String(position.current_valuation), 8);
    if (lastKnown !== null && snapshot.snapshot_date === date && lastKnown !== closing) {
      issues.push({
        code: "position_valuation_mismatch",
        reference: position.position_id,
        detail: "The position's latest valuation does not match today's verified snapshot."
      });
    }
    if (principal < 0n) {
      issues.push({ code: "negative_principal", reference: position.position_id, detail: "Position principal is negative." });
    }
  }

  for (const entry of entries) {
    const positionExists = positions.some((position) => position.deposit_id === entry.source_id);
    if (!positionExists) {
      issues.push({
        code: "deposit_without_position",
        reference: entry.source_id,
        detail: "A confirmed deposit ledger entry has no matching investment position."
      });
    }
  }

  let correctionsRecorded = 0;
  for (const issue of issues) {
    const existing = await PerformanceCalculationLog.findOne({
      where: { snapshot_date: date, outcome: "reconciliation", message: `${issue.code}:${issue.reference}` }
    });
    if (existing) continue;
    await PerformanceCalculationLog.create({
      position_id: null,
      snapshot_date: date,
      outcome: "reconciliation",
      message: `${issue.code}:${issue.reference}`
    });
    correctionsRecorded += 1;
  }

  await AdminAuditLog.create({
    admin_id: adminId,
    action: "performance_reconciliation",
    entity_type: "daily_performance_snapshot",
    entity_id: date,
    reason: `Reconciliation run for ${date}`,
    metadata: { checked: snapshots.length, mismatched: issues.length, issues }
  });

  return {
    date,
    checked: snapshots.length,
    mismatched: issues.length,
    correctionsRecorded,
    issues
  };
}

export async function performanceReconciliationHistory(limit = 50) {
  const [logs, audits] = await Promise.all([
    PerformanceCalculationLog.findAll({ where: { outcome: "reconciliation" }, order: [["created_at", "DESC"]], limit }),
    AdminAuditLog.findAll({ where: { action: "performance_reconciliation" }, order: [["created_at", "DESC"]], limit })
  ]);
  return {
    logs: logs.map((log) => ({
      logId: log.log_id,
      snapshotDate: log.snapshot_date,
      message: log.message,
      createdAt: log.created_at
    })),
    audits: audits.map((audit) => ({
      auditId: audit.audit_id,
      adminId: audit.admin_id,
      entityId: audit.entity_id,
      reason: audit.reason,
      metadata: audit.metadata,
      createdAt: audit.created_at
    }))
  };
}

export async function performanceAdminOverview(userId: string) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");
  const overview = await getPerformanceOverview(userId, "all");
  return overview;
}
