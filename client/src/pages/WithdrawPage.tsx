import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hourglass, Lock, Wallet, CheckCircle2, Circle } from "lucide-react";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";

interface Withdrawal {
  withdrawal_id: string;
  amount: number;
  status: string;
  timestamp: string;
}

interface WithdrawalSummary {
  withdrawable_balance: number;
  locked_balance: number;
  pending_earnings_total: number;
  user_level: number;
  min_level: number;
  cooldown_seconds_remaining: number;
}

export function WithdrawPage() {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [pendingEarnings, setPendingEarnings] = useState(0);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [minLevel, setMinLevel] = useState<number | null>(null);
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);
  const [lockedBalance, setLockedBalance] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const loadWithdrawals = async () => {
    try {
      const response = await api.get<Withdrawal[]>("/withdrawals/me");
      setWithdrawals(response.data);
    } catch {
      setError("Failed to load withdrawals");
    }
  };

  const refreshSummary = async () => {
    try {
      const summaryRes = await api.get<WithdrawalSummary>("/withdrawals/summary");
      const summary = summaryRes.data;
      setPendingEarnings(summary.pending_earnings_total);
      setUserLevel(summary.user_level);
      setMinLevel(summary.min_level);
      setWithdrawableBalance(summary.withdrawable_balance);
      setLockedBalance(summary.locked_balance);
      setCooldownSeconds(summary.cooldown_seconds_remaining);
      const eligible =
        summary.user_level >= summary.min_level &&
        summary.withdrawable_balance > 0 &&
        summary.cooldown_seconds_remaining === 0;
      setCanWithdraw(eligible);
    } catch {
      setCanWithdraw(false);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadWithdrawals(), refreshSummary()]);
    };
    init();
  }, []);

  useEffect(() => {
    if (!message && !error) {
      return;
    }
    const timeout = setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [message, error]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!amount) {
      return;
    }
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await api.post("/withdrawals", {
        amount: Number(amount)
      });
      setMessage("Withdrawal request submitted");
      setAmount("");
      await Promise.all([loadWithdrawals(), refreshSummary()]);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit withdrawal");
    } finally {
      setSubmitting(false);
    }
  };

  const levelRequirementMet =
    userLevel !== null && minLevel !== null ? userLevel >= minLevel : false;
  const hasWithdrawableBalance = withdrawableBalance > 0;
  const cooldownCleared = cooldownSeconds === 0;

  const levelProgressPercent = useMemo(() => {
    if (userLevel === null || minLevel === null || minLevel <= 0) {
      return 0;
    }
    const ratio = Math.min(userLevel / minLevel, 1);
    return Math.round(ratio * 100);
  }, [userLevel, minLevel]);

  const numericAmount = Number(amount) || 0;
  const amountExceedsBalance = numericAmount > withdrawableBalance;
  const isFormValid =
    canWithdraw && numericAmount > 0 && !amountExceedsBalance && !submitting;

  const tooltipMessage =
    !levelRequirementMet || !cooldownCleared
      ? `Withdrawals unlock at Level ${minLevel ?? ""}`
      : !hasWithdrawableBalance
      ? "You need withdrawable balance to request a payout"
      : "";

  const getStatusClass = (status: string) => {
    if (status === "Approved") {
      return "border-emerald-500/50 bg-emerald-500/10 text-emerald-300";
    }
    if (status === "Rejected") {
      return "border-[#EA3943]/60 bg-[#EA3943]/10 text-[#FCA5A5]";
    }
    return "border-[#C6A15B]/60 bg-[#C6A15B]/10 text-[#F5F5F7]";
  };

  const formatShortId = (id: string) => {
    if (!id) {
      return "—";
    }
    if (id.length <= 10) {
      return id;
    }
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  };

  return (
    <div className="space-y-10">
      <Seo
        title="Withdraw rewards"
        description="Request secure withdrawals from your Crypto Levels withdrawable balance. Withdrawals are level-gated and reviewed for security."
        path="/withdraw"
      />
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
          Withdraw
        </h1>
        <p className="text-sm text-[#9CA3AF]">
          Review your earnings, check withdrawal eligibility, and submit secure payout requests.
        </p>
      </section>

      <section className="space-y-5">
        <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                Balance Overview
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Understand what is pending, what is withdrawable, and what remains locked.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row text-xs">
            <div className="flex flex-1 items-center justify-between rounded-xl bg-[#0F0F10]/70 px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17181A] text-[#9CA3AF]">
                  <Hourglass className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-[#9CA3AF]">
                    Pending Earnings
                  </span>
                  <motion.span
                    key={pendingEarnings}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-semibold text-[#F5F5F7]"
                  >
                    {pendingEarnings.toFixed(4)}
                  </motion.span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-between rounded-xl bg-[#0F0F10]/70 px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B1F18] text-[#16C784]">
                  <Wallet className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-[#9CA3AF]">
                    Withdrawable Balance
                  </span>
                  <motion.span
                    key={withdrawableBalance}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-semibold text-[#16C784]"
                  >
                    {withdrawableBalance.toFixed(4)}
                  </motion.span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-between rounded-xl bg-[#0F0F10]/70 px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111827] text-[#9CA3AF]">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-[#9CA3AF]">
                    Locked Balance
                  </span>
                  <motion.span
                    key={lockedBalance}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-semibold text-[#9CA3AF]"
                  >
                    {lockedBalance.toFixed(4)}
                  </motion.span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#17181A]/30 px-4 py-3 sm:px-5 sm:py-4 text-xs text-[#9CA3AF]">
          <p>
            Withdrawals are reviewed by the admin team. Once you reach level{" "}
            <span className="font-medium text-[#F5F5F7]">
              {minLevel ?? 5}
            </span>{" "}
            based on your approved deposits and your cooldown is cleared, you can request payouts from your earnings.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-6 lg:flex-row items-start">
        <div className="space-y-5 lg:flex-1">
          <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Withdrawal Status
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-[#F5F5F7]">
                    Current Level {userLevel ?? "–"}
                  </span>
                  {minLevel !== null && (
                    <span className="text-[11px] text-[#9CA3AF]">
                      Withdrawals unlock at Level {minLevel}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-[#9CA3AF]">
                Progress to withdrawal unlock
              </p>
              <div className="h-2 rounded-full bg-[#2A2B2E] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    backgroundImage: "linear-gradient(90deg,#C6A15B,#F4D48A)"
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${levelProgressPercent}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                <span>
                  Level {userLevel ?? "–"} / Level {minLevel ?? "–"}
                </span>
                {cooldownSeconds > 0 && (
                  <span>
                    Cooldown:{" "}
                    {Math.ceil(cooldownSeconds / 3600)}
                    h remaining
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#17181A] border border-[#26272B] px-4 py-4 sm:px-5 sm:py-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#F5F5F7]">
                  Withdrawal Eligibility
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  All conditions must be met before payouts can be requested.
                </p>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-[#0F0F10]/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  {levelRequirementMet ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#4B5563]" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#F5F5F7]">
                      Level {minLevel ?? "5"} or higher
                    </span>
                    <span className="text-[11px] text-[#9CA3AF]">
                      Based on your total approved deposits.
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#0F0F10]/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  {hasWithdrawableBalance ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#4B5563]" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#F5F5F7]">
                      Withdrawable balance available
                    </span>
                    <span className="text-[11px] text-[#9CA3AF]">
                      You can only request up to your withdrawable balance.
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#0F0F10]/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  {cooldownCleared ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#4B5563]" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-[11px] text-[#F5F5F7]">
                      Cooldown cleared
                    </span>
                    <span className="text-[11px] text-[#9CA3AF]">
                      A short cooldown protects the platform from abusive behavior.
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-[#9CA3AF]">
              These safeguards protect both you and the platform while keeping rewards fair and sustainable.
            </p>
          </div>
        </div>

        <div className="space-y-5 lg:flex-1">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[#F5F5F7]">
                    Withdrawal Request Form
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Specify how much you want to withdraw from your available balance.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  className="flex items-center justify-between text-xs text-[#9CA3AF]"
                  htmlFor="withdraw-amount"
                >
                  <span>Amount to withdraw</span>
                  <span className="text-[11px] text-[#9CA3AF]">
                    Max: {withdrawableBalance.toFixed(4)}
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="withdraw-amount"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full rounded-xl bg-[#0F0F10] border border-[#26272B] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6A15B]/60 focus:border-transparent"
                    placeholder="Enter withdrawal amount"
                  />
                </div>
                <p className="text-[11px] text-[#9CA3AF]">
                  Withdrawals must be less than or equal to your withdrawable balance.
                </p>
                {amountExceedsBalance && (
                  <p className="text-[11px] text-[#EA3943]">
                    Amount exceeds your withdrawable balance.
                  </p>
                )}
              </div>
            </div>

            {message && (
              <div className="rounded-xl border border-emerald-500/60 bg-[#071A14] px-3 py-2 text-xs text-[#A7F3D0]">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-[#EA3943]/60 bg-[#1F1214] px-3 py-2 text-xs text-[#FCA5A5]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isFormValid}
              title={!isFormValid && tooltipMessage ? tooltipMessage : undefined}
              className="mt-1 inline-flex w-full items-center justify-center rounded-xl bg-[#C6A15B] px-4 py-3 text-sm font-medium text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.85)] transition-transform transition-shadow hover:-translate-y-[1px] hover:shadow-[0_0_24px_rgba(198,161,91,0.55)] disabled:translate-y-0 disabled:opacity-60 disabled:hover:shadow-none"
            >
              {submitting ? "Submitting..." : "Request Withdrawal"}
            </button>
          </form>

          <div className="rounded-2xl bg-[#17181A] border border-[#26272B] px-4 py-4 sm:px-5 sm:py-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[#F5F5F7]">
                  Recent Withdrawals
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  Track the status of your withdrawal requests in one place.
                </p>
              </div>
            </div>
            <div className="mt-2 max-h-64 overflow-y-auto pr-1 text-xs">
              {withdrawals.length === 0 && !loadingSummary && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#26272B] bg-[#0F0F10] px-4 py-6 text-center">
                  <p className="text-xs font-medium text-[#F5F5F7]">
                    Your withdrawal history will appear here once you request your first payout.
                  </p>
                </div>
              )}
              {withdrawals.length > 0 && (
                <div className="space-y-1">
                  <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-2 px-2 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#9CA3AF]">
                    <span>Date</span>
                    <span>Amount</span>
                    <span>Status</span>
                    <span>Transaction</span>
                  </div>
                  <div className="divide-y divide-[#26272B]">
                    {withdrawals.map((w) => (
                      <div
                        key={w.withdrawal_id}
                        className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-2 px-2 py-2.5 text-xs text-[#F5F5F7] transition-colors hover:bg-[#111827]"
                      >
                        <div className="flex flex-col text-[11px] text-[#9CA3AF]">
                          <span>
                            {new Date(w.timestamp).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                          <span>{new Date(w.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex items-center">
                          <span>
                            {w.amount.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span
                            className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] ${getStatusClass(
                              w.status
                            )}`}
                          >
                            {w.status}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-mono text-[11px] text-[#9CA3AF]">
                            {formatShortId(w.withdrawal_id)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {(message || error) && (
          <motion.div
            className="fixed bottom-24 right-4 z-40 max-w-xs rounded-2xl border px-3 py-2 text-xs shadow-lg bg-[#0F0F10]"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
          >
            <div
              className={
                error
                  ? "border-[#EA3943]/60 bg-[#1F1214] text-[#FCA5A5]"
                  : "border-[#16C784]/60 bg-[#071A14] text-[#A7F3D0]"
              }
            >
              <div className="px-2 py-1.5">
                <p>{error || message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

