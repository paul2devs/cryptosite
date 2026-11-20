import { Op, Transaction, UniqueConstraintError } from "sequelize";
import { sequelize } from "../config/database";
import { periodRoiPercent, projectedDailyEarnings, projectedEarningsSeries } from "../domain/earningsRules";
import { formatDecimal, parseDecimal } from "../domain/money";
import { buildLedgerIdempotencyKey } from "../domain/ledgerRules";
import { calculateDailyPerformance, sumVerifiedPerformance } from "../domain/performanceRules";
import { generateReference } from "../domain/transactionRules";
import { assertWithdrawalTransition, coarseStatusForDetailed, deriveWithdrawalStatus } from "../domain/withdrawalRules";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { DailyPerformanceSnapshot } from "../models/DailyPerformanceSnapshot";
import { Deposit } from "../models/Deposit";
import { InvestmentPosition } from "../models/InvestmentPosition";
import { LedgerAccount, LedgerAccountCode } from "../models/LedgerAccount";
import { LedgerEntry } from "../models/LedgerEntry";
import { MembershipHistory } from "../models/MembershipHistory";
import { Notification } from "../models/Notification";
import { PerformanceCalculationLog } from "../models/PerformanceCalculationLog";
import { User } from "../models/User";
import { UserActivityEvent } from "../models/UserActivityEvent";
import { UserMembership } from "../models/UserMembership";
import { Withdrawal } from "../models/Withdrawal";
import { trackUserActivity } from "./activityService";
import { creditPromotionalBonus } from "./bonusEngineService";
import { notifyFinancialEvent } from "./financialNotificationService";
import { dispatchNotificationEmail } from "./notificationDispatchService";
import { syncUserInvestmentLevel } from "./investmentLevelService";
import { syncUserMembership } from "./membershipService";
import { getPerformanceOverview } from "./performanceService";
import { getPerformanceSettings } from "./platformSettingsService";

const ACCOUNT_CODES: LedgerAccountCode[] = [
  "confirmed_deposits",
  "available_balance",
  "invested_principal",
  "locked_principal",
  "realized_earnings",
  "pending_settlement",
  "withdrawals",
  "fees",
  "adjustments",
  "promotional_credits"
];

async function accountFor(userId: string, code: LedgerAccountCode, asset: string, transaction?: Transaction) {
  const [account] = await LedgerAccount.findOrCreate({
    where: { user_id: userId, code, asset },
    defaults: { user_id: userId, code, asset },
    transaction
  });
  return account;
}

export async function postBalancedEntry(input: {
  userId: string;
  asset: string;
  amount: string;
  transactionType: string;
  sourceType: string;
  sourceId: string;
  debit: LedgerAccountCode;
  credit: LedgerAccountCode;
  transaction?: Transaction;
}) {
  const amount = formatDecimal(parseDecimal(input.amount, 8), 8);
  const debitKey = buildLedgerIdempotencyKey(
    input.sourceType,
    input.sourceId,
    input.debit
  );
  const existing = await LedgerEntry.findOne({ where: { idempotency_key: debitKey }, transaction: input.transaction });
  if (existing) return;
  const write = async (transaction: Transaction) => {
    const debit = await accountFor(input.userId, input.debit, input.asset, transaction);
    const credit = await accountFor(input.userId, input.credit, input.asset, transaction);
    try {
      await LedgerEntry.create({
        account_id: debit.account_id,
        user_id: input.userId,
        direction: "debit",
        amount,
        asset: input.asset,
        transaction_type: input.transactionType,
        source_type: input.sourceType,
        source_id: input.sourceId,
        idempotency_key: debitKey
      }, { transaction });
      await LedgerEntry.create({
        account_id: credit.account_id,
        user_id: input.userId,
        direction: "credit",
        amount,
        asset: input.asset,
        transaction_type: input.transactionType,
        source_type: input.sourceType,
        source_id: input.sourceId,
        idempotency_key: buildLedgerIdempotencyKey(
          input.sourceType,
          input.sourceId,
          input.credit
        )
      }, { transaction });
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) throw error;
    }
  };
  if (input.transaction) {
    await write(input.transaction);
    return;
  }
  await sequelize.transaction(write);
}

export async function recordConfirmedDeposit(deposit: Deposit) {
  // The independently verified on-chain quantity is the amount credited. The
  // originally requested amount (deposit.amount) stays on the record unchanged,
  // and no market price is ever substituted for what was actually received.
  const amount = Number(deposit.received_amount ?? deposit.amount).toFixed(8);
  await postBalancedEntry({
    userId: deposit.user_id,
    asset: deposit.crypto_type,
    amount,
    transactionType: "deposit_confirmed",
    sourceType: "deposit",
    sourceId: deposit.deposit_id,
    debit: "confirmed_deposits",
    credit: "invested_principal"
  });
  const [position, positionCreated] = await InvestmentPosition.findOrCreate({
    where: { deposit_id: deposit.deposit_id },
    defaults: {
      user_id: deposit.user_id,
      deposit_id: deposit.deposit_id,
      asset: deposit.crypto_type,
      principal: amount,
      strategy: "custody_hold",
      status: "active",
      verification_status: "unavailable"
    }
  });
  await syncUserMembership(deposit.user_id, "Confirmed deposit changed verified qualifying amount");
  await syncUserInvestmentLevel(deposit.user_id, "Confirmed deposit changed verified invested principal");

  const depositReference = generateReference("deposit", deposit.deposit_id);
  await notifyFinancialEvent({
    userId: deposit.user_id,
    type: "deposit_confirmed",
    templateKey: "depositConfirmation",
    variables: { amount, asset: deposit.crypto_type, reference: depositReference },
    fallbackMessage: `Deposit ${amount} ${deposit.crypto_type} confirmed. Reference ${depositReference}.`,
    email: {
      sourceId: deposit.deposit_id,
      subject: `Deposit credited: ${deposit.crypto_type} ${amount}`,
      heading: "Deposit approved and credited",
      preheader: "Your deposit has been verified and your wallet has been credited.",
      details: [
        { label: "Transaction reference", value: depositReference },
        { label: "Amount", value: `${amount} ${deposit.crypto_type}` },
        { label: "Asset", value: deposit.crypto_type },
        { label: "Date", value: new Date().toISOString() }
      ],
      statusLabel: "Approved",
      statusTone: "positive",
      ctaLabel: "View wallet",
      ctaPath: "/portfolio"
    }
  });

  if (positionCreated) {
    await notifyFinancialEvent({
      userId: deposit.user_id,
      type: "investment_allocation",
      templateKey: "investmentAllocation",
      variables: {
        amount,
        asset: deposit.crypto_type,
        position: position.position_id,
        reference: depositReference
      },
      fallbackMessage: `Investment allocation of ${amount} ${deposit.crypto_type} recorded against position ${position.position_id}. Reference ${depositReference}.`,
      email: {
        sourceId: position.position_id,
        subject: `Investment position created: ${deposit.crypto_type} ${amount}`,
        heading: "Investment position created",
        preheader: "A new investment position has been allocated to your account.",
        details: [
          { label: "Transaction reference", value: depositReference },
          { label: "Position", value: position.position_id },
          { label: "Amount", value: `${amount} ${deposit.crypto_type}` },
          { label: "Asset", value: deposit.crypto_type },
          { label: "Date", value: new Date().toISOString() }
        ],
        statusLabel: "Active",
        statusTone: "gold",
        ctaLabel: "View portfolio",
        ctaPath: "/portfolio"
      }
    });
    await trackUserActivity(deposit.user_id, "investment_allocation", {
      position_id: position.position_id,
      deposit_id: deposit.deposit_id,
      amount,
      asset: deposit.crypto_type
    });
  }

  await creditPromotionalBonus(deposit);
}

export async function ledgerBalancesForUser(userId: string) {
  const accounts = await LedgerAccount.findAll({ where: { user_id: userId } });
  const entries = await LedgerEntry.findAll({ where: { user_id: userId }, order: [["created_at", "ASC"]] });
  const byAccount = new Map(accounts.map((account) => [account.account_id, account]));
  const totals: Record<string, string> = {};
  for (const code of ACCOUNT_CODES) totals[code] = "0.00000000";
  for (const entry of entries) {
    const account = byAccount.get(entry.account_id);
    if (!account) continue;
    const current = parseDecimal(totals[account.code] || "0.00000000", 8);
    const amount = parseDecimal(String(entry.amount), 8);
    totals[account.code] = formatDecimal(entry.direction === "credit" ? current + amount : current - amount, 8);
  }
  return { totals, entries };
}

export async function recordVerifiedValuation(adminId: string, input: {
  positionId: string;
  snapshotDate: string;
  closingValuation: string;
  cashFlow: string;
  dataSource: string;
  evidenceRef: string;
  reason: string;
  correctionOf?: string | null;
}) {
  const position = await InvestmentPosition.findByPk(input.positionId);
  if (!position) throw new Error("Position not found");
  if (!input.reason.trim() || !input.evidenceRef.trim() || !input.dataSource.trim()) {
    throw new Error("A source, evidence reference, and reason are required.");
  }
  const existing = await DailyPerformanceSnapshot.findOne({
    where: {
      position_id: position.position_id,
      snapshot_date: input.snapshotDate,
      verification_status: "verified",
      correction_of: input.correctionOf ?? null
    }
  });
  if (existing && !input.correctionOf) return existing;
  const opening = position.current_valuation || position.principal;
  const result = calculateDailyPerformance({
    openingCents: parseDecimal(String(opening), 8),
    closingCents: parseDecimal(input.closingValuation, 8),
    cashFlowCents: parseDecimal(input.cashFlow || "0", 8),
    verified: true
  });
  const snapshot = await DailyPerformanceSnapshot.create({
    user_id: position.user_id,
    position_id: position.position_id,
    snapshot_date: input.snapshotDate,
    opening_valuation: formatDecimal(parseDecimal(String(opening), 8), 8),
    closing_valuation: formatDecimal(parseDecimal(input.closingValuation, 8), 8),
    cash_flow: formatDecimal(parseDecimal(input.cashFlow || "0", 8), 8),
    profit_loss: result.profitCents === null ? null : formatDecimal(result.profitCents, 8),
    roi_percent: result.roiPercent,
    strategy: position.strategy,
    data_source: `${input.dataSource}:${input.evidenceRef}`,
    verification_status: "verified",
    correction_of: input.correctionOf ?? null,
    reason: input.reason
  });
  position.current_valuation = snapshot.closing_valuation;
  position.verification_status = "verified";
  position.last_calculated_at = new Date();
  await position.save();
  await PerformanceCalculationLog.create({
    position_id: position.position_id,
    snapshot_date: input.snapshotDate,
    outcome: "verified",
    message: `Verified valuation recorded from ${input.dataSource}. Unrealized performance is not withdrawable.`
  });
  await AdminAuditLog.create({
    admin_id: adminId,
    action: input.correctionOf ? "performance_correction" : "performance_verified",
    entity_type: "daily_performance_snapshot",
    entity_id: snapshot.snapshot_id,
    reason: input.reason,
    metadata: { evidenceRef: input.evidenceRef, dataSource: input.dataSource }
  });
  await notifyVerifiedPerformance(position.user_id, input.snapshotDate, result.roiPercent, result.profitCents);
  return snapshot;
}

function notificationFlag(settings: unknown, key: string): boolean {
  if (!settings || typeof settings !== "object") return false;
  const notifications = (settings as { notifications?: Record<string, unknown> }).notifications;
  return Boolean(notifications && notifications[key] === true);
}

async function notifyVerifiedPerformance(userId: string, snapshotDate: string, roiPercent: string | null, profitCents: bigint | null) {
  const user = await User.findByPk(userId);
  if (!user || roiPercent === null || profitCents === null) return;
  const direction = profitCents < 0n ? "loss" : profitCents === 0n ? "flat" : "gain";
  if (notificationFlag(user.account_settings, "daily_performance")) {
    await Notification.create({
      user_id: userId,
      type: "daily_performance",
      message: `Verified ${direction} for ${snapshotDate}: ${roiPercent}%. This result is unrealized and is not withdrawable cash.`
    });
  }
  const magnitude = parseDecimal(roiPercent.replace("-", ""), 6);
  if (notificationFlag(user.account_settings, "significant_moves") && magnitude >= 5000000n) {
    await Notification.create({
      user_id: userId,
      type: "significant_performance",
      message: `Verified performance moved ${roiPercent}% on ${snapshotDate}. The change stays unrealized until a distribution is recorded.`
    });
  }
}

export async function markMissingPerformance(snapshotDate: string) {
  const positions = await InvestmentPosition.findAll({ where: { status: "active" } });
  for (const position of positions) {
    const existing = await DailyPerformanceSnapshot.findOne({
      where: { position_id: position.position_id, snapshot_date: snapshotDate, verification_status: "verified" }
    });
    if (existing) continue;
    const already = await PerformanceCalculationLog.findOne({
      where: { position_id: position.position_id, snapshot_date: snapshotDate, outcome: "unavailable" }
    });
    if (already) continue;
    await PerformanceCalculationLog.create({
      position_id: position.position_id,
      snapshot_date: snapshotDate,
      outcome: "unavailable",
      message: "No verified valuation was supplied for this date."
    });
  }
}

function pageQuery(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize || 20)));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export async function adminOverview() {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const [users, activeUsers, newUsers, deposits, withdrawals, positions, activity] = await Promise.all([
    User.count(),
    User.count({ where: { last_activity_at: { [Op.gte]: since } } }),
    User.count({ where: { created_at: { [Op.gte]: day } } }),
    Deposit.findAll(),
    Withdrawal.findAll(),
    InvestmentPosition.count({ where: { status: "active" } }),
    UserActivityEvent.findAll({ order: [["timestamp", "DESC"]], limit: 20 })
  ]);
  const confirmed = deposits.filter((row) => row.status === "Approved");
  const pendingDeposits = deposits.filter((row) => row.status === "Pending").length;
  const pendingWithdrawals = withdrawals.filter((row) => row.status === "Pending" || row.detailed_status === "requested" || row.detailed_status === "under_review").length;
  const completedWithdrawals = withdrawals.filter((row) => row.status === "Approved" || row.detailed_status === "completed");
  return {
    totalUsers: users,
    activeUsers,
    newRegistrations: newUsers,
    verifiedUsers: null,
    verificationNote: "Email verification status is not tracked on the user record.",
    confirmedDepositCount: confirmed.length,
    confirmedWithdrawalCount: completedWithdrawals.length,
    pendingDeposits,
    pendingWithdrawals,
    assetsUnderCustody: null,
    custodyNote: "On-chain custody reconciliation is unavailable until a custody balance source is configured.",
    activePositions: positions,
    realizedPerformance: null,
    performanceNote: "Realized performance is unavailable unless verified ledger earnings exist.",
    recentActivity: activity.map((event) => ({
      id: event.id,
      type: event.type,
      userId: event.user_id,
      timestamp: event.timestamp,
      metadata: event.metadata
    }))
  };
}

export async function listUsers(query: Record<string, unknown>) {
  const { page, pageSize, offset } = pageQuery(query);
  const where: Record<string | symbol, unknown> = {};
  const q = String(query.q || "").trim();
  if (q) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${q}%` } },
      { name: { [Op.iLike]: `%${q}%` } },
      { user_id: q }
    ];
  }
  const status = String(query.status || "");
  if (status === "restricted") where.bonus_blocked = true;
  if (status === "active") where.bonus_blocked = false;
  const tierFilter = String(query.membership || "");
  if (tierFilter) {
    const members = await UserMembership.findAll({ where: { tier_id: tierFilter }, attributes: ["user_id"] });
    where.user_id = { [Op.in]: members.map((member) => member.user_id) };
  }
  const { rows, count } = await User.findAndCountAll({ where, limit: pageSize, offset, order: [["created_at", "DESC"]] });
  const mapped = [];
  for (const user of rows) {
    const membership = await UserMembership.findByPk(user.user_id);
    const confirmed = await Deposit.sum("amount", { where: { user_id: user.user_id, status: "Approved" } });
    mapped.push({
      userId: user.user_id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
      level: user.level,
      membershipTierId: membership?.tier_id ?? null,
      qualifyingAmount: membership ? String(membership.qualifying_amount) : "0.00",
      withdrawableBalance: user.withdrawable_balance,
      lockedBalance: user.locked_balance,
      confirmedDepositTotal: confirmed || 0,
      lastActivityAt: user.last_activity_at,
      accountStatus: user.bonus_blocked ? "restricted" : "active",
      verificationStatus: "not_tracked"
    });
  }
  return { page, pageSize, total: count, users: mapped };
}

export async function userProfile(userId: string) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");
  const [deposits, withdrawals, ledger, positions, activity, membership, history] = await Promise.all([
    Deposit.findAll({ where: { user_id: userId }, order: [["timestamp", "DESC"]], limit: 50 }),
    Withdrawal.findAll({ where: { user_id: userId }, order: [["timestamp", "DESC"]], limit: 50 }),
    ledgerBalancesForUser(userId),
    InvestmentPosition.findAll({ where: { user_id: userId } }),
    UserActivityEvent.findAll({ where: { user_id: userId }, order: [["timestamp", "DESC"]], limit: 50 }),
    UserMembership.findByPk(userId),
    MembershipHistory.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]], limit: 50 })
  ]);
  return {
    account: { userId: user.user_id, name: user.name, email: user.email, createdAt: user.created_at, isAdmin: user.is_admin },
    membership,
    deposits,
    withdrawals,
    ledger,
    positions,
    activity,
    history
  };
}

export async function listDeposits(query: Record<string, unknown>) {
  const { page, pageSize, offset } = pageQuery(query);
  const where: Record<string, unknown> = {};
  const status = String(query.status || "");
  const statusMap: Record<string, string> = { pending: "Pending", confirmed: "Approved", failed: "Rejected", under_review: "UnderReview" };
  if (status && statusMap[status]) where.status = statusMap[status];
  if (query.asset) where.crypto_type = String(query.asset);
  if (query.network) where.network = String(query.network);
  if (query.from || query.to) {
    where.timestamp = {
      ...(query.from ? { [Op.gte]: new Date(String(query.from)) } : {}),
      ...(query.to ? { [Op.lte]: new Date(String(query.to)) } : {})
    };
  }
  const { rows, count } = await Deposit.findAndCountAll({ where, include: [{ model: User }], limit: pageSize, offset, order: [["timestamp", "DESC"]] });
  return { page, pageSize, total: count, deposits: rows };
}

export async function listWithdrawals(query: Record<string, unknown>) {
  const { page, pageSize, offset } = pageQuery(query);
  const where: Record<string, unknown> = {};
  if (query.status) where.detailed_status = String(query.status);
  const { rows, count } = await Withdrawal.findAndCountAll({ where, include: [{ model: User }], limit: pageSize, offset, order: [["timestamp", "DESC"]] });
  return { page, pageSize, total: count, withdrawals: rows };
}

export async function reviewWithdrawal(adminId: string, withdrawalId: string, status: string, reason: string, txHash?: string) {
  if (!reason.trim()) throw new Error("A recorded reason is required");
  const withdrawal = await sequelize.transaction(async (transaction) => {
    const row = await Withdrawal.findByPk(withdrawalId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new Error("Withdrawal not found");
    const current = deriveWithdrawalStatus(row.status, row.detailed_status);
    assertWithdrawalTransition(current, status);
    const asset = row.asset || "USD";
    const amount = Number(row.amount).toFixed(8);
    const reservation = await LedgerEntry.findOne({
      where: { source_type: "withdrawal_reserve", source_id: row.withdrawal_id },
      transaction
    });
    const hasReservation = Boolean(reservation);

    row.detailed_status = status;
    row.review_reason = reason;
    row.processed_at = new Date();
    if (txHash) row.tx_hash = txHash;
    row.status = coarseStatusForDetailed(status);
    await row.save({ transaction });

    if (status === "completed") {
      await postBalancedEntry({
        userId: row.user_id,
        asset,
        amount,
        transactionType: "withdrawal_completed",
        sourceType: "withdrawal_complete",
        sourceId: row.withdrawal_id,
        debit: hasReservation ? "pending_settlement" : "available_balance",
        credit: "withdrawals",
        transaction
      });
    } else if (status === "rejected" || status === "failed" || status === "cancelled") {
      if (hasReservation) {
        await postBalancedEntry({
          userId: row.user_id,
          asset,
          amount,
          transactionType: "withdrawal_released",
          sourceType: "withdrawal_release",
          sourceId: row.withdrawal_id,
          debit: "pending_settlement",
          credit: "available_balance",
          transaction
        });
        const owner = await User.findByPk(row.user_id, { transaction, lock: transaction.LOCK.UPDATE });
        if (owner) {
          owner.withdrawable_balance = Number(
            (Number(owner.withdrawable_balance) + Number(row.amount)).toFixed(8)
          );
          await owner.save({ transaction });
        }
      }
    }
    await AdminAuditLog.create({
      admin_id: adminId,
      action: "withdrawal_reviewed",
      entity_type: "withdrawal",
      entity_id: row.withdrawal_id,
      reason,
      metadata: { status, previous: current, reservationReleased: status !== "completed" && hasReservation }
    }, { transaction });
    return row;
  });
  await trackUserActivity(withdrawal.user_id, "withdrawal_reviewed", {
    withdrawalId: withdrawal.withdrawal_id,
    status,
    outcome: "recorded"
  });
  const owner = await User.findByPk(withdrawal.user_id);
  if (owner && notificationFlag(owner.account_settings, "withdrawal_updates")) {
    const asset = withdrawal.asset || "USD";
    const amount = Number(withdrawal.amount).toFixed(8);
    const reference = generateReference("withdrawal", withdrawal.withdrawal_id);
    const processed = status === "completed";
    const failed = status === "rejected" || status === "failed" || status === "cancelled";
    const userMessage = withdrawalStatusUserMessage(status, reference, amount, asset);
    await Notification.create({
      user_id: owner.user_id,
      type: "withdrawal_status",
      message: userMessage
    });
    await dispatchNotificationEmail({
      user: owner,
      type: "withdrawal_status",
      message: userMessage,
      email: {
        sourceId: `${withdrawal.withdrawal_id}:${status}`,
        subject: processed
          ? `Withdrawal processed: ${amount} ${asset}`
          : failed
            ? `Withdrawal not approved: ${amount} ${asset}`
            : `Withdrawal update: ${amount} ${asset}`,
        heading: processed
          ? "Withdrawal processed"
          : failed
            ? "Withdrawal could not be approved"
            : "Withdrawal status updated",
        preheader: "An update on your withdrawal request.",
        details: [
          { label: "Reference", value: reference },
          { label: "Amount", value: `${amount} ${asset}` },
          { label: "Asset", value: asset },
          { label: "Date", value: new Date().toISOString() }
        ],
        statusLabel: processed ? "Completed" : failed ? "Rejected" : status,
        statusTone: processed ? "positive" : failed ? "negative" : "gold",
        ctaLabel: "View withdrawals",
        ctaPath: "/transactions"
      }
    });
  }
  return withdrawal;
}

/**
 * Neutral, user-facing withdrawal status copy. The internal review reason is
 * deliberately not echoed here so administrator notes and identities are never
 * surfaced to the account holder.
 */
function withdrawalStatusUserMessage(status: string, reference: string, amount: string, asset: string): string {
  if (status === "completed") {
    return `Your withdrawal of ${amount} ${asset} has been processed successfully. Reference ${reference}.`;
  }
  if (status === "rejected" || status === "failed" || status === "cancelled") {
    return `Your withdrawal of ${amount} ${asset} could not be approved. Please review the withdrawal details or contact support. Reference ${reference}.`;
  }
  return `Your withdrawal of ${amount} ${asset} is now ${status}. Reference ${reference}.`;
}

export async function listLedger(query: Record<string, unknown>) {
  if (query.entryId) {
    const entry = await LedgerEntry.findByPk(String(query.entryId));
    if (!entry) throw new Error("Ledger entry not found");
    const pair = await LedgerEntry.findAll({
      where: { source_type: entry.source_type, source_id: entry.source_id },
      order: [["created_at", "ASC"]]
    });
    return { entry, related: pair };
  }
  const { page, pageSize, offset } = pageQuery(query);
  const where: Record<string, unknown> = {};
  if (query.type) where.transaction_type = String(query.type);
  if (query.asset) where.asset = String(query.asset);
  const { rows, count } = await LedgerEntry.findAndCountAll({ where, limit: pageSize, offset, order: [["created_at", "DESC"]] });
  return { page, pageSize, total: count, entries: rows };
}

function latestByPositionDate(rows: DailyPerformanceSnapshot[]) {
  const chosen = new Map<string, DailyPerformanceSnapshot>();
  for (const row of rows) {
    const key = `${row.position_id}:${row.snapshot_date}`;
    const current = chosen.get(key);
    if (!current || current.created_at < row.created_at) chosen.set(key, row);
  }
  return [...chosen.values()].sort((left, right) => String(left.snapshot_date).localeCompare(String(right.snapshot_date)));
}

export async function userPerformance(userId: string, range: string) {
  const [overview, settings] = await Promise.all([getPerformanceOverview(userId, range), getPerformanceSettings()]);
  const principal = overview.overview.investedPrincipal;
  return {
    range,
    methodology: overview.methodology,
    metrics: overview.overview,
    chart: overview.chart,
    history: overview.snapshots,
    dailyHistory: overview.history,
    today: overview.today,
    cumulative: overview.cumulative,
    realizedEarnings: overview.realizedEarnings,
    note: overview.note,
    projection: {
      dailyRatePercent: settings.illustrativeDailyRatePercent,
      periodDays: settings.illustrativePeriodDays,
      periodRoiPercent: periodRoiPercent(
        settings.illustrativeDailyRatePercent,
        settings.illustrativePeriodDays
      ),
      disclaimer: settings.illustrativeDisclaimer,
      principal,
      projectedDailyEarnings: projectedDailyEarnings(principal, settings.illustrativeDailyRatePercent),
      projectedPeriodEarnings: projectedEarningsSeries(
        principal,
        settings.illustrativeDailyRatePercent,
        settings.illustrativePeriodDays
      ),
      credited: false,
      guaranteed: false
    }
  };
}

export async function listActivity(query: Record<string, unknown>) {
  const { page, pageSize, offset } = pageQuery(query);
  const { rows, count } = await UserActivityEvent.findAndCountAll({
    limit: pageSize,
    offset,
    order: [["timestamp", "DESC"]]
  });
  const audits = await AdminAuditLog.findAll({ order: [["created_at", "DESC"]], limit: pageSize });
  return {
    page,
    pageSize,
    total: count,
    events: rows.map((event) => ({
      id: event.id,
      type: event.type,
      actorId: event.user_id,
      entityId: event.user_id,
      timestamp: event.timestamp,
      metadata: event.metadata,
      outcome: "recorded"
    })),
    adminActions: audits.map((audit) => ({
      id: audit.audit_id,
      type: audit.action,
      actorId: audit.admin_id,
      entityId: audit.entity_id,
      timestamp: audit.created_at,
      metadata: { entityType: audit.entity_type },
      outcome: "recorded",
      reason: audit.reason
    }))
  };
}

export async function adminPerformance() {
  const [snapshots, logs, positions] = await Promise.all([
    DailyPerformanceSnapshot.findAll({ order: [["created_at", "DESC"]], limit: 200 }),
    PerformanceCalculationLog.findAll({ order: [["created_at", "DESC"]], limit: 200 }),
    InvestmentPosition.findAll({ where: { status: "active" }, limit: 200 })
  ]);
  const latest = latestByPositionDate(snapshots);
  const verified = latest.filter((row) => row.verification_status === "verified" && row.profit_loss !== null);
  const totals = sumVerifiedPerformance(verified.map((row) => parseDecimal(String(row.profit_loss), 8)), 0n);
  const byStrategy = new Map<string, bigint>();
  for (const row of verified) {
    const current = byStrategy.get(row.strategy) ?? 0n;
    byStrategy.set(row.strategy, current + parseDecimal(String(row.profit_loss), 8));
  }
  return {
    snapshots,
    logs,
    positions,
    verifiedProfitLoss: totals.profitCents === null ? null : formatDecimal(totals.profitCents, 8),
    missing: logs.filter((row) => row.outcome === "unavailable").length,
    failed: logs.filter((row) => row.outcome === "failed").length,
    byStrategy: [...byStrategy.entries()].map(([strategy, profit]) => ({
      strategy,
      profitLoss: formatDecimal(profit, 8)
    }))
  };
}
