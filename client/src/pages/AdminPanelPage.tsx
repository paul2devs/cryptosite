import { useEffect, useState } from "react";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";

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
    <div className="space-y-6">
      <Seo
        title="Admin – approvals"
        description="Admin approvals dashboard for deposits and withdrawals."
        path="/admin"
        robots="noindex,nofollow"
      />
      <section className="space-y-2">
        <h1 className="text-xl font-semibold mb-1">Admin panel</h1>
        <p className="text-sm text-slate-400">
          Review activity, manage user payouts, and send broadcast announcements.
        </p>
      </section>
      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-medium">Deposits</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
            {deposits.length === 0 && (
              <p className="text-slate-500">No deposits yet.</p>
            )}
            {deposits.map((d) => (
              <div
                key={d.deposit_id}
                className="border border-slate-800 rounded-lg px-3 py-2 space-y-1 bg-slate-950"
              >
                <div className="flex justify-between">
                  <span className="font-medium">
                    {d.amount} {d.crypto_type}
                  </span>
                  <span
                    className={
                      d.status === "Approved"
                        ? "text-emerald-300"
                        : d.status === "Rejected"
                        ? "text-red-400"
                        : "text-amber-300"
                    }
                  >
                    {d.status}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>User: {d.user_id}</span>
                  <span>{new Date(d.timestamp).toLocaleString()}</span>
                </div>
                {d.status === "Pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => updateDepositStatus(d.deposit_id, "Approved")}
                      className="px-2 py-1 rounded-full bg-emerald-600 text-slate-950"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDepositStatus(d.deposit_id, "Rejected")}
                      className="px-2 py-1 rounded-full bg-red-600 text-slate-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-medium">Withdrawals</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
            {withdrawals.length === 0 && (
              <p className="text-slate-500">No withdrawals yet.</p>
            )}
            {withdrawals.map((w) => (
              <div
                key={w.withdrawal_id}
                className="border border-slate-800 rounded-lg px-3 py-2 space-y-1 bg-slate-950"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{w.amount}</span>
                  <span
                    className={
                      w.status === "Approved"
                        ? "text-emerald-300"
                        : w.status === "Rejected"
                        ? "text-red-400"
                        : "text-amber-300"
                    }
                  >
                    {w.status}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>User: {w.user_id}</span>
                  <span>{new Date(w.timestamp).toLocaleString()}</span>
                </div>
                {w.status === "Pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateWithdrawalStatus(w.withdrawal_id, "Approved")
                      }
                      className="px-2 py-1 rounded-full bg-emerald-600 text-slate-950"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateWithdrawalStatus(w.withdrawal_id, "Rejected")
                      }
                      className="px-2 py-1 rounded-full bg-red-600 text-slate-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-xs">
          <h2 className="text-sm font-medium">User stats</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {users.length === 0 && (
              <p className="text-slate-500">No users yet.</p>
            )}
            {users.map((u) => (
              <div
                key={u.user_id}
                className="border border-slate-800 rounded-lg px-3 py-2 bg-slate-950 space-y-1"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-slate-400 text-[0.7rem]">
                    {u.email}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>
                    L{u.level} · {u.xp} XP
                  </span>
                  <span>Streak {u.streak}d</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Pending {u.pendingEarningsTotal.toFixed(4)}</span>
                  <span>x{u.multiplier.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-xs">
          <h2 className="text-sm font-medium">Broadcast notification</h2>
          <div className="space-y-2">
            <select
              value={broadcastType}
              onChange={(e) => setBroadcastType(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/60"
            >
              <option value="admin_announcement">Admin announcement</option>
              <option value="promo_multiplier">Promo multiplier</option>
            </select>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/60"
              placeholder="Message to all users"
            />
            {broadcastStatus && (
              <p className="text-[0.7rem] text-slate-300">{broadcastStatus}</p>
            )}
            <button
              type="button"
              onClick={sendBroadcast}
              disabled={!broadcastMessage}
              className="rounded-lg bg-primary hover:bg-primary-dark text-slate-950 font-medium px-3 py-2 text-xs disabled:opacity-60"
            >
              Send broadcast
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-xs">
          <h2 className="text-sm font-medium">Risk & behavior flags</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {riskFlags.length === 0 && (
              <p className="text-slate-500">
                No high-risk users detected at the moment.
              </p>
            )}
            {riskFlags.map((r) => (
              <div
                key={r.user_id}
                className="border border-slate-800 rounded-lg px-3 py-2 bg-slate-950 space-y-1"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-slate-400 text-[0.7rem]">
                    {r.email}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Score {r.score.toFixed(1)}</span>
                  <span
                    className={
                      r.risk_level === "high"
                        ? "text-red-400"
                        : r.risk_level === "medium"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }
                  >
                    {r.risk_level.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

