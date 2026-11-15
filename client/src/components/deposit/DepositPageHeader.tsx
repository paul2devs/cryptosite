import { RefreshCw } from "lucide-react";
import {
  Panel,
  ProgressBar,
  SkeletonBlock,
  ErrorRow,
  Metric
} from "../dashboard/primitives";
import { BalanceToggle, useBalanceVisibility } from "../BalanceVisibilityProvider";
import { useAnimatedNumber } from "../../hooks/useAnimatedNumber";
import { formatUsd } from "../../utils/format";
import { maskValue } from "../portfolio/utils";
import type { DepositAccountSummary } from "../../hooks/useDepositData";

export function DepositPageHeader({
  account,
  loading,
  error,
  busy,
  onRefresh
}: {
  account: DepositAccountSummary | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  onRefresh: () => void;
}) {
  const { hidden } = useBalanceVisibility();
  const animatedAvailable = useAnimatedNumber(account?.withdrawableBalance ?? 0);

  const hasLocked = (account?.lockedBalance ?? 0) > 0;

  const currentMin = account?.depositCurrentLevelRequiredTotal ?? 0;
  const nextMax = account?.depositNextLevelRequiredTotal ?? currentMin;
  const total = account?.totalDepositedUsd ?? 0;
  const progressPercent = (() => {
    if (nextMax <= currentMin) {
      return 100;
    }
    const clamped = Math.min(Math.max(total, currentMin), nextMax);
    return Math.round(((clamped - currentMin) / (nextMax - currentMin)) * 100);
  })();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="display-font text-2xl font-semibold tracking-tight text-[#F5F5F7]">
            Deposit
          </h1>
          <p className="max-w-2xl text-sm text-[#9CA3AF]">
            Add funds to your account using one of the supported payment methods.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            aria-label="Refresh deposit information"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#26272B] bg-[#17181A] px-3 py-1.5 text-[11px] font-medium text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      <Panel>
        {error && !account ? (
          <ErrorRow message={error} onRetry={onRefresh} />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                Available balance
              </p>
              {loading && !account ? (
                <SkeletonBlock className="mt-2 h-9 w-44" />
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  <p className="financial-figure text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                    {maskValue(hidden, formatUsd(animatedAvailable))}
                  </p>
                  <BalanceToggle />
                </div>
              )}
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                {hasLocked && account
                  ? `${maskValue(hidden, formatUsd(account.lockedBalance))} locked · available to withdraw`
                  : "Available to withdraw from your ledger balance"}
              </p>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="display-font text-sm font-medium text-[#F5F5F7]">
                  Deposit level {account?.depositLevel ?? 0}
                </span>
                <span className="text-[11px] text-[#9CA3AF]">
                  {account?.depositNextLevel
                    ? `Progress to level ${account.depositNextLevel}`
                    : "Highest level reached"}
                </span>
              </div>
              <ProgressBar value={progressPercent} tone="gold" />
              <div className="grid grid-cols-2 gap-4">
                <Metric
                  label="Total deposited"
                  value={formatUsd(account?.totalDepositedUsd ?? 0)}
                  hint="Confirmed deposits valued in USD"
                  valueClassName="text-sm"
                />
                <Metric
                  label="Remaining to next"
                  value={
                    account?.depositRemainingToNext !== null &&
                    account?.depositRemainingToNext !== undefined &&
                    account.depositNextLevel
                      ? formatUsd(account.depositRemainingToNext)
                      : "Level cap reached"
                  }
                  hint={
                    account?.depositNextLevelRequiredTotal !== null &&
                    account?.depositNextLevelRequiredTotal !== undefined
                      ? `Target ${formatUsd(account.depositNextLevelRequiredTotal)}`
                      : "No further deposit levels"
                  }
                  valueClassName="text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
