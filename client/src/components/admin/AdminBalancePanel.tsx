import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { api } from "../../utils/api";
import {
  EmptyState,
  ErrorRow,
  LoadingRow,
  Panel,
  Stat,
  StatStrip,
  StatusBadge
} from "../dashboard/primitives";
import { formatDateTime } from "../../utils/format";
import {
  BALANCE_ADJUSTMENT_LABEL,
  REQUESTABLE_ADJUSTMENT_TYPES,
  adjustmentTone,
  applyBalanceAdjustment,
  fetchBalanceAdjustments,
  fetchBalanceOverview,
  reverseBalanceAdjustment,
  type BalanceAdjustmentDirection,
  type BalanceAdjustmentPage,
  type BalanceAdjustmentRecord,
  type BalanceAdjustmentType,
  type BalanceOverview
} from "../../utils/balance";

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

const inputClass =
  "w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none placeholder:text-[#6B7280] focus:border-[#C6A15B]/60";

const SCALE = 8n;
const BASE = 10n ** SCALE;

// Precise 8 decimal string math for the before/after preview. The server is the
// authority, but the admin must review the exact numbers they are about to apply.
function toUnits(value: string | number | null | undefined): bigint {
  const trimmed = String(value ?? "0").trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return 0n;
  const negative = trimmed.startsWith("-");
  const [whole, fraction = ""] = (negative ? trimmed.slice(1) : trimmed).split(".");
  const padded = `${fraction}${"0".repeat(8)}`.slice(0, 8);
  const units = BigInt(whole || "0") * BASE + BigInt(padded || "0");
  return negative ? -units : units;
}

function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / BASE;
  const fraction = (absolute % BASE).toString().padStart(8, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function displayMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const units = toUnits(value);
  const formatted = fromUnits(units);
  const [whole, fraction = ""] = formatted.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const trimmedFraction = fraction.replace(/0+$/, "").padEnd(2, "0");
  return `${grouped}.${trimmedFraction}`;
}

interface AdjustmentEffect {
  availableDelta: bigint;
  principalDelta: bigint;
}

function previewEffect(type: BalanceAdjustmentType, direction: BalanceAdjustmentDirection, amountUnits: bigint): AdjustmentEffect {
  switch (type) {
    case "credit":
      return { availableDelta: amountUnits, principalDelta: 0n };
    case "debit":
      return { availableDelta: -amountUnits, principalDelta: 0n };
    case "correction":
      return direction === "debit"
        ? { availableDelta: -amountUnits, principalDelta: 0n }
        : { availableDelta: amountUnits, principalDelta: 0n };
    case "investment_allocation":
      return { availableDelta: -amountUnits, principalDelta: amountUnits };
    case "investment_deallocation":
      return { availableDelta: amountUnits, principalDelta: -amountUnits };
    default:
      return { availableDelta: 0n, principalDelta: 0n };
  }
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `adj-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface UserOption {
  userId: string;
  email: string;
  accountStatus?: string;
}

export function AdminBalancePanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [overview, setOverview] = useState<BalanceOverview | null>(null);
  const [type, setType] = useState<BalanceAdjustmentType>("credit");
  const [direction, setDirection] = useState<BalanceAdjustmentDirection>("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [positionId, setPositionId] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState<BalanceAdjustmentPage | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [filterType, setFilterType] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadHistory = useCallback(
    async (page: number, userId: string) => {
      try {
        setHistory(
          await fetchBalanceAdjustments({
            page,
            pageSize: 20,
            userId: userId || undefined,
            type: filterType || undefined,
            from: filterFrom || undefined,
            to: filterTo || undefined
          })
        );
      } catch (requestError) {
        setError(extractMessage(requestError, "Failed to load adjustment history"));
      }
    },
    [filterType, filterFrom, filterTo]
  );

  useEffect(() => {
    void loadHistory(historyPage, selectedUserId);
  }, [historyPage, selectedUserId, loadHistory]);

  const search = async (event?: FormEvent) => {
    event?.preventDefault();
    if (query.trim().length < 2) {
      setError("Enter at least 2 characters to search for a user.");
      return;
    }
    setBusy("search");
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("q", query.trim());
      params.set("page", "1");
      const response = await api.get<{ users: UserOption[] }>(
        `/operations/admin/users?${params.toString()}`
      );
      setResults(response.data.users ?? []);
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to search users"));
    } finally {
      setBusy(null);
    }
  };

  const openUser = async (userId: string) => {
    setBusy("overview");
    setError(null);
    setNotice(null);
    setConfirming(false);
    setPendingKey(null);
    try {
      const data = await fetchBalanceOverview(userId);
      setSelectedUserId(userId);
      setOverview(data);
      setPositionId(data.positions.length === 1 ? data.positions[0].positionId : "");
      setHistoryPage(1);
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to load the user's financial overview"));
    } finally {
      setBusy(null);
    }
  };

  const amountUnits = useMemo(() => {
    const trimmed = amount.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return 0n;
    if (trimmed.split(".")[1] && trimmed.split(".")[1].length > 8) return -1n;
    return toUnits(trimmed);
  }, [amount]);

  const effect = useMemo(
    () => previewEffect(type, direction, amountUnits > 0n ? amountUnits : 0n),
    [type, direction, amountUnits]
  );

  const availableBefore = toUnits(overview?.balance.available ?? "0");
  const principalBefore = toUnits(overview?.investment.investedPrincipal ?? "0");
  const availableAfter = availableBefore + effect.availableDelta;
  const principalAfter = principalBefore + effect.principalDelta;
  const needsPosition = type === "investment_deallocation";
  const insufficient = availableAfter < 0n;

  const problem = (() => {
    if (amountUnits === -1n) return "Amounts support up to 8 decimal places.";
    if (amountUnits <= 0n) return "Enter an amount greater than zero.";
    if (reason.trim().length < 3) return "Enter a reason of at least 3 characters.";
    if (needsPosition && (overview?.positions.length ?? 0) === 0) {
      return "This user has no active investment to deallocate from.";
    }
    if (needsPosition && !positionId && (overview?.positions.length ?? 0) > 1) {
      return "Select which investment position to deallocate from.";
    }
    if (principalAfter < 0n) return "The deallocation exceeds the user's invested principal.";
    if (insufficient) return "Insufficient available balance for this adjustment.";
    return null;
  })();

  const beginReview = () => {
    setNotice(null);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPendingKey(newIdempotencyKey());
    setConfirming(true);
    // Auto-select the single position so the confirmation matches what will be applied.
  };

  const submit = async () => {
    if (!overview || !pendingKey) return;
    if (problem) {
      setError(problem);
      return;
    }
    setBusy("apply");
    setError(null);
    try {
      const result = await applyBalanceAdjustment({
        userId: overview.account.userId,
        type,
        amount: amount.trim(),
        direction: type === "correction" ? direction : null,
        reason: reason.trim(),
        note: note.trim() || null,
        positionId: positionId || null,
        idempotencyKey: pendingKey
      });
      setOverview(result.overview);
      setNotice(
        `${BALANCE_ADJUSTMENT_LABEL[type]} of ${displayMoney(result.adjustment.amount)} applied. Reference ${result.adjustment.reference}.`
      );
      setAmount("");
      setReason("");
      setNote("");
      setConfirming(false);
      setPendingKey(null);
      await loadHistory(1, result.adjustment.userId);
      setHistoryPage(1);
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to apply the adjustment"));
    } finally {
      setBusy(null);
    }
  };

  const reverse = async (row: BalanceAdjustmentRecord) => {
    const entered = window.prompt(
      `Reverse ${row.typeLabel} of ${displayMoney(row.amount)} (${row.reference})?\n\nEnter a reason for the reversal.`
    );
    if (entered === null) return;
    if (entered.trim().length < 3) {
      setError("A reason of at least 3 characters is required to reverse an adjustment.");
      return;
    }
    const internalNote = window.prompt("Optional internal note (leave blank to skip).") ?? "";
    setBusy(row.adjustmentId);
    setError(null);
    try {
      const result = await reverseBalanceAdjustment(row.adjustmentId, entered.trim(), internalNote.trim() || null);
      if (result.adjustment.userId === selectedUserId) {
        setOverview(result.overview);
      }
      setNotice(`Reversal recorded. Reference ${result.adjustment.reference}.`);
      await loadHistory(historyPage, selectedUserId);
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to reverse the adjustment"));
    } finally {
      setBusy(null);
    }
  };

  const totalPages = history ? Math.max(1, Math.ceil(history.total / history.pageSize)) : 1;

  return (
    <div className="space-y-4">
      {error ? <ErrorRow message={error} onRetry={() => void loadHistory(historyPage, selectedUserId)} /> : null}
      {notice ? <p className="text-[11px] text-[#16C784]">{notice}</p> : null}

      <Panel>
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
          <p className="text-xs font-medium text-[#F5F5F7]">Find a user</p>
        </div>
        <form onSubmit={search} className="mt-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, or user id"
            className={`${inputClass} sm:w-72`}
          />
          <button type="submit" disabled={busy !== null} className="btn btn-sm btn-secondary">
            {busy === "search" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            Search
          </button>
        </form>
        {results.length > 0 ? (
          <ul className="mt-3 divide-y divide-[#26272B]/60">
            {results.map((user) => (
              <li key={user.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-[#F5F5F7]">{user.email}</p>
                  <p className="font-mono text-[10px] text-[#6B7280]">{user.userId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void openUser(user.userId)}
                  disabled={busy !== null}
                  className="btn btn-sm btn-ghost"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      {busy === "overview" ? <LoadingRow label="Loading financial overview..." /> : null}

      {overview ? (
        <>
          <Panel className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#F5F5F7]">
                  {overview.account.name || overview.account.email}
                </p>
                <p className="truncate text-[11px] text-[#9CA3AF]">
                  {overview.account.email} · <span className="font-mono">{overview.account.userId}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openUser(overview.account.userId)}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-[11px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-50"
              >
                {busy === "overview" ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                )}
                Refresh
              </button>
            </div>
            <StatStrip>
              <Stat label="Available balance" value={displayMoney(overview.balance.available)} tone="positive" />
              <Stat label="Invested principal" value={displayMoney(overview.investment.investedPrincipal)} />
              <Stat label="Current investment value" value={displayMoney(overview.investment.currentInvestmentValue)} tone="gold" />
              <Stat
                label="Unrealised P/L"
                value={overview.investment.unrealisedProfitLoss === null ? "Unavailable" : displayMoney(overview.investment.unrealisedProfitLoss)}
                tone={overview.investment.unrealisedProfitLoss?.startsWith("-") ? "negative" : "neutral"}
              />
              <Stat
                label="Total realised P/L"
                value={displayMoney(overview.investment.totalRealisedProfitLoss)}
                tone={overview.investment.totalRealisedProfitLoss.startsWith("-") ? "negative" : "positive"}
              />
            </StatStrip>
            <StatStrip>
              <Stat label="Total deposited" value={displayMoney(overview.totals.totalDeposited)} />
              <Stat label="Total withdrawn" value={displayMoney(overview.totals.totalWithdrawn)} />
              <Stat label="Locked" value={displayMoney(overview.balance.locked)} />
              <Stat label="Pending deposits" value={`${overview.totals.pendingDepositCount} · ${displayMoney(overview.totals.pendingDepositAmount)}`} tone="gold" />
              <Stat label="Pending withdrawals" value={`${overview.totals.pendingWithdrawalCount} · ${displayMoney(overview.totals.pendingWithdrawalAmount)}`} tone="gold" />
              <Stat label="Active investments" value={String(overview.totals.activeInvestmentCount)} />
            </StatStrip>
            {!overview.investment.valuationComplete ? (
              <p className="text-[10px] text-[#6B7280]">
                Some positions are not yet independently valued and are shown at principal.
              </p>
            ) : null}
          </Panel>

          {overview.positions.length > 0 ? (
            <Panel className="space-y-2">
              <p className="text-xs font-medium text-[#F5F5F7]">Active investment positions</p>
              <div className="space-y-0.5">
                {overview.positions.map((position) => (
                  <div key={position.positionId} className="list-row flex-wrap justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-[#F5F5F7]">
                        {position.asset} · {position.strategy}
                      </p>
                      <p className="font-mono text-[10px] text-[#6B7280]">{position.positionId}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="financial-figure text-xs text-[#F5F5F7]">
                        principal {displayMoney(position.principal)}
                      </p>
                      <p className="text-[10px] text-[#6B7280]">
                        {position.currentValuation === null
                          ? "valuation unavailable"
                          : `valuation ${displayMoney(position.currentValuation)}`}{" "}
                        · {position.verificationStatus}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
              <p className="text-xs font-medium text-[#F5F5F7]">Apply a balance adjustment</p>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
              Every adjustment posts a balanced double-entry ledger record and updates the user's
              available balance or invested principal. Available balance, invested principal,
              investment valuation, and realised profit are always kept separate.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <select
                value={type}
                onChange={(event) => {
                  const next = event.target.value as BalanceAdjustmentType;
                  setType(next);
                  setConfirming(false);
                  setPendingKey(null);
                }}
                className={inputClass}
              >
                {REQUESTABLE_ADJUSTMENT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {BALANCE_ADJUSTMENT_LABEL[option]}
                  </option>
                ))}
              </select>
              {type === "correction" ? (
                <select
                  value={direction}
                  onChange={(event) => {
                    setDirection(event.target.value as BalanceAdjustmentDirection);
                    setConfirming(false);
                  }}
                  className={inputClass}
                >
                  <option value="credit">Increase available balance</option>
                  <option value="debit">Decrease available balance</option>
                </select>
              ) : null}
              <input
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setConfirming(false);
                }}
                inputMode="decimal"
                placeholder="Amount (USD, up to 8 decimals)"
                className={inputClass}
              />
              {type === "investment_allocation" ? (
                <select
                  value={positionId}
                  onChange={(event) => {
                    setPositionId(event.target.value);
                    setConfirming(false);
                  }}
                  className={inputClass}
                >
                  <option value="">New investment position</option>
                  {overview.positions.map((position) => (
                    <option key={position.positionId} value={position.positionId}>
                      Existing {position.asset} · {position.positionId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              ) : null}
              {needsPosition ? (
                <select
                  value={positionId}
                  onChange={(event) => {
                    setPositionId(event.target.value);
                    setConfirming(false);
                  }}
                  className={inputClass}
                >
                  {overview.positions.length > 1 ? <option value="">Select position</option> : null}
                  {overview.positions.map((position) => (
                    <option key={position.positionId} value={position.positionId}>
                      {position.asset} · {displayMoney(position.principal)} · {position.positionId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setConfirming(false);
                }}
                placeholder="Reason (required)"
                className={`${inputClass} lg:col-span-2`}
              />
            </div>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Internal note (optional, platform only)"
              className={`${inputClass} mt-2`}
            />

            <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-2 text-[11px]">
              <p className="text-[#9CA3AF]">
                Available{" "}
                <span className="financial-figure text-[#F5F5F7]">{displayMoney(fromUnits(availableBefore))}</span>
                {" → "}
                <span className={`financial-figure ${insufficient ? "text-[#EA3943]" : "text-[#16C784]"}`}>
                  {displayMoney(fromUnits(availableAfter))}
                </span>
              </p>
              {effect.principalDelta !== 0n ? (
                <p className="text-[#9CA3AF]">
                  Invested principal{" "}
                  <span className="financial-figure text-[#F5F5F7]">{displayMoney(fromUnits(principalBefore))}</span>
                  {" → "}
                  <span className="financial-figure text-[#C6A15B]">{displayMoney(fromUnits(principalAfter))}</span>
                </p>
              ) : null}
            </div>

            {problem ? (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[#EA3943]">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{problem}</span>
              </div>
            ) : null}

            {confirming ? (
              <div className="mt-3 space-y-2 rounded-xl border border-[#C6A15B]/40 bg-[#C6A15B]/8 px-3 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
                  <p className="text-xs font-medium text-[#F5F5F7]">Confirm this adjustment</p>
                </div>
                <p className="text-[11px] text-[#9CA3AF]">
                  {BALANCE_ADJUSTMENT_LABEL[type]} of{" "}
                  <span className="financial-figure text-[#F5F5F7]">{displayMoney(amount.trim())}</span> for{" "}
                  {overview.account.email}. Available balance{" "}
                  {displayMoney(fromUnits(availableBefore))} → {displayMoney(fromUnits(availableAfter))}
                  {effect.principalDelta !== 0n
                    ? `, invested principal ${displayMoney(fromUnits(principalBefore))} → ${displayMoney(fromUnits(principalAfter))}`
                    : ""}
                  .
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={busy !== null}
                    className="btn btn-sm btn-primary"
                  >
                    {busy === "apply" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                    Confirm and apply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(false);
                      setPendingKey(null);
                    }}
                    disabled={busy !== null}
                    className="btn btn-sm btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={beginReview}
                  disabled={busy !== null || problem !== null}
                  className="btn btn-sm btn-primary w-full sm:w-auto"
                >
                  Review adjustment
                </button>
              </div>
            )}
          </Panel>
        </>
      ) : null}

      <Panel className="p-0">
        <div className="border-b border-[#26272B] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Wallet className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">Adjustment history</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={filterType}
              onChange={(event) => {
                setFilterType(event.target.value);
                setHistoryPage(1);
              }}
              className={`${inputClass} sm:w-48`}
            >
              <option value="">All types</option>
              {(Object.keys(BALANCE_ADJUSTMENT_LABEL) as BalanceAdjustmentType[]).map((option) => (
                <option key={option} value={option}>
                  {BALANCE_ADJUSTMENT_LABEL[option]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterFrom}
              onChange={(event) => {
                setFilterFrom(event.target.value);
                setHistoryPage(1);
              }}
              className={`${inputClass} sm:w-40`}
            />
            <input
              type="date"
              value={filterTo}
              onChange={(event) => {
                setFilterTo(event.target.value);
                setHistoryPage(1);
              }}
              className={`${inputClass} sm:w-40`}
            />
            {selectedUserId ? (
              <span className="self-center text-[10px] text-[#6B7280]">Filtered to the open user</span>
            ) : null}
          </div>
        </div>

        {!history ? (
          <div className="px-4 py-2">
            <LoadingRow label="Loading adjustments..." />
          </div>
        ) : history.adjustments.length === 0 ? (
          <div className="px-4 py-4">
            <EmptyState
              title="No adjustments recorded"
              description="Every credit, debit, allocation, deallocation, correction, and reversal appears here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[#26272B]/60">
            {history.adjustments.map((row) => (
              <li key={row.adjustmentId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={adjustmentTone(row.type)} label={row.typeLabel} />
                    <span className="financial-figure text-xs text-[#F5F5F7]">{displayMoney(row.amount)}</span>
                    {row.status === "reversed" ? <StatusBadge tone="neutral" label="Reversed" /> : null}
                    {row.reversalOf ? <StatusBadge tone="neutral" label="Reversal" /> : null}
                  </div>
                  <p className="mt-1 break-words text-[11px] text-[#9CA3AF]">
                    {row.userName || row.userEmail || row.userId} · balance {displayMoney(row.balanceBefore)} →{" "}
                    {displayMoney(row.balanceAfter)} · principal {displayMoney(row.principalBefore)} →{" "}
                    {displayMoney(row.principalAfter)}
                  </p>
                  <p className="mt-0.5 break-words text-[10px] text-[#6B7280]">
                    {row.reason}
                    {row.note ? ` · note: ${row.note}` : ""}
                  </p>
                  <p className="mt-0.5 break-words font-mono text-[10px] text-[#6B7280]">
                    {row.reference} · by {row.adminName || row.adminEmail || row.adminId} ·{" "}
                    {formatDateTime(row.createdAt)}
                  </p>
                </div>
                {row.status === "applied" && row.type !== "reversal" ? (
                  <button
                    type="button"
                    onClick={() => void reverse(row)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 btn btn-sm btn-secondary"
                  >
                    {busy === row.adjustmentId ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    )}
                    Reverse
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {history && history.total > history.pageSize ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-[11px] text-[#6B7280]">
              {history.total} adjustment(s) · page {history.page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                className="btn btn-sm btn-secondary"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={historyPage >= totalPages}
                onClick={() => setHistoryPage((page) => page + 1)}
                className="btn btn-sm btn-secondary"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
