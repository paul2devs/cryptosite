import { randomUUID } from "crypto";
import { Op, Transaction, UniqueConstraintError } from "sequelize";
import { sequelize } from "../config/database";
import {
  BALANCE_ADJUSTMENT_LABEL,
  directionForAdjustment,
  isBalanceAdjustmentType,
  normalizeAdjustmentAmount,
  planAdjustment,
  planReversal,
  type BalanceAdjustmentDirection,
  type BalanceAdjustmentType
} from "../domain/balanceAdjustmentRules";
import { formatDecimal, parseDecimal } from "../domain/money";
import { generateReference } from "../domain/transactionRules";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { BalanceAdjustment } from "../models/BalanceAdjustment";
import { Deposit } from "../models/Deposit";
import { EarningsLog } from "../models/EarningsLog";
import { InvestmentPosition } from "../models/InvestmentPosition";
import { MembershipTier } from "../models/MembershipTier";
import { User } from "../models/User";
import { UserMembership } from "../models/UserMembership";
import { Withdrawal } from "../models/Withdrawal";
import { trackUserActivity } from "./activityService";
import { ledgerBalancesForUser, postBalancedEntry } from "./financialOperationsService";
import { syncUserInvestmentLevel } from "./investmentLevelService";
import { syncUserMembership } from "./membershipService";
import { getPerformanceOverview } from "./performanceService";

const AMOUNT_SCALE = 8;
const SOURCE_TYPE = "balance_adjustment";
const DEFAULT_ASSET = "USD";

interface PositionLike {
  position_id: string;
  user_id: string;
  asset: string;
  principal: string;
  current_valuation: string | null;
  status: "active" | "closed";
  verification_status: "unavailable" | "verified";
}

export interface ApplyAdjustmentInput {
  userId: string;
  type: string;
  amount: string;
  direction?: string | null;
  reason: string;
  note?: string | null;
  positionId?: string | null;
  asset?: string | null;
  idempotencyKey?: string | null;
}

function decimal(value: unknown): bigint {
  return parseDecimal(String(value ?? "0"), AMOUNT_SCALE);
}

function amount(value: unknown): string {
  return formatDecimal(decimal(value), AMOUNT_SCALE);
}

function sumPrincipals(positions: PositionLike[]): bigint {
  return positions.reduce((total, position) => total + decimal(position.principal), 0n);
}

// Reads the user's pending earnings figure from the JSONB column, tolerating a null or
// missing shape without ever inventing a value.
function pendingEarningsOf(user: User): bigint {
  const raw = (user.pending_earnings as { total?: unknown } | null | undefined)?.total;
  if (raw === undefined || raw === null) return 0n;
  return decimal(raw);
}

// A single, reusable position mutation so allocation and deallocation keep the
// position's principal and valuation in step with the ledger.
async function movePosition(
  position: PositionLike,
  principalDelta: bigint,
  transaction: Transaction
): Promise<InvestmentPosition> {
  const nextPrincipal = decimal(position.principal) + principalDelta;
  if (nextPrincipal < 0n) {
    throw new Error("The deallocation exceeds this investment position.");
  }
  const instance = await InvestmentPosition.findByPk(position.position_id, { transaction });
  if (!instance) throw new Error("Investment position not found");
  instance.principal = formatDecimal(nextPrincipal, AMOUNT_SCALE);
  if (instance.current_valuation !== null) {
    const nextValuation = decimal(instance.current_valuation) + principalDelta;
    instance.current_valuation = formatDecimal(nextValuation < 0n ? 0n : nextValuation, AMOUNT_SCALE);
  }
  instance.status = nextPrincipal === 0n ? "closed" : "active";
  instance.last_calculated_at = instance.last_calculated_at ?? null;
  await instance.save({ transaction });
  return instance;
}

// Applies an authorised valuation correction to a single position. The position is the
// source of truth for the derived portfolio value, so the correction is written onto the
// component (never the derived total). The position is marked admin-verified because the
// correction is a recorded, auditable valuation, not a silent overwrite.
async function applyValuationCorrection(
  positionId: string,
  valuationDelta: bigint,
  transaction: Transaction
): Promise<InvestmentPosition> {
  const instance = await InvestmentPosition.findByPk(positionId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!instance) throw new Error("The investment position to correct was not found.");
  const base = decimal(instance.current_valuation ?? instance.principal);
  const next = base + valuationDelta;
  if (next < 0n) {
    throw new Error("The correction would make the position valuation negative.");
  }
  instance.current_valuation = formatDecimal(next, AMOUNT_SCALE);
  instance.verification_status = "verified";
  instance.last_calculated_at = new Date();
  await instance.save({ transaction });
  return instance;
}

async function createAllocationPosition(
  userId: string,
  asset: string,
  principalDelta: bigint,
  transaction: Transaction
): Promise<InvestmentPosition> {
  // Admin-allocated principal starts unvalued and carries no deposit, so it is
  // reported at principal until an independent valuation is recorded.
  return InvestmentPosition.create(
    {
      user_id: userId,
      deposit_id: null,
      asset,
      principal: formatDecimal(principalDelta, AMOUNT_SCALE),
      strategy: "custody_hold",
      status: "active",
      verification_status: "unavailable",
      current_valuation: null
    },
    { transaction }
  );
}

function serializeAdjustment(row: BalanceAdjustment) {
  return {
    adjustmentId: row.adjustment_id,
    userId: row.user_id,
    adminId: row.admin_id,
    type: row.type,
    typeLabel: BALANCE_ADJUSTMENT_LABEL[row.type] ?? row.type,
    direction: row.direction,
    amount: String(row.amount),
    asset: row.asset,
    balanceBefore: String(row.balance_before),
    balanceAfter: String(row.balance_after),
    principalBefore: String(row.principal_before),
    principalAfter: String(row.principal_after),
    valuationBefore: row.valuation_before === null ? null : String(row.valuation_before),
    valuationAfter: row.valuation_after === null ? null : String(row.valuation_after),
    earningsBefore: row.earnings_before === null ? null : String(row.earnings_before),
    earningsAfter: row.earnings_after === null ? null : String(row.earnings_after),
    positionId: row.position_id,
    reason: row.reason,
    note: row.note,
    reference: row.reference,
    reversalOf: row.reversal_of,
    reversedBy: row.reversed_by,
    status: row.status,
    createdAt: row.created_at
  };
}

// Full, separated financial picture for one user. Available balance, invested principal,
// current valuation, pending earnings and realised profit are reported independently so
// no single number is presented as if it were another. The total portfolio value is a
// derived figure (wallet + current investment value) and never a stored number.
export async function financialOverviewForUser(userId: string) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error("User not found");

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [
    ledger,
    overview,
    positions,
    deposits,
    withdrawals,
    todayEarningsRaw,
    totalEarningsRaw,
    membership,
    recentAdjustments
  ] = await Promise.all([
    ledgerBalancesForUser(userId),
    getPerformanceOverview(userId, "all"),
    InvestmentPosition.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]] }),
    Deposit.findAll({ where: { user_id: userId } }),
    Withdrawal.findAll({ where: { user_id: userId } }),
    EarningsLog.sum("earned_amount", { where: { user_id: userId, timestamp: { [Op.gte]: startOfDay } } }),
    EarningsLog.sum("earned_amount", { where: { user_id: userId } }),
    UserMembership.findByPk(userId),
    BalanceAdjustment.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]], limit: 10 })
  ]);

  const tier = membership?.tier_id ? await MembershipTier.findByPk(membership.tier_id) : null;

  const approvedDeposits = deposits.filter((row) => row.status === "Approved");
  const completedWithdrawals = withdrawals.filter(
    (row) => row.status === "Approved" || row.detailed_status === "completed"
  );
  const pendingDeposits = deposits.filter((row) => row.status === "Pending");
  const pendingWithdrawals = withdrawals.filter(
    (row) =>
      row.status === "Pending" ||
      row.detailed_status === "requested" ||
      row.detailed_status === "under_review"
  );
  const activePositions = positions.filter((position) => position.status === "active");

  const available = decimal(user.withdrawable_balance);
  const locked = decimal(user.locked_balance);
  const currentInvestmentValue = decimal(overview.overview.currentInvestmentValue);
  const pendingEarnings = pendingEarningsOf(user);
  const totalPortfolioValue = available + locked + currentInvestmentValue;

  return {
    account: {
      userId: user.user_id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin,
      createdAt: user.created_at
    },
    balance: {
      available: amount(user.withdrawable_balance),
      locked: amount(user.locked_balance),
      ledgerAvailable: ledger.totals.available_balance ?? "0.00000000"
    },
    portfolio: {
      totalPortfolioValue: formatDecimal(totalPortfolioValue, AMOUNT_SCALE),
      available: amount(user.withdrawable_balance),
      locked: amount(user.locked_balance),
      currentInvestmentValue: overview.overview.currentInvestmentValue,
      investedPrincipal: overview.overview.investedPrincipal,
      pendingEarnings: formatDecimal(pendingEarnings, AMOUNT_SCALE),
      formula:
        "totalPortfolioValue = available balance + locked balance + current investment value. Pending earnings are reported separately and are not included until settled."
    },
    totals: {
      totalDeposited: amount(
        approvedDeposits.reduce((total, row) => total + decimal(row.amount), 0n)
      ),
      totalWithdrawn: amount(
        completedWithdrawals.reduce((total, row) => total + decimal(row.amount), 0n)
      ),
      pendingDepositCount: pendingDeposits.length,
      pendingDepositAmount: amount(
        pendingDeposits.reduce((total, row) => total + decimal(row.amount), 0n)
      ),
      pendingWithdrawalCount: pendingWithdrawals.length,
      pendingWithdrawalAmount: amount(
        pendingWithdrawals.reduce((total, row) => total + decimal(row.amount), 0n)
      ),
      activeInvestmentCount: activePositions.length
    },
    investment: {
      investedPrincipal: overview.overview.investedPrincipal,
      currentInvestmentValue: overview.overview.currentInvestmentValue,
      valuationComplete: overview.overview.valuationComplete,
      unrealisedProfitLoss: overview.overview.totalUnrealizedProfitLoss,
      totalRealisedProfitLoss: overview.overview.totalRealizedProfitLoss,
      overallReturnPercent: overview.overview.overallReturnPercent
    },
    earnings: {
      pendingEarnings: formatDecimal(pendingEarnings, AMOUNT_SCALE),
      todayEarnings: amount(todayEarningsRaw ?? 0),
      totalInvestmentEarnings: amount(totalEarningsRaw ?? 0),
      todayProfitLoss: overview.overview.todayProfitLoss,
      todayRoiPercent: overview.overview.todayRoiPercent,
      todayStatus: overview.overview.todayStatus,
      totalRealisedProfitLoss: overview.overview.totalRealizedProfitLoss,
      totalUnrealisedProfitLoss: overview.overview.totalUnrealizedProfitLoss,
      overallReturnPercent: overview.overview.overallReturnPercent,
      note:
        "Pending earnings are accrued but unsettled. They are never credited to the available wallet balance until the settlement workflow authorises a payout."
    },
    membership: membership
      ? {
          tierId: membership.tier_id,
          tierName: tier?.name ?? null,
          qualifyingAmount: String(membership.qualifying_amount),
          source: membership.manual_tier_id ? "admin" : "automatic",
          manualReason: membership.manual_reason,
          achievedAt: membership.achieved_at
        }
      : {
          tierId: null,
          tierName: null,
          qualifyingAmount: "0.00",
          source: "unqualified",
          manualReason: null,
          achievedAt: null
        },
    positions: positions.map((position) => ({
      positionId: position.position_id,
      asset: position.asset,
      principal: String(position.principal),
      currentValuation: position.current_valuation === null ? null : String(position.current_valuation),
      verificationStatus: position.verification_status,
      status: position.status,
      strategy: position.strategy,
      depositId: position.deposit_id,
      createdAt: position.created_at
    })),
    recentAdjustments: recentAdjustments.map((row) => serializeAdjustment(row)),
    ledgerTotals: ledger.totals
  };
}

// Recalculates the derived membership and investment level after a committed adjustment.
// A failure here never fails the adjustment itself (which is already stored and audited);
// it is logged so the next recalculation pass can repair the derived state.
async function syncDerivedState(userId: string, type: BalanceAdjustmentType): Promise<void> {
  try {
    if (type === "investment_allocation" || type === "investment_deallocation") {
      await syncUserInvestmentLevel(userId, "Administrator adjusted invested principal");
    }
    await syncUserMembership(userId, "Administrator adjustment recalculated membership qualification");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[admin-balance] post-adjustment recalculation failed for user ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function findExistingAdjustment(idempotencyKey: string): Promise<BalanceAdjustment | null> {
  return BalanceAdjustment.findOne({ where: { idempotency_key: idempotencyKey } });
}

// Applies one administrator balance, principal, valuation or earnings adjustment atomically.
// The user row is locked for the whole write so two concurrent adjustments can never read
// the same starting balance, and the idempotency key makes a double submit a no-op.
export async function applyAdjustment(adminId: string, input: ApplyAdjustmentInput) {
  if (!isBalanceAdjustmentType(input.type) || input.type === "reversal") {
    throw new Error("Unsupported adjustment type.");
  }
  const type = input.type as BalanceAdjustmentType;
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 3) {
    throw new Error("A reason of at least 3 characters is required.");
  }
  const asset = String(input.asset ?? "").trim() || DEFAULT_ASSET;
  const normalizedAmount = normalizeAdjustmentAmount(input.amount);
  const amountUnits = parseDecimal(normalizedAmount, AMOUNT_SCALE);
  const direction: BalanceAdjustmentDirection = directionForAdjustment(type, input.direction ?? null);
  const idempotencyKey = String(input.idempotencyKey ?? "").trim() || null;
  const adjustmentId = randomUUID();

  let record: BalanceAdjustment;
  try {
    record = await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(input.userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user) throw new Error("User not found");

      if (idempotencyKey) {
        const existing = await BalanceAdjustment.findOne({
          where: { idempotency_key: idempotencyKey },
          transaction
        });
        if (existing) return existing;
      }

      const balanceBefore = decimal(user.withdrawable_balance);
      const positions = await InvestmentPosition.findAll({
        where: { user_id: user.user_id, status: "active" },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const principalBefore = sumPrincipals(positions);
      const earningsBefore = pendingEarningsOf(user);

      const plan = planAdjustment({ type, direction, amountUnits });
      const balanceAfter = balanceBefore + plan.availableDelta;
      if (balanceAfter < 0n) {
        throw new Error("Insufficient available balance for this adjustment.");
      }

      // Resolve the target position for any adjustment that changes principal or valuation.
      let target: PositionLike | null = null;
      if (plan.principalDelta > 0n || plan.valuationDelta !== 0n) {
        if (input.positionId) {
          target = positions.find((position) => position.position_id === input.positionId) ?? null;
          if (!target) {
            throw new Error("The selected investment position was not found for this user.");
          }
        } else if (plan.valuationDelta !== 0n) {
          throw new Error("Select which investment position to correct.");
        }
      }
      if (plan.principalDelta < 0n) {
        const candidates = input.positionId
          ? positions.filter((position) => position.position_id === input.positionId)
          : positions;
        if (candidates.length === 0) {
          throw new Error("The user has no eligible active investment to deallocate from.");
        }
        if (!input.positionId && candidates.length > 1) {
          throw new Error("Select which investment position to deallocate from.");
        }
        target = candidates[0];
      }

      const principalAfter = principalBefore + plan.principalDelta;
      if (principalAfter < 0n) {
        throw new Error("The deallocation exceeds the invested principal.");
      }

      let valuationBefore: bigint | null = null;
      let valuationAfter: bigint | null = null;
      if (plan.valuationDelta !== 0n && target) {
        valuationBefore = decimal(target.current_valuation ?? target.principal);
        valuationAfter = valuationBefore + plan.valuationDelta;
        if (valuationAfter < 0n) {
          throw new Error("The correction would make the position valuation negative.");
        }
      }

      let earningsAfter: bigint | null = null;
      if (type === "pending_earnings") {
        earningsAfter = earningsBefore + (direction === "debit" ? -amountUnits : amountUnits);
        if (earningsAfter < 0n) {
          throw new Error("The correction would make pending earnings negative.");
        }
      }

      if (plan.ledger) {
        await postBalancedEntry({
          userId: user.user_id,
          asset,
          amount: normalizedAmount,
          transactionType: plan.ledger.transactionType,
          sourceType: SOURCE_TYPE,
          sourceId: adjustmentId,
          debit: plan.ledger.debit,
          credit: plan.ledger.credit,
          transaction
        });
      }

      if (plan.availableDelta !== 0n) {
        user.withdrawable_balance = Number(formatDecimal(balanceAfter, AMOUNT_SCALE));
      }
      if (type === "pending_earnings" && earningsAfter !== null) {
        user.pending_earnings = { total: Number(formatDecimal(earningsAfter, AMOUNT_SCALE)) };
      }
      if (plan.availableDelta !== 0n || type === "pending_earnings") {
        await user.save({ transaction });
      }

      let positionId: string | null = null;
      if (plan.principalDelta !== 0n) {
        const position = target
          ? await movePosition(target, plan.principalDelta, transaction)
          : await createAllocationPosition(user.user_id, asset, plan.principalDelta, transaction);
        positionId = position.position_id;
      } else if (plan.valuationDelta !== 0n && target) {
        const position = await applyValuationCorrection(target.position_id, plan.valuationDelta, transaction);
        positionId = position.position_id;
      }

      const created = await BalanceAdjustment.create(
        {
          adjustment_id: adjustmentId,
          user_id: user.user_id,
          admin_id: adminId,
          type,
          direction,
          amount: normalizedAmount,
          asset,
          balance_before: formatDecimal(balanceBefore, AMOUNT_SCALE),
          balance_after: formatDecimal(balanceAfter, AMOUNT_SCALE),
          principal_before: formatDecimal(principalBefore, AMOUNT_SCALE),
          principal_after: formatDecimal(principalAfter, AMOUNT_SCALE),
          valuation_before: valuationBefore === null ? null : formatDecimal(valuationBefore, AMOUNT_SCALE),
          valuation_after: valuationAfter === null ? null : formatDecimal(valuationAfter, AMOUNT_SCALE),
          earnings_before: type === "pending_earnings" ? formatDecimal(earningsBefore, AMOUNT_SCALE) : null,
          earnings_after: earningsAfter === null ? null : formatDecimal(earningsAfter, AMOUNT_SCALE),
          position_id: positionId,
          reason,
          note: String(input.note ?? "").trim() || null,
          reference: generateReference(SOURCE_TYPE, adjustmentId),
          idempotency_key: idempotencyKey,
          reversal_of: null,
          reversed_by: null,
          status: "applied"
        },
        { transaction }
      );

      await AdminAuditLog.create(
        {
          admin_id: adminId,
          action: `balance_${type}`,
          entity_type: "balance_adjustment",
          entity_id: created.adjustment_id,
          reason,
          metadata: {
            userId: user.user_id,
            type,
            direction,
            amount: normalizedAmount,
            asset,
            reference: created.reference,
            positionId,
            balanceBefore: formatDecimal(balanceBefore, AMOUNT_SCALE),
            balanceAfter: formatDecimal(balanceAfter, AMOUNT_SCALE),
            valuationBefore: valuationBefore === null ? null : formatDecimal(valuationBefore, AMOUNT_SCALE),
            valuationAfter: valuationAfter === null ? null : formatDecimal(valuationAfter, AMOUNT_SCALE),
            earningsBefore: type === "pending_earnings" ? formatDecimal(earningsBefore, AMOUNT_SCALE) : null,
            earningsAfter: earningsAfter === null ? null : formatDecimal(earningsAfter, AMOUNT_SCALE)
          }
        },
        { transaction }
      );

      return created;
    });
  } catch (error) {
    if (idempotencyKey && error instanceof UniqueConstraintError) {
      const existing = await findExistingAdjustment(idempotencyKey);
      if (existing) return { adjustment: serializeAdjustment(existing), overview: await financialOverviewForUser(existing.user_id) };
    }
    throw error;
  }

  await trackUserActivity(record.user_id, "admin_action", {
    adjustmentId: record.adjustment_id,
    type: record.type,
    amount: String(record.amount),
    reference: record.reference
  });
  await syncDerivedState(record.user_id, record.type);

  return {
    adjustment: serializeAdjustment(record),
    overview: await financialOverviewForUser(record.user_id)
  };
}

// Reverses a prior adjustment with a brand new, linked ledger entry. The original
// row is never deleted or rewritten; it is marked reversed and points at its reversal.
export async function reverseAdjustment(
  adminId: string,
  adjustmentId: string,
  reason: string,
  note?: string | null
) {
  const trimmed = String(reason ?? "").trim();
  if (trimmed.length < 3) {
    throw new Error("A reason of at least 3 characters is required.");
  }
  const reversalId = randomUUID();

  const record = await sequelize.transaction(async (transaction) => {
    const original = await BalanceAdjustment.findByPk(adjustmentId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!original) throw new Error("Adjustment not found.");
    if (original.type === "reversal") throw new Error("A reversal cannot be reversed.");
    if (original.reversed_by) throw new Error("This adjustment has already been reversed.");

    const user = await User.findByPk(original.user_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user) throw new Error("User not found");

    const balanceBefore = decimal(user.withdrawable_balance);
    const positions = await InvestmentPosition.findAll({
      where: { user_id: user.user_id, status: "active" },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    const principalBefore = sumPrincipals(positions);
    const earningsBefore = pendingEarningsOf(user);
    const amountUnits = decimal(original.amount);

    const plan = planReversal({
      type: original.type,
      direction: original.direction as BalanceAdjustmentDirection,
      amountUnits
    });

    const balanceAfter = balanceBefore + plan.availableDelta;
    if (balanceAfter < 0n) {
      throw new Error("Reversing this adjustment would overdraw the available balance.");
    }

    let target: PositionLike | null = null;
    if (plan.principalDelta !== 0n) {
      const reference = original.position_id
        ? positions.filter((position) => position.position_id === original.position_id)
        : positions;
      if (plan.principalDelta < 0n) {
        if (reference.length === 0) {
          throw new Error("The original investment position is no longer available to reverse.");
        }
        target = reference[0];
      } else {
        target = reference[0] ?? null;
      }
    }

    const principalAfter = principalBefore + plan.principalDelta;
    if (principalAfter < 0n) {
      throw new Error("Reversing this adjustment would exceed the invested principal.");
    }

    // Valuation reversals restore the position's valuation from the recorded delta.
    let valuationBefore: bigint | null = null;
    let valuationAfter: bigint | null = null;
    if (plan.valuationDelta !== 0n) {
      if (!original.position_id) throw new Error("The corrected investment position is no longer available.");
      const position = await InvestmentPosition.findByPk(original.position_id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!position) throw new Error("The corrected investment position is no longer available.");
      valuationBefore = decimal(position.current_valuation ?? position.principal);
      valuationAfter = valuationBefore + plan.valuationDelta;
      if (valuationAfter < 0n) {
        throw new Error("Reversing this adjustment would make the position valuation negative.");
      }
    }

    // Pending-earnings reversals restore the recorded before/after earnings figure.
    let earningsAfter: bigint | null = null;
    if (original.type === "pending_earnings" && original.earnings_before !== null && original.earnings_after !== null) {
      const delta = decimal(original.earnings_after) - decimal(original.earnings_before);
      earningsAfter = earningsBefore - delta;
      if (earningsAfter < 0n) {
        throw new Error("Reversing this adjustment would make pending earnings negative.");
      }
    }

    if (plan.ledger) {
      await postBalancedEntry({
        userId: user.user_id,
        asset: original.asset,
        amount: formatDecimal(amountUnits, AMOUNT_SCALE),
        transactionType: plan.ledger.transactionType,
        sourceType: SOURCE_TYPE,
        sourceId: reversalId,
        debit: plan.ledger.debit,
        credit: plan.ledger.credit,
        transaction
      });
    }

    if (plan.availableDelta !== 0n) {
      user.withdrawable_balance = Number(formatDecimal(balanceAfter, AMOUNT_SCALE));
    }
    if (earningsAfter !== null) {
      user.pending_earnings = { total: Number(formatDecimal(earningsAfter, AMOUNT_SCALE)) };
    }
    if (plan.availableDelta !== 0n || earningsAfter !== null) {
      await user.save({ transaction });
    }

    let positionId: string | null = original.position_id;
    if (plan.principalDelta !== 0n) {
      const position = target
        ? await movePosition(target, plan.principalDelta, transaction)
        : await createAllocationPosition(user.user_id, original.asset, plan.principalDelta, transaction);
      positionId = position.position_id;
    } else if (plan.valuationDelta !== 0n && original.position_id) {
      const position = await applyValuationCorrection(original.position_id, plan.valuationDelta, transaction);
      positionId = position.position_id;
    }

    const created = await BalanceAdjustment.create(
      {
        adjustment_id: reversalId,
        user_id: original.user_id,
        admin_id: adminId,
        type: "reversal",
        direction: plan.availableDelta > 0n ? "credit" : "debit",
        amount: formatDecimal(amountUnits, AMOUNT_SCALE),
        asset: original.asset,
        balance_before: formatDecimal(balanceBefore, AMOUNT_SCALE),
        balance_after: formatDecimal(balanceAfter, AMOUNT_SCALE),
        principal_before: formatDecimal(principalBefore, AMOUNT_SCALE),
        principal_after: formatDecimal(principalAfter, AMOUNT_SCALE),
        valuation_before: valuationBefore === null ? null : formatDecimal(valuationBefore, AMOUNT_SCALE),
        valuation_after: valuationAfter === null ? null : formatDecimal(valuationAfter, AMOUNT_SCALE),
        earnings_before: original.type === "pending_earnings" ? formatDecimal(earningsBefore, AMOUNT_SCALE) : null,
        earnings_after: earningsAfter === null ? null : formatDecimal(earningsAfter, AMOUNT_SCALE),
        position_id: positionId,
        reason: trimmed,
        note: String(note ?? "").trim() || null,
        reference: generateReference(SOURCE_TYPE, reversalId),
        idempotency_key: null,
        reversal_of: original.adjustment_id,
        reversed_by: null,
        status: "applied"
      },
      { transaction }
    );

    original.reversed_by = created.adjustment_id;
    original.status = "reversed";
    await original.save({ transaction });

    await AdminAuditLog.create(
      {
        admin_id: adminId,
        action: "balance_reversal",
        entity_type: "balance_adjustment",
        entity_id: created.adjustment_id,
        reason: trimmed,
        metadata: {
          userId: original.user_id,
          reversalOf: original.adjustment_id,
          originalType: original.type,
          amount: String(original.amount),
          reference: created.reference,
          balanceBefore: formatDecimal(balanceBefore, AMOUNT_SCALE),
          balanceAfter: formatDecimal(balanceAfter, AMOUNT_SCALE)
        }
      },
      { transaction }
    );

    return created;
  });

  await trackUserActivity(record.user_id, "admin_action", {
    adjustmentId: record.adjustment_id,
    type: record.type,
    reversalOf: record.reversal_of,
    reference: record.reference
  });
  await syncDerivedState(record.user_id, "reversal");

  return {
    adjustment: serializeAdjustment(record),
    overview: await financialOverviewForUser(record.user_id)
  };
}

export async function listAdjustments(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 20)));
  const where: Record<string | symbol, unknown> = {};
  if (query.userId) where.user_id = String(query.userId);
  if (query.adminId) where.admin_id = String(query.adminId);
  if (query.type) where.type = String(query.type);
  if (query.status) where.status = String(query.status);
  if (query.reference) where.reference = String(query.reference);
  if (query.from || query.to) {
    where.created_at = {
      ...(query.from ? { [Op.gte]: new Date(String(query.from)) } : {}),
      ...(query.to ? { [Op.lte]: new Date(String(query.to)) } : {})
    };
  }

  const { rows, count } = await BalanceAdjustment.findAndCountAll({
    where,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [["created_at", "DESC"]]
  });

  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.user_id);
    ids.add(row.admin_id);
  }
  const actors =
    ids.size > 0
      ? await User.findAll({
          where: { user_id: { [Op.in]: [...ids] } },
          attributes: ["user_id", "name", "email"]
        })
      : [];
  const byId = new Map(actors.map((actor) => [actor.user_id, actor]));

  return {
    page,
    pageSize,
    total: count,
    adjustments: rows.map((row) => {
      const subject = byId.get(row.user_id);
      const admin = byId.get(row.admin_id);
      return {
        ...serializeAdjustment(row),
        userEmail: subject?.email ?? null,
        userName: subject?.name ?? null,
        adminEmail: admin?.email ?? null,
        adminName: admin?.name ?? null
      };
    })
  };
}
