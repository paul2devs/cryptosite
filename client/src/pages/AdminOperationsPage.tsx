import { FormEvent, useEffect, useState } from "react";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import { ErrorRow, LoadingRow, Panel, Stat, StatStrip } from "../components/dashboard/primitives";
import { AdminMembershipPanel } from "../components/admin/AdminMembershipPanel";
import { AdminInvestmentLevelPanel } from "../components/admin/AdminInvestmentLevelPanel";
import { AdminTransactionsPanel } from "../components/admin/AdminTransactionsPanel";
import { AdminReconciliationPanel } from "../components/admin/AdminReconciliationPanel";
import { AdminBonusPanel } from "../components/admin/AdminBonusPanel";
import { AdminRewardsPanel } from "../components/admin/AdminRewardsPanel";
import { AdminFinancialSettingsPanel } from "../components/admin/AdminFinancialSettingsPanel";
import { AdminBalancePanel } from "../components/admin/AdminBalancePanel";

type Tab =
  | "overview"
  | "users"
  | "deposits"
  | "withdrawals"
  | "transactions"
  | "ledger"
  | "membership"
  | "investment-levels"
  | "bonus"
  | "rewards"
  | "balance"
  | "settings"
  | "activity"
  | "performance"
  | "reconciliation";

interface PageState {
  page: number;
  pageSize: number;
  total: number;
}

const TABS: Tab[] = [
  "overview",
  "users",
  "deposits",
  "withdrawals",
  "transactions",
  "ledger",
  "membership",
  "investment-levels",
  "bonus",
  "rewards",
  "balance",
  "settings",
  "activity",
  "performance",
  "reconciliation"
];
const WITHDRAWAL_STATUSES = ["requested", "under_review", "approved", "processing", "completed", "rejected", "failed"];

const inputClass =
  "w-full min-w-0 rounded-xl border border-[#26272B] bg-[#17181A] px-3 py-2 text-sm text-[#F5F5F7] outline-none placeholder:text-[#6B7280] focus:border-[#C6A15B]/60";

function money(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export function AdminOperationsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [membership, setMembership] = useState("");
  const [asset, setAsset] = useState("");
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [reason, setReason] = useState("");
  const [positionId, setPositionId] = useState("");
  const [closing, setClosing] = useState("");
  const [source, setSource] = useState("");
  const [evidence, setEvidence] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);

  const load = async (nextTab = tab, nextPage = page) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    if (query) params.set("q", query);
    if (status) params.set("status", status);
    if (membership) params.set("membership", membership);
    if (asset) params.set("asset", asset);
    const routes: Record<Tab, string> = {
      overview: "/operations/admin/overview",
      users: `/operations/admin/users?${params.toString()}`,
      deposits: `/operations/admin/deposits?${params.toString()}`,
      withdrawals: `/operations/admin/withdrawals?${params.toString()}`,
      transactions: "/operations/admin/transactions",
      ledger: `/operations/admin/ledger?${params.toString()}`,
      membership: "/operations/admin/memberships",
      "investment-levels": "/operations/admin/investment-levels",
      bonus: "/operations/admin/bonus",
      rewards: "/operations/admin/rewards",
      balance: "/operations/admin/balance/adjustments",
      settings: "/operations/admin/settings",
      activity: `/operations/admin/activity?${params.toString()}`,
      performance: "/operations/admin/performance",
      reconciliation: "/operations/admin/reconcile/history"
    };
    try {
      const response = await api.get<Record<string, unknown>>(routes[nextTab]);
      setPayload(response.data);
    } catch (requestError: unknown) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(message || "Failed to load platform data");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setProfile(null);
    setSelectedEntry(null);
    if (
      tab === "membership" ||
      tab === "investment-levels" ||
      tab === "transactions" ||
      tab === "bonus" ||
      tab === "rewards" ||
      tab === "balance" ||
      tab === "settings" ||
      tab === "reconciliation"
    ) {
      setPayload(null);
      return;
    }
    load(tab, 1);
  }, [tab]);

  const pageState = payload as Partial<PageState> | null;
  const rows = (key: string) => (Array.isArray(payload?.[key]) ? payload?.[key] as Array<Record<string, unknown>> : []);

  const openUser = async (userId: string) => {
    setError(null);
    const response = await api.get<Record<string, unknown>>(`/operations/admin/users/${userId}`);
    setProfile(response.data);
  };

  const deleteUser = async (userId: string, email: string) => {
    const entered = window.prompt(
      `Permanently delete ${email}?\n\nThis removes the account and all of its data. Enter a reason to confirm.`
    );
    if (entered === null) return;
    if (entered.trim().length < 3) {
      setError("Enter a reason of at least 3 characters to delete a user.");
      return;
    }
    try {
      await api.delete(`/operations/admin/users/${userId}`, { data: { reason: entered.trim() } });
      setError(null);
      if ((profile?.account as { userId?: string } | undefined)?.userId === userId) {
        setProfile(null);
      }
      await load("users");
    } catch (requestError: unknown) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(message || "Failed to delete user");
    }
  };

  const review = async (withdrawalId: string, nextStatus: string) => {
    if (reason.trim().length < 3) {
      setError("Enter a reason before changing a withdrawal.");
      return;
    }
    try {
      await api.post(`/operations/admin/withdrawals/${withdrawalId}/review`, { status: nextStatus, reason });
      await load("withdrawals");
    } catch (requestError: unknown) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(message || "Withdrawal update failed");
    }
  };

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post("/operations/admin/performance/verify", {
        positionId,
        snapshotDate,
        closingValuation: closing,
        cashFlow: "0",
        dataSource: source,
        evidenceRef: evidence,
        reason
      });
      setClosing("");
      await load("performance");
    } catch (requestError: unknown) {
      const message = requestError && typeof requestError === "object" && "response" in requestError
        ? (requestError as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(message || "Verification failed");
    }
  };

  return (
    <div className="page-responsive space-y-6 pb-16">
      <Seo title="Operations" description="Platform operational monitoring" path="/admin/operations" robots="noindex,nofollow" />
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">Platform operations</p>
        <h1 className="display-font text-2xl font-semibold text-[#F5F5F7]">Operations</h1>
      </div>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              aria-current={tab === item ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === item
                  ? "bg-[#C6A15B]/12 text-[#C6A15B]"
                  : "text-[#9CA3AF] hover:bg-[#17181A] hover:text-[#F5F5F7]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {(tab === "users" || tab === "deposits" || tab === "withdrawals" || tab === "ledger" || tab === "activity") && (
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); load(tab, 1); }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or id" className={`${inputClass} sm:w-64`} />
          <input value={status} onChange={(event) => setStatus(event.target.value)} placeholder="Status" className={`${inputClass} sm:w-40`} />
          {tab === "users" && <input value={membership} onChange={(event) => setMembership(event.target.value)} placeholder="Membership tier id" className={`${inputClass} sm:w-52`} />}
          {(tab === "deposits" || tab === "ledger") && <input value={asset} onChange={(event) => setAsset(event.target.value)} placeholder="Asset" className={`${inputClass} sm:w-40`} />}
          <button type="submit" className="btn btn-sm btn-secondary w-full sm:w-auto">Apply</button>
        </form>
      )}
      {error ? <ErrorRow message={error} /> : null}
      {loading ? <LoadingRow label="Loading records..." /> : null}

      {tab === "overview" && payload && (
        <div className="space-y-3">
          <Panel className="min-w-0">
            <StatStrip>
              <Stat label="Users" value={String(payload.totalUsers)} />
              <Stat label="Active" value={String(payload.activeUsers)} tone="positive" />
              <Stat label="New today" value={String(payload.newRegistrations)} />
              <Stat label="Active positions" value={String(payload.activePositions)} />
            </StatStrip>
          </Panel>
          <Panel className="min-w-0">
            <StatStrip>
              <Stat label="Confirmed deposits" value={String(payload.confirmedDepositCount)} tone="positive" />
              <Stat label="Pending deposits" value={String(payload.pendingDeposits)} tone="gold" />
              <Stat label="Confirmed withdrawals" value={String(payload.confirmedWithdrawalCount)} />
              <Stat label="Pending withdrawals" value={String(payload.pendingWithdrawals)} tone="gold" />
            </StatStrip>
          </Panel>
          <div className="space-y-2 text-xs text-[#9CA3AF]">
            <p className="break-words">{String(payload.custodyNote)}</p>
            <p className="break-words">{String(payload.performanceNote)}</p>
            <p className="break-words">{String(payload.verificationNote)}</p>
            {rows("recentActivity").map((event) => (
              <p key={String(event.id)} className="break-words">{String(event.timestamp)} · {String(event.type)} · {String(event.userId)}</p>
            ))}
          </div>
        </div>
      )}

      {tab === "users" && payload && (
        <div className="space-y-3 text-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">
                <tr><th className="py-2">User</th><th>Status</th><th>Confirmed deposits</th><th>Qualifying</th><th>Withdrawable</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows("users").map((user) => (
                  <tr key={String(user.userId)} className="border-t border-[#26272B] text-[#F5F5F7]">
                    <td className="py-2">
                      <button type="button" onClick={() => openUser(String(user.userId))} className="text-left">
                        <span className="block">{String(user.email)}</span>
                        <span className="text-[11px] text-[#9CA3AF]">{String(user.userId)}</span>
                      </button>
                    </td>
                    <td>{String(user.accountStatus)}</td>
                    <td className="financial-figure">{money(user.confirmedDepositTotal)}</td>
                    <td className="financial-figure">{money(user.qualifyingAmount)}</td>
                    <td className="financial-figure">{money(user.withdrawableBalance)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => deleteUser(String(user.userId), String(user.email))}
                        className="rounded-full border border-[#F6465D]/40 px-2.5 py-1 text-[11px] font-medium text-[#F6465D] transition-colors hover:bg-[#F6465D]/10"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows("users").length === 0 && <p className="text-xs text-[#9CA3AF]">No users match these filters.</p>}
          {profile && (
            <div className="space-y-1 rounded-xl border border-[#26272B] bg-[#17181A] px-4 py-3 text-xs text-[#9CA3AF]">
              <p className="text-sm text-[#F5F5F7]">User record</p>
              <p className="break-all">{JSON.stringify(profile.account)} </p>
              <p className="break-all">Membership {JSON.stringify(profile.membership)}</p>
              <p className="break-all">Ledger {JSON.stringify((profile.ledger as { totals?: unknown } | undefined)?.totals)}</p>
              <p>Deposits {Array.isArray(profile.deposits) ? profile.deposits.length : 0} · Withdrawals {Array.isArray(profile.withdrawals) ? profile.withdrawals.length : 0} · Positions {Array.isArray(profile.positions) ? profile.positions.length : 0}</p>
            </div>
          )}
        </div>
      )}

      {tab === "deposits" && (
        <div className="space-y-2 text-xs text-[#9CA3AF]">
          {rows("deposits").map((deposit) => (
            <p key={String(deposit.deposit_id)} className="break-words">
              {String(deposit.crypto_type)} · {money(deposit.amount)} · {String(deposit.network || "network not recorded")} · {String(deposit.status)} · confirmations {String(deposit.confirmation_count ?? 0)} · {String(deposit.tx_hash || "no hash")}
            </p>
          ))}
          {payload && rows("deposits").length === 0 && <p>No deposits match these filters.</p>}
        </div>
      )}

      {tab === "withdrawals" && payload && (
        <div className="space-y-3">
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Review reason" className={inputClass} />
          {rows("withdrawals").map((withdrawal) => (
            <div key={String(withdrawal.withdrawal_id)} className="space-y-1 border-t border-[#26272B] py-3 text-xs text-[#9CA3AF]">
              <p className="break-words">{money(withdrawal.amount)} {String(withdrawal.asset || "")} · {String(withdrawal.detailed_status || withdrawal.status)} · {String(withdrawal.destination_address || "address not recorded")} · fee {money(withdrawal.network_fee)} / {money(withdrawal.platform_fee)}</p>
              <p className="break-words">{String(withdrawal.review_reason || "No review reason yet")} · {String(withdrawal.tx_hash || "not broadcast")}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {WITHDRAWAL_STATUSES.map((next) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => review(String(withdrawal.withdrawal_id), next)}
                    className="btn btn-sm btn-secondary"
                  >
                    {next}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {rows("withdrawals").length === 0 && <p className="text-xs text-[#9CA3AF]">No withdrawals match these filters.</p>}
        </div>
      )}

      {tab === "ledger" && (
        <div className="space-y-2 text-xs text-[#9CA3AF]">
          {rows("entries").map((entry) => (
            <button key={String(entry.entry_id)} type="button" onClick={async () => {
              const response = await api.get<{ entry: unknown; related: unknown[] }>(`/operations/admin/ledger/${String(entry.entry_id)}`);
              setSelectedEntry(JSON.stringify(response.data, null, 2));
            }} className="block w-full break-words text-left transition-colors hover:text-[#F5F5F7]">
              {String(entry.created_at)} · {String(entry.transaction_type)} · {String(entry.direction)} {money(entry.amount)} {String(entry.asset)} · {String(entry.source_type)}:{String(entry.source_id)}
            </button>
          ))}
          {selectedEntry && <pre className="max-w-full overflow-auto rounded-xl border border-[#26272B] bg-[#0F0F10] p-3 text-[11px] text-[#9CA3AF]">{selectedEntry}</pre>}
          {payload && rows("entries").length === 0 && <p>No ledger entries yet.</p>}
        </div>
      )}

      {tab === "membership" && <AdminMembershipPanel />}

      {tab === "investment-levels" && <AdminInvestmentLevelPanel />}

      {tab === "bonus" && <AdminBonusPanel />}

      {tab === "rewards" && <AdminRewardsPanel />}

      {tab === "balance" && <AdminBalancePanel />}

      {tab === "settings" && <AdminFinancialSettingsPanel />}

      {tab === "transactions" && <AdminTransactionsPanel />}

      {tab === "reconciliation" && <AdminReconciliationPanel />}

      {tab === "activity" && payload && (
        <div className="space-y-2">
          {[...rows("events"), ...rows("adminActions")].map((event) => (
            <p key={String(event.id)} className="break-words text-xs text-[#9CA3AF]">{String(event.timestamp)} · {String(event.type)} · {String(event.actorId)} · {String(event.outcome)}</p>
          ))}
        </div>
      )}

      {tab === "performance" && payload && (
        <div className="space-y-3">
          <p className="break-words text-sm text-[#F5F5F7]">Verified profit/loss {payload.verifiedProfitLoss === null ? "Unavailable" : String(payload.verifiedProfitLoss)} · Missing {String(payload.missing)} · Failed {String(payload.failed)}</p>
          {rows("byStrategy").map((row) => <p key={String(row.strategy)} className="break-words text-xs text-[#9CA3AF]">{String(row.strategy)} · {String(row.profitLoss)}</p>)}
          <form onSubmit={verify} className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <input value={positionId} onChange={(event) => setPositionId(event.target.value)} placeholder="Position id" className={inputClass} />
              <input value={snapshotDate} onChange={(event) => setSnapshotDate(event.target.value)} type="date" className={inputClass} />
              <input value={closing} onChange={(event) => setClosing(event.target.value)} placeholder="Verified closing valuation" className={inputClass} />
              <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Data source" className={inputClass} />
              <input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Evidence reference" className={inputClass} />
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className={inputClass} />
            </div>
            <button type="submit" className="btn btn-sm btn-primary w-full sm:w-auto">Record verified valuation</button>
          </form>
          <button type="button" onClick={() => api.post("/operations/admin/performance/sweep", { snapshotDate }).then(() => load("performance"))} className="btn btn-sm btn-secondary w-full sm:w-auto">Record missing valuations as unavailable</button>
          {rows("positions").map((position) => <p key={String(position.position_id)} className="break-words text-xs text-[#9CA3AF]">{String(position.position_id)} · {String(position.asset)} principal {money(position.principal)} · {String(position.verification_status)}</p>)}
          {rows("logs").map((log) => <p key={String(log.log_id)} className="break-words text-xs text-[#9CA3AF]">{String(log.snapshot_date)} · {String(log.outcome)} · {String(log.message)}</p>)}
          {rows("snapshots").map((row) => <p key={String(row.snapshot_id)} className="break-words text-xs text-[#9CA3AF]">{String(row.snapshot_date)} · {String(row.verification_status)} · {row.roi_percent === null ? "unavailable" : `${String(row.roi_percent)}%`} · {String(row.data_source)}</p>)}
        </div>
      )}

      {pageState && typeof pageState.total === "number" && pageState.total > (pageState.pageSize || 20) && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-[#9CA3AF]">
          <button type="button" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); load(tab, next); }} className="btn btn-sm btn-secondary">Previous</button>
          <span>Page {page}</span>
          <button type="button" onClick={() => { const next = page + 1; setPage(next); load(tab, next); }} className="btn btn-sm btn-secondary">Next</button>
        </div>
      )}
    </div>
  );
}
