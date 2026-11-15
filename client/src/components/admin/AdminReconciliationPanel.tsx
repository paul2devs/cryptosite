import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { EmptyState, ErrorRow, Panel, StatusBadge } from "../dashboard/primitives";
import { formatDateTime } from "../../utils/format";
import {
  fetchReconciliationHistory,
  runPerformanceReconciliation,
  runTransactionReconciliation,
  type PerformanceReconciliationResult,
  type ReconciliationHistoryEntry,
  type TransactionReconciliationResult
} from "../../utils/transactions";

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

function IssueList({ issues }: { issues: Array<{ code: string; reference: string; detail: string }> }) {
  if (issues.length === 0) {
    return <p className="text-[11px] text-[#16C784]">No inconsistencies detected.</p>;
  }
  return (
    <ul className="space-y-1">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${issue.reference}-${index}`} className="text-[11px] text-[#EA3943]">
          <span className="font-mono">{issue.code}</span> · {issue.reference}: {issue.detail}
        </li>
      ))}
    </ul>
  );
}

export function AdminReconciliationPanel() {
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transactionResult, setTransactionResult] = useState<TransactionReconciliationResult | null>(null);
  const [performanceResult, setPerformanceResult] = useState<PerformanceReconciliationResult | null>(null);
  const [history, setHistory] = useState<ReconciliationHistoryEntry[]>([]);
  const [busy, setBusy] = useState<"transactions" | "performance" | "history" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setBusy("history");
    try {
      setHistory(await fetchReconciliationHistory());
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to load reconciliation history"));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const reconcileTransactions = async () => {
    setBusy("transactions");
    setError(null);
    try {
      setTransactionResult(await runTransactionReconciliation(userId.trim() || undefined));
      await loadHistory();
    } catch (requestError) {
      setError(extractMessage(requestError, "Transaction reconciliation failed"));
    } finally {
      setBusy(null);
    }
  };

  const reconcilePerformance = async () => {
    setBusy("performance");
    setError(null);
    try {
      setPerformanceResult(await runPerformanceReconciliation(date));
      await loadHistory();
    } catch (requestError) {
      setError(extractMessage(requestError, "Performance reconciliation failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <ErrorRow message={error} onRetry={loadHistory} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">Transaction ledger reconciliation</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
            Compares confirmed deposits, completed withdrawals and investment positions against
            their ledger entries and records any inconsistencies to the audit log.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Optional user id (blank = all users)"
              className="w-full min-w-0 rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none focus:border-[#C6A15B]/60 sm:flex-1"
            />
            <button
              type="button"
              onClick={reconcileTransactions}
              disabled={busy !== null}
              className="btn btn-sm btn-secondary w-full sm:w-auto"
            >
              {busy === "transactions" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Run reconciliation
            </button>
          </div>
          {transactionResult ? (
            <div className="mt-3 space-y-1 text-[11px] text-[#9CA3AF]">
              <p>
                Scope {transactionResult.scope} · deposits {transactionResult.depositsChecked} ·
                withdrawals {transactionResult.withdrawalsChecked} · mismatched{" "}
                <span className={transactionResult.mismatched > 0 ? "text-[#EA3943]" : "text-[#16C784]"}>
                  {transactionResult.mismatched}
                </span>
              </p>
              <IssueList issues={transactionResult.issues} />
            </div>
          ) : null}
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">Performance snapshot reconciliation</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
            Recomputes each verified daily snapshot (closing minus adjusted opening) and flags
            mismatches. Corrections are recorded and traceable.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none focus:border-[#C6A15B]/60 sm:w-auto"
            />
            <button
              type="button"
              onClick={reconcilePerformance}
              disabled={busy !== null || !date}
              className="btn btn-sm btn-secondary w-full sm:w-auto"
            >
              {busy === "performance" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Reconcile performance
            </button>
          </div>
          {performanceResult ? (
            <div className="mt-3 space-y-1 text-[11px] text-[#9CA3AF]">
              <p>
                {performanceResult.date} · checked {performanceResult.checked} · mismatched{" "}
                <span className={performanceResult.mismatched > 0 ? "text-[#EA3943]" : "text-[#16C784]"}>
                  {performanceResult.mismatched}
                </span>{" "}
                · corrections recorded {performanceResult.correctionsRecorded}
              </p>
              <IssueList issues={performanceResult.issues} />
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[#26272B] px-4 py-3">
          <p className="text-xs font-medium text-[#F5F5F7]">Reconciliation history</p>
          <button
            type="button"
            onClick={loadHistory}
            disabled={busy !== null}
            className="btn btn-sm btn-ghost"
          >
            {busy === "history" ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            )}
            Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <div className="px-4 py-4">
            <EmptyState title="No reconciliation runs recorded yet" />
          </div>
        ) : (
          <ul className="divide-y divide-[#26272B]/60">
            {history.map((entry) => (
              <li key={entry.auditId} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    tone={entry.action === "performance_reconciliation" ? "gold" : "positive"}
                    label={entry.action.replace(/_/g, " ")}
                  />
                  <span className="text-[11px] text-[#9CA3AF]">scope {entry.scope}</span>
                  <span className="text-[10px] text-[#6B7280]">{formatDateTime(entry.createdAt)}</span>
                </div>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">{entry.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
