import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import {
  EmptyState,
  ErrorRow,
  Panel,
  StatusBadge,
  type Tone
} from "../components/dashboard/primitives";

interface AdminDeposit {
  deposit_id: string;
  crypto_type: string;
  amount: number;
  status: string;
  multiplier: number;
  timestamp: string;
  user_id: string;
}

interface AdminWithdrawal {
  withdrawal_id: string;
  amount: number;
  status: string;
  timestamp: string;
  user_id: string;
}

interface AdminUserStats {
  user_id: string;
  name: string;
  email: string;
  level: number;
  xp: number;
  streak: number;
  pendingEarningsTotal: number;
  multiplier: number;
}

interface AdminRiskFlag {
  user_id: string;
  name: string;
  email: string;
  score: number;
  risk_level: string;
}

const inputClass =
  "w-full rounded-xl border border-[#26272B] bg-[#17181A] px-3 py-2 text-xs text-[#F5F5F7] outline-none placeholder:text-[#6B7280] focus:border-[#C6A15B]/60";

function statusTone(status: string): Tone {
  const normalized = status.toLowerCase();
  if (normalized === "approved") return "positive";
  if (normalized === "rejected") return "negative";
  return "gold";
}

function riskTone(level: string): Tone {
  const normalized = level.toLowerCase();
  if (normalized === "high") return "negative";
  if (normalized === "medium") return "gold";
  return "positive";
}

export function AdminPanelPage() {
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserStats[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState("admin_announcement");
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [riskFlags, setRiskFlags] = useState<AdminRiskFlag[]>([]);

  const loadData = async () => {
    try {
      const [dRes, wRes, uRes, rRes] = await Promise.all([
        api.get<AdminDeposit[]>("/deposits"),
        api.get<AdminWithdrawal[]>("/withdrawals"),
        api.get<AdminUserStats[]>("/admin/users_stats"),
        api.get<AdminRiskFlag[]>("/admin/risk_flags")
      ]);
      setDeposits(dRes.data);
      setWithdrawals(wRes.data);
      setUsers(uRes.data);
      setRiskFlags(rRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load admin data");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateDepositStatus = async (
    id: string,
    status: "Approved" | "Rejected"
  ) => {
    try {
      await api.patch(`/deposits/${id}/status`, { status });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update deposit");
    }
  };

  const updateWithdrawalStatus = async (
    id: string,
    status: "Approved" | "Rejected"
  ) => {
    try {
      await api.patch(`/withdrawals/${id}/status`, { status });
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update withdrawal");
    }
  };

  const sendBroadcast = async () => {
    setBroadcastStatus(null);
    try {
      await api.post("/notifications/broadcast", {
        type: broadcastType,
        message: broadcastMessage
      });
      setBroadcastStatus("Broadcast sent");
      setBroadcastMessage("");
    } catch (err: any) {
      setBroadcastStatus(
        err.response?.data?.message || "Failed to send broadcast"
      );
    }
  };

  return (
    <div className="page-responsive space-y-6">
      <Seo
        title="Admin – approvals"
        description="Admin approvals dashboard for deposits and withdrawals."
        path="/admin"
        robots="noindex,nofollow"
      />
      <section className="space-y-2">
        <h1 className="display-font text-xl font-semibold text-[#F5F5F7]">Admin panel</h1>
        <p className="text-sm text-[#9CA3AF]">
          Review activity, manage user payouts, and send broadcast announcements.
        </p>
        <Link
          to="/admin/operations"
          className="inline-flex text-sm text-[#C6A15B] transition-colors hover:text-[#D4B070]"
        >
          Open operations monitoring
        </Link>
      </section>

      {error ? <ErrorRow message={error} /> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Panel className="min-w-0">
          <h2 className="text-xs font-medium text-[#F5F5F7]">Deposits</h2>
          <div className="mt-2 max-h-80 overflow-y-auto pr-1">
            {deposits.length === 0 && <EmptyState title="No deposits yet" />}
            <ul className="divide-y divide-[#26272B]/60 text-[11px]">
              {deposits.map((d) => (
                <li key={d.deposit_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="financial-figure text-sm font-medium text-[#F5F5F7]">
                      {d.amount} {d.crypto_type}
                    </span>
                    <StatusBadge tone={statusTone(d.status)} label={d.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[#9CA3AF]">
                    <span className="min-w-0 break-all">User: {d.user_id}</span>
                    <span className="shrink-0">{new Date(d.timestamp).toLocaleString()}</span>
                  </div>
                  {d.status === "Pending" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateDepositStatus(d.deposit_id, "Approved")}
                        className="btn btn-sm bg-[#16C784]/12 text-[#16C784] hover:bg-[#16C784]/20"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDepositStatus(d.deposit_id, "Rejected")}
                        className="btn btn-sm bg-[#EA3943]/12 text-[#EA3943] hover:bg-[#EA3943]/20"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel className="min-w-0">
          <h2 className="text-xs font-medium text-[#F5F5F7]">Withdrawals</h2>
          <div className="mt-2 max-h-80 overflow-y-auto pr-1">
            {withdrawals.length === 0 && <EmptyState title="No withdrawals yet" />}
            <ul className="divide-y divide-[#26272B]/60 text-[11px]">
              {withdrawals.map((w) => (
                <li key={w.withdrawal_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="financial-figure text-sm font-medium text-[#F5F5F7]">{w.amount}</span>
                    <StatusBadge tone={statusTone(w.status)} label={w.status} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[#9CA3AF]">
                    <span className="min-w-0 break-all">User: {w.user_id}</span>
                    <span className="shrink-0">{new Date(w.timestamp).toLocaleString()}</span>
                  </div>
                  {w.status === "Pending" && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateWithdrawalStatus(w.withdrawal_id, "Approved")}
                        className="btn btn-sm bg-[#16C784]/12 text-[#16C784] hover:bg-[#16C784]/20"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => updateWithdrawalStatus(w.withdrawal_id, "Rejected")}
                        className="btn btn-sm bg-[#EA3943]/12 text-[#EA3943] hover:bg-[#EA3943]/20"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Panel className="min-w-0">
          <h2 className="text-xs font-medium text-[#F5F5F7]">User stats</h2>
          <div className="mt-2 max-h-72 overflow-y-auto pr-1">
            {users.length === 0 && <EmptyState title="No users yet" />}
            <ul className="divide-y divide-[#26272B]/60 text-[11px]">
              {users.map((u) => (
                <li key={u.user_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0 font-medium text-[#F5F5F7]">{u.name}</span>
                    <span className="min-w-0 break-all text-[10px] text-[#9CA3AF]">{u.email}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[#9CA3AF]">
                    <span>
                      L{u.level} · {u.xp} XP
                    </span>
                    <span>Streak {u.streak}d</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[#9CA3AF]">
                    <span className="financial-figure">Pending {u.pendingEarningsTotal.toFixed(4)}</span>
                    <span className="financial-figure">x{u.multiplier.toFixed(2)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel className="min-w-0">
          <h2 className="text-xs font-medium text-[#F5F5F7]">Broadcast notification</h2>
          <div className="mt-2 space-y-2">
            <select
              value={broadcastType}
              onChange={(e) => setBroadcastType(e.target.value)}
              className={inputClass}
            >
              <option value="admin_announcement">Admin announcement</option>
              <option value="promo_multiplier">Promo multiplier</option>
            </select>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Message to all users"
            />
            {broadcastStatus && <p className="text-[11px] text-[#9CA3AF]">{broadcastStatus}</p>}
            <button
              type="button"
              onClick={sendBroadcast}
              disabled={!broadcastMessage}
              className="btn btn-md btn-primary w-full sm:w-auto"
            >
              Send broadcast
            </button>
          </div>
        </Panel>

        <Panel className="min-w-0">
          <h2 className="text-xs font-medium text-[#F5F5F7]">Risk & behavior flags</h2>
          <div className="mt-2 max-h-72 overflow-y-auto pr-1">
            {riskFlags.length === 0 && (
              <EmptyState
                title="No high-risk users detected at the moment"
                description="Risk and behavior flags appear here when activity is elevated."
              />
            )}
            <ul className="divide-y divide-[#26272B]/60 text-[11px]">
              {riskFlags.map((r) => (
                <li key={r.user_id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <span className="min-w-0 font-medium text-[#F5F5F7]">{r.name}</span>
                    <span className="min-w-0 break-all text-[10px] text-[#9CA3AF]">{r.email}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[#9CA3AF]">
                    <span className="financial-figure">Score {r.score.toFixed(1)}</span>
                    <StatusBadge tone={riskTone(r.risk_level)} label={r.risk_level} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </section>
    </div>
  );
}
