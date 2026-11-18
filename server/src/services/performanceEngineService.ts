import { randomUUID } from "crypto";
import { Op } from "sequelize";
import { calculateDailyPerformance } from "../domain/performanceRules";
import { formatDecimal, parseDecimal } from "../domain/money";
import { generateReference } from "../domain/transactionRules";
import { isFutureSnapshot, isPerformanceDayEligible } from "../domain/earningsRules";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { DailyPerformanceSnapshot } from "../models/DailyPerformanceSnapshot";
import { Deposit } from "../models/Deposit";
import { InvestmentPosition } from "../models/InvestmentPosition";
import { LedgerAccount } from "../models/LedgerAccount";
import { LedgerEntry } from "../models/LedgerEntry";
import { PerformanceCalculationLog } from "../models/PerformanceCalculationLog";
import { User } from "../models/User";
import { notifyFinancialEvent } from "./financialNotificationService";
import { postBalancedEntry } from "./financialOperationsService";
import { getPerformanceSettings, getReconciliationSettings } from "./platformSettingsService";

const VERIFIED_POSITION_SOURCE = "verified_position_valuation";
const AMOUNT_SCALE = 8;

function dayKeyOf(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function dayBounds(date: string): { start: Date; end: Date } {
  return { start: new Date(`${date}T00:00:00.000Z`), end: new Date(`${date}T23:59:59.999Z`) };
}

function signedProfitLabel(profitCents: bigint, roiPercent: string | null, asset: string, date: string): string {
  const magnitude = formatDecimal(profitCents < 0n ? -profitCents : profitCents, AMOUNT_SCALE);
  const direction = profitCents > 0n ? "gain" : profitCents < 0n ? "loss" : "flat";
  return `${direction} of ${magnitude} ${asset} on ${date}${roiPercent === null ? "" : ` (ROI ${roiPercent}%)`}`;
}

interface DailyCycleSummary {
  snapshotDate: string;
  positionsEvaluated: number;
  snapshotsRecorded: number;
  unavailableRecorded: number;
  skipped: number;
  usersNotified: number;
}

// Scheduled daily investment performance engine. For every active position that is
// eligible to be measured on the given date (i.e. the day after its deposit was
// independently verified and confirmed), it computes realised/unrealised daily
// performance strictly from the position's verified valuation and the
// authoritative ledger. If no verified valuation exists, it records the day as
// unavailable instead of inventing a return.
export async function runDailyPerformanceCycle(snapshotDate: string): Promise<DailyCycleSummary> {
  if (isFutureSnapshot(snapshotDate)) {
    return { snapshotDate, positionsEvaluated: 0, snapshotsRecorded: 0, unavailableRecorded: 0, skipped: 0, usersNotified: 0 };
  }

  const settings = await getPerformanceSettings();
  const positions = await InvestmentPosition.findAll({ where: { status: "active" } });
  const depositIds = positions
    .map((position) => position.deposit_id)
    .filter((depositId): depositId is string => depositId !== null);
  const deposits = depositIds.length > 0 ? await Deposit.findAll({ where: { deposit_id: { [Op.in]: depositIds } } }) : [];
  const confirmedByDeposit = new Map(
    deposits.map((deposit) => [deposit.deposit_id, deposit.confirmed_at ? new Date(deposit.confirmed_at) : null])
  );

  const { start, end } = dayBounds(snapshotDate);
  const flowEntries = await LedgerEntry.findAll({
    where: { transaction_type: "deposit_confirmed", created_at: { [Op.gte]: start, [Op.lte]: end } }
  });
  const cashFlowByDeposit = new Map<string, bigint>();
  for (const entry of flowEntries) {
    const current = cashFlowByDeposit.get(entry.source_id) ?? 0n;
    cashFlowByDeposit.set(entry.source_id, current + parseDecimal(String(entry.amount), AMOUNT_SCALE));
  }

  let snapshotsRecorded = 0;
  let unavailableRecorded = 0;
  let skipped = 0;
  const notifiedUsers = new Set<string>();

  for (const position of positions) {
    const confirmedAt = (position.deposit_id ? confirmedByDeposit.get(position.deposit_id) : undefined) ?? null;
    if (!isPerformanceDayEligible(confirmedAt, snapshotDate)) {
      skipped += 1;
      continue;
    }

    const alreadyVerified = await DailyPerformanceSnapshot.findOne({
      where: { position_id: position.position_id, snapshot_date: snapshotDate, verification_status: "verified" }
    });
    if (alreadyVerified) {
      skipped += 1;
      continue;
    }

    const previous = await DailyPerformanceSnapshot.findOne({
      where: { position_id: position.position_id, snapshot_date: { [Op.lt]: snapshotDate }, verification_status: "verified" },
      order: [["snapshot_date", "DESC"]]
    });
    const opening =
      previous && previous.closing_valuation !== null ? parseDecimal(String(previous.closing_valuation), AMOUNT_SCALE) : parseDecimal(String(position.principal), AMOUNT_SCALE);

    const valuationIsCurrent =
      position.verification_status === "verified" &&
      position.current_valuation !== null &&
      position.last_calculated_at !== null &&
      dayKeyOf(position.last_calculated_at) === snapshotDate;

    if (!valuationIsCurrent) {
      const existingLog = await PerformanceCalculationLog.findOne({
        where: { position_id: position.position_id, snapshot_date: snapshotDate, outcome: "unavailable" }
      });
      if (!existingLog) {
        await PerformanceCalculationLog.create({
          position_id: position.position_id,
          snapshot_date: snapshotDate,
          outcome: "unavailable",
          message: "No independently verified valuation was recorded for this position on this date."
        });
        unavailableRecorded += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const closing = parseDecimal(String(position.current_valuation), AMOUNT_SCALE);
    const cashFlow = (position.deposit_id ? cashFlowByDeposit.get(position.deposit_id) : undefined) ?? 0n;
    const result = calculateDailyPerformance({
      openingCents: opening,
      closingCents: closing,
      cashFlowCents: cashFlow,
      verified: settings.requireVerifiedValuation
    });

    const snapshot = await DailyPerformanceSnapshot.create({
      user_id: position.user_id,
      position_id: position.position_id,
      snapshot_date: snapshotDate,
      opening_valuation: formatDecimal(opening, AMOUNT_SCALE),
      closing_valuation: formatDecimal(closing, AMOUNT_SCALE),
      cash_flow: formatDecimal(cashFlow, AMOUNT_SCALE),
      profit_loss: result.profitCents === null ? null : formatDecimal(result.profitCents, AMOUNT_SCALE),
      roi_percent: result.roiPercent,
      strategy: position.strategy,
      data_source: VERIFIED_POSITION_SOURCE,
      verification_status: "verified",
      correction_of: null,
      reason: "Scheduled daily performance calculation from the position's independently verified valuation."
    });
    snapshotsRecorded += 1;

    await PerformanceCalculationLog.create({
      position_id: position.position_id,
      snapshot_date: snapshotDate,
      outcome: "verified",
      message: `Daily performance computed from verified valuation. Reference ${snapshot.snapshot_id}.`
    });

    if (settings.automaticDailyCalculation && result.profitCents !== null) {
      await notifyFinancialEvent({
        userId: position.user_id,
        type: "daily_performance",
        templateKey: "dailyPerformance",
        variables: {
          date: snapshotDate,
          detail: signedProfitLabel(result.profitCents, result.roiPercent, position.asset, snapshotDate),
          source: VERIFIED_POSITION_SOURCE,
          reference: snapshot.snapshot_id
        },
        fallbackMessage: `Daily performance for ${snapshotDate}: ${signedProfitLabel(
          result.profitCents,
          result.roiPercent,
          position.asset,
          snapshotDate
        )}. Reference ${snapshot.snapshot_id}.`
      });
      notifiedUsers.add(position.user_id);
    }
  }

  return {
    snapshotDate,
    positionsEvaluated: positions.length,
    snapshotsRecorded,
    unavailableRecorded,
    skipped,
    usersNotified: notifiedUsers.size
  };
}

export interface ProfitDistributionInput {
  userId: string;
  asset: string;
  amount: string;
  reason: string;
}

// Moves previously verified realised earnings into the user's withdrawable balance.
// This is the only path that turns performance into withdrawable cash, and it always
// posts a balanced profit_distribution ledger transaction so realised profit is a
// distinct, auditable category. Unrealised performance is never distributed here.
export async function recordProfitDistribution(adminId: string, input: ProfitDistributionInput) {
  if (!input.reason.trim()) throw new Error("A reason is required to distribute realised profit.");
  const amount = formatDecimal(parseDecimal(input.amount, AMOUNT_SCALE), AMOUNT_SCALE);
  if (parseDecimal(amount, AMOUNT_SCALE) <= 0n) throw new Error("The distribution amount must be greater than zero.");

  const user = await User.findByPk(input.userId);
  if (!user) throw new Error("User not found");

  const reference = generateReference("profit_distribution", randomUUID());
  await postBalancedEntry({
    userId: user.user_id,
    asset: input.asset,
    amount,
    transactionType: "profit_distribution",
    sourceType: "profit_distribution",
    sourceId: randomUUID(),
    debit: "realized_earnings",
    credit: "available_balance"
  });

  user.withdrawable_balance = Number((Number(user.withdrawable_balance) + Number(amount)).toFixed(AMOUNT_SCALE));
  await user.save();

  await AdminAuditLog.create({
    admin_id: adminId,
    action: "profit_distribution",
    entity_type: "user",
    entity_id: user.user_id,
    reason: input.reason,
    metadata: { amount, asset: input.asset, reference }
  });

  await notifyFinancialEvent({
    userId: user.user_id,
    type: "profit_realised",
    templateKey: "profitRealised",
    variables: { amount, asset: input.asset, reference },
    fallbackMessage: `Realised earnings of ${amount} ${input.asset} credited to your withdrawable balance. Reference ${reference}.`
  });

  return { userId: user.user_id, amount, asset: input.asset, reference };
}

export interface LedgerReconciliationResult {
  date: string;
  checked: number;
  mismatched: number;
  issues: Array<{ code: string; reference: string; detail: string }>;
}

// Cross-checks each verified daily snapshot's arithmetic and confirms the opening
// capital measured by the engine agrees with the authoritative ledger's
// invested_principal balance for the affected account.
export async function reconcilePerformanceAgainstLedger(adminId: string, date: string, userId?: string): Promise<LedgerReconciliationResult> {
  const where: Record<string, unknown> = { snapshot_date: date, verification_status: "verified" };
  if (userId) where.user_id = userId;
  const snapshots = await DailyPerformanceSnapshot.findAll({ where });
  const issues: Array<{ code: string; reference: string; detail: string }> = [];
  const settings = await getReconciliationSettings();
  const tolerance = parseDecimal(settings.toleranceAmount, AMOUNT_SCALE);
  const usersChecked = new Set<string>();

  for (const snapshot of snapshots) {
    usersChecked.add(snapshot.user_id);
    const opening = parseDecimal(String(snapshot.opening_valuation), AMOUNT_SCALE);
    const closing = snapshot.closing_valuation === null ? null : parseDecimal(String(snapshot.closing_valuation), AMOUNT_SCALE);
    const cashFlow = parseDecimal(String(snapshot.cash_flow), AMOUNT_SCALE);
    const profit = snapshot.profit_loss === null ? null : parseDecimal(String(snapshot.profit_loss), AMOUNT_SCALE);
    if (closing !== null && profit !== null) {
      const expected = closing - (opening + cashFlow);
      const delta = expected > profit ? expected - profit : profit - expected;
      if (delta > tolerance) {
        issues.push({
          code: "snapshot_arithmetic_mismatch",
          reference: snapshot.snapshot_id,
          detail: `Recorded profit ${profit.toString()} does not equal closing minus adjusted opening ${expected.toString()}.`
        });
      }
    }
    if (opening < 0n) {
      issues.push({
        code: "negative_opening_capital",
        reference: snapshot.snapshot_id,
        detail: "Opening capital for the day is negative."
      });
    }
  }

  for (const checkedUserId of usersChecked) {
    const [accounts, entries] = await Promise.all([
      LedgerAccount.findAll({ where: { user_id: checkedUserId } }),
      LedgerEntry.findAll({ where: { user_id: checkedUserId } })
    ]);
    const byAccount = new Map(accounts.map((account) => [account.account_id, account]));
    let invested = 0n;
    for (const entry of entries) {
      const account = byAccount.get(entry.account_id);
      if (!account || account.code !== "invested_principal") continue;
      const amount = parseDecimal(String(entry.amount), AMOUNT_SCALE);
      invested += entry.direction === "credit" ? amount : -amount;
    }
    const positions = await InvestmentPosition.findAll({ where: { user_id: checkedUserId, status: "active" } });
    let principal = 0n;
    for (const position of positions) principal += parseDecimal(String(position.principal), AMOUNT_SCALE);
    if (invested !== principal) {
      issues.push({
        code: "ledger_principal_mismatch",
        reference: checkedUserId,
        detail: `Ledger invested principal ${invested.toString()} does not match active position principal ${principal.toString()}.`
      });
    }
  }

  const existing = await PerformanceCalculationLog.findAll({
    where: { snapshot_date: date, outcome: "reconciliation" }
  });
  const recordedMessages = new Set(existing.map((log) => log.message));
  for (const issue of issues) {
    const message = `${issue.code}:${issue.reference}`;
    if (recordedMessages.has(message)) continue;
    await PerformanceCalculationLog.create({
      position_id: null,
      snapshot_date: date,
      outcome: "reconciliation",
      message
    });
  }

  await AdminAuditLog.create({
    admin_id: adminId,
    action: "performance_ledger_reconciliation",
    entity_type: "daily_performance_snapshot",
    entity_id: userId ?? date,
    reason: `Performance reconciliation against the ledger for ${date}`,
    metadata: { checked: snapshots.length, mismatched: issues.length, issues }
  });

  return { date, checked: snapshots.length, mismatched: issues.length, issues };
}

export async function dailyPerformanceSummary(date: string) {
  const [snapshots, logs] = await Promise.all([
    DailyPerformanceSnapshot.findAll({ where: { snapshot_date: date }, order: [["created_at", "ASC"]] }),
    PerformanceCalculationLog.findAll({ where: { snapshot_date: date }, order: [["created_at", "ASC"]] })
  ]);
  const verified = snapshots.filter((snapshot) => snapshot.verification_status === "verified" && snapshot.profit_loss !== null);
  let gain = 0n;
  let loss = 0n;
  for (const snapshot of verified) {
    const profit = parseDecimal(String(snapshot.profit_loss), AMOUNT_SCALE);
    if (profit > 0n) gain += profit;
    else if (profit < 0n) loss += -profit;
  }
  const latestByPosition = new Map<string, DailyPerformanceSnapshot>();
  for (const snapshot of snapshots) latestByPosition.set(snapshot.position_id, snapshot);
  return {
    date,
    recorded: latestByPosition.size,
    verified: [...latestByPosition.values()].filter((snapshot) => snapshot.verification_status === "verified").length,
    gain: formatDecimal(gain, AMOUNT_SCALE),
    loss: formatDecimal(loss, AMOUNT_SCALE),
    unavailable: logs.filter((log) => log.outcome === "unavailable").length,
    failed: logs.filter((log) => log.outcome === "failed").length,
    corrections: logs.filter((log) => log.outcome === "reconciliation").length,
    snapshots: [...latestByPosition.values()].map((snapshot) => ({
      snapshotId: snapshot.snapshot_id,
      positionId: snapshot.position_id,
      userId: snapshot.user_id,
      profitLoss: snapshot.profit_loss === null ? null : String(snapshot.profit_loss),
      roiPercent: snapshot.roi_percent === null ? null : String(snapshot.roi_percent),
      status: snapshot.verification_status,
      dataSource: snapshot.data_source
    })),
    events: logs.map((log) => ({
      logId: log.log_id,
      positionId: log.position_id,
      outcome: log.outcome,
      message: log.message,
      createdAt: log.created_at
    }))
  };
}
