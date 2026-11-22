import { formatDecimal, parseDecimal } from "./money";

/**
 * The single authoritative account-balance breakdown.
 *
 * Every surface (dashboard, portfolio, performance, wallet and the withdrawal
 * page) must read these figures from one calculation so the same money can never
 * be counted as pending, settled and withdrawable at the same time. The rule is
 * pure: it takes the already-authoritative inputs and separates them into the
 * categories the withdrawal page is required to distinguish.
 *
 * Inputs and their meaning:
 *  - `walletBalance`        cash that has been credited and settled. It is the
 *                           account's `withdrawable_balance`, which is already
 *                           net of every in-flight withdrawal request.
 *  - `lockedBalance`        funds held under an actual lockup/restriction.
 *  - `investedPrincipal`    principal currently allocated to active positions.
 *  - `accruedEarnings`      total gain accrued onto positions, whether or not it
 *                           has been distributed yet.
 *  - `settledEarnings`      earnings already distributed (credited to the wallet).
 *  - `underMaturity`        portion of the wallet still inside a maturity window.
 *  - `pendingWithdrawals`   requests submitted but not yet completed. These are
 *                           informational: the amount was already deducted from
 *                           `walletBalance` when the request was reserved.
 */
export const ACCOUNT_BALANCE_SCALE = 8;
const SCALE = ACCOUNT_BALANCE_SCALE;

function units(value: string | null | undefined): bigint {
  return parseDecimal(String(value ?? "0"), SCALE);
}

function fmt(value: bigint): string {
  return formatDecimal(value, SCALE);
}

function nonNegative(value: bigint): bigint {
  return value > 0n ? value : 0n;
}

export interface AccountBalanceInput {
  walletBalance: string;
  lockedBalance: string;
  investedPrincipal: string;
  accruedEarnings: string;
  settledEarnings: string;
  underMaturity: string;
  pendingWithdrawals: string;
}

export interface AccountBalanceBreakdown {
  /** Credited, settled funds eligible to be requested right now. */
  availableToWithdraw: string;
  /** Principal allocated to active investments. */
  invested: string;
  /** Requests submitted but not yet completed (already removed from the wallet). */
  pendingWithdrawals: string;
  /** Wallet portion still inside a maturity/lockup window. */
  underMaturity: string;
  /** Funds under an actual lockup/restriction. */
  locked: string;
  /** Accrued but not yet distributed earnings. */
  pendingEarnings: string;
  /** Earnings already distributed and credited to the wallet. */
  settledEarnings: string;
  /** Total account value across wallet, investments and unsettled earnings. */
  totalAccountBalance: string;
}

export function computeAccountBalance(input: AccountBalanceInput): AccountBalanceBreakdown {
  const wallet = units(input.walletBalance);
  const locked = units(input.lockedBalance);
  const invested = units(input.investedPrincipal);
  const accrued = units(input.accruedEarnings);
  const settled = units(input.settledEarnings);

  // Recording a distribution credits `available_balance` (raising the wallet)
  // while the position valuation -- and therefore `accruedEarnings` -- stays
  // unchanged. The earnings that are genuinely still pending are the part of the
  // accrual that has not been distributed; adding the full accrual on top of the
  // wallet would count the settled part twice.
  const pendingEarnings = nonNegative(accrued - settled);

  // A pending withdrawal is deducted from the wallet the moment it is reserved,
  // so `walletBalance` is already net of in-flight requests and must not be
  // reduced a second time here.
  const underMaturity = nonNegative(units(input.underMaturity));
  const maturedCap = underMaturity > wallet ? wallet : underMaturity;
  const availableToWithdraw = nonNegative(wallet - maturedCap);

  return {
    availableToWithdraw: fmt(availableToWithdraw),
    invested: fmt(invested),
    pendingWithdrawals: fmt(nonNegative(units(input.pendingWithdrawals))),
    underMaturity: fmt(maturedCap),
    locked: fmt(locked),
    pendingEarnings: fmt(pendingEarnings),
    settledEarnings: fmt(settled),
    // `underMaturity` is a subset of the wallet, so it is never added again.
    totalAccountBalance: fmt(wallet + locked + invested + pendingEarnings)
  };
}
