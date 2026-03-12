import { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

interface OverviewResponse {
  days: number;
  dynamicBonusFactor: number;
  deposits: Array<{ date: string; volume: number; count: number }>;
  withdrawals: Array<{ date: string; volume: number; count: number }>;
  newUsers: Array<{ date: string; count: number }>;
  activeUsers: Array<{ date: string; count: number }>;
  churnBuckets: { low: number; medium: number; high: number };
  referralTop: Array<{ referrer_id: string; invited: number }>;
}

interface HeatmapResponse {
  days: number;
  heatmap: Array<{ dow: number; hour: number; count: number }>;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const heat = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of heatmap?.heatmap || []) {
      map.set(`${c.dow}:${c.hour}`, c.count);
    }
    return map;
  }, [heatmap]);

  const maxHeat = useMemo(() => {
    const values = Array.from(heat.values());
    return values.length ? Math.max(...values) : 1;
  }, [heat]);

  useEffect(() => {
    const load = async () => {
      try {
        const [o, h] = await Promise.all([
          api.get<OverviewResponse>("/admin/analytics/overview?days=30"),
          api.get<HeatmapResponse>("/admin/analytics/heatmap?days=30")
        ]);
        setOverview(o.data);
        setHeatmap(h.data);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load analytics");
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <Seo
        title="Admin – intelligence"
        description="Admin analytics and intelligence dashboard."
        path="/admin/analytics"
        robots="noindex,nofollow"
      />
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Admin intelligence</h1>
        <p className="text-sm text-slate-400">
          Growth, retention risk, bonus tuning, and behavioral cycles.
        </p>
      </section>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <p className="text-xs text-slate-400">Dynamic bonus factor</p>
          <p className="text-2xl font-semibold text-emerald-300">
            x{overview?.dynamicBonusFactor?.toFixed(2) ?? "1.00"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <p className="text-xs text-slate-400">Churn risk (high)</p>
          <p className="text-2xl font-semibold text-red-400">
            {overview?.churnBuckets?.high ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <p className="text-xs text-slate-400">Churn risk (medium)</p>
          <p className="text-2xl font-semibold text-amber-300">
            {overview?.churnBuckets?.medium ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <p className="text-xs text-slate-400">Churn risk (low)</p>
          <p className="text-2xl font-semibold text-sky-300">
            {overview?.churnBuckets?.low ?? 0}
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-medium">Deposits volume</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.deposits || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke="#34d399" fill="#34d39933" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-medium">Withdrawals volume</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.withdrawals || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke="#f59e0b" fill="#f59e0b33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-medium">New users</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.newUsers || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#60a5fa" fill="#60a5fa33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-medium">Active users</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.activeUsers || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#a78bfa" fill="#a78bfa33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h2 className="text-sm font-medium">User activity heatmap</h2>
          <div className="overflow-x-auto">
            <div className="inline-block">
              <div className="grid" style={{ gridTemplateColumns: `60px repeat(24, 18px)` }}>
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-[10px] text-slate-500 text-center">
                    {h}
                  </div>
                ))}
                {Array.from({ length: 7 }).map((_, d) => (
                  <div key={d} className="contents">
                    <div className="text-[10px] text-slate-400 pr-2 flex items-center">
                      {DOW[d]}
                    </div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const v = heat.get(`${d}:${h}`) || 0;
                      const intensity = v / maxHeat;
                      const bg = `rgba(52, 211, 153, ${0.08 + intensity * 0.55})`;
                      return (
                        <div
                          key={`${d}:${h}`}
                          title={`${DOW[d]} ${h}:00 — ${v}`}
                          className="h-4 w-4 rounded-sm border border-slate-900"
                          style={{ background: bg }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[0.7rem] text-slate-500">
            Aggregated logins/deposits/withdrawals/notification clicks for the last 30 days.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 text-xs">
          <h2 className="text-sm font-medium">Top referrers</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {(overview?.referralTop?.length ?? 0) === 0 && (
              <p className="text-slate-500">No referral data yet.</p>
            )}
            {overview?.referralTop?.map((r, idx) => (
              <div
                key={r.referrer_id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
              >
                <div className="text-slate-200">
                  #{idx + 1} <span className="text-slate-500">{r.referrer_id}</span>
                </div>
                <div className="text-emerald-300 font-medium">{r.invited}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

