import { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import { EmptyState, ErrorRow, Panel, Stat, StatStrip } from "../components/dashboard/primitives";
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
    <div className="page-responsive space-y-6">
      <Seo
        title="Platform intelligence"
        description="Platform analytics and intelligence dashboard."
        path="/admin/analytics"
        robots="noindex,nofollow"
      />
      <section className="space-y-2">
        <h1 className="display-font text-xl font-semibold text-[#F5F5F7]">Platform intelligence</h1>
        <p className="text-sm text-[#9CA3AF]">
          Growth, retention risk, bonus tuning, and behavioral cycles.
        </p>
      </section>

      {error ? <ErrorRow message={error} /> : null}

      <Panel>
        <StatStrip>
          <Stat
            label="Dynamic bonus factor"
            value={`x${overview?.dynamicBonusFactor?.toFixed(2) ?? "1.00"}`}
            tone="positive"
          />
          <Stat
            label="Churn risk (high)"
            value={String(overview?.churnBuckets?.high ?? 0)}
            tone="negative"
          />
          <Stat
            label="Churn risk (medium)"
            value={String(overview?.churnBuckets?.medium ?? 0)}
            tone="gold"
          />
          <Stat
            label="Churn risk (low)"
            value={String(overview?.churnBuckets?.low ?? 0)}
            tone="neutral"
          />
        </StatStrip>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="min-w-0 space-y-3">
          <h2 className="text-xs font-medium text-[#F5F5F7]">Deposits volume</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.deposits || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26272B" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke="#16C784" fill="#16C78433" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="min-w-0 space-y-3">
          <h2 className="text-xs font-medium text-[#F5F5F7]">Withdrawals volume</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.withdrawals || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26272B" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stroke="#C6A15B" fill="#C6A15B33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="min-w-0 space-y-3">
          <h2 className="text-xs font-medium text-[#F5F5F7]">New users</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.newUsers || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26272B" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#16C784" fill="#16C78433" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="min-w-0 space-y-3">
          <h2 className="text-xs font-medium text-[#F5F5F7]">Active users</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview?.activeUsers || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26272B" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#C6A15B" fill="#C6A15B33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel className="min-w-0 space-y-3">
          <h2 className="text-xs font-medium text-[#F5F5F7]">User activity heatmap</h2>
          <div className="overflow-x-auto">
            <div className="inline-block">
              <div className="grid" style={{ gridTemplateColumns: `60px repeat(24, 18px)` }}>
                <div />
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="text-center text-[10px] text-[#6B7280]">
                    {h}
                  </div>
                ))}
                {Array.from({ length: 7 }).map((_, d) => (
                  <div key={d} className="contents">
                    <div className="flex items-center pr-2 text-[10px] text-[#9CA3AF]">
                      {DOW[d]}
                    </div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const v = heat.get(`${d}:${h}`) || 0;
                      const intensity = v / maxHeat;
                      const bg = `rgba(22, 199, 132, ${0.08 + intensity * 0.55})`;
                      return (
                        <div
                          key={`${d}:${h}`}
                          title={`${DOW[d]} ${h}:00: ${v}`}
                          className="h-4 w-4 rounded-sm border border-[#0F0F10]"
                          style={{ background: bg }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[#6B7280]">
            Aggregated logins/deposits/withdrawals/notification clicks for the last 30 days.
          </p>
        </Panel>

        <Panel className="min-w-0 space-y-3">
          <h2 className="text-xs font-medium text-[#F5F5F7]">Top referrers</h2>
          <div className="max-h-72 overflow-y-auto pr-1">
            {(overview?.referralTop?.length ?? 0) === 0 && (
              <EmptyState title="No referral data yet" />
            )}
            <ul className="divide-y divide-[#26272B]/60 text-[11px]">
              {overview?.referralTop?.map((r, idx) => (
                <li key={r.referrer_id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 text-[#F5F5F7]">
                    #{idx + 1} <span className="break-all text-[#6B7280]">{r.referrer_id}</span>
                  </div>
                  <div className="financial-figure shrink-0 font-medium text-[#16C784]">{r.invited}</div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </section>
    </div>
  );
}
