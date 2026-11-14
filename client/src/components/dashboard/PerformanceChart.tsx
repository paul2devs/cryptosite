import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { SkeletonBlock } from "./primitives";
import { buildRangeTicks, EmptyChartFrame } from "../charts/EmptyChartFrame";
import type { PerformanceRange, PerformanceSnapshot } from "../../hooks/useDashboardData";

interface ChartPoint {
  date: string;
  roi: number;
}

function buildSeries(history: PerformanceSnapshot[]): ChartPoint[] {
  return history
    .filter((snapshot) => snapshot.verification_status === "verified" && snapshot.roi_percent !== null)
    .map((snapshot) => ({
      date: snapshot.snapshot_date,
      roi: Number(snapshot.roi_percent)
    }))
    .filter((point) => Number.isFinite(point.roi))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
}

function formatAxisDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export function PerformanceChart({
  history,
  loading,
  range = "30d"
}: {
  history: PerformanceSnapshot[];
  loading: boolean;
  range?: PerformanceRange;
}) {
  if (loading && history.length === 0) {
    return <SkeletonBlock className="h-48 w-full rounded-xl" />;
  }

  const series = buildSeries(history);

  if (series.length === 0) {
    return (
      <EmptyChartFrame
        heightClassName="h-56"
        ticks={buildRangeTicks(range)}
        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        showBaseline
        message="Your performance history will appear here once verified performance is available for this range."
        xAxis={
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            tick={{ fill: "#6B7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
        }
        yAxis={
          <YAxis
            domain={[-1, 1]}
            tick={false}
            axisLine={false}
            tickLine={false}
            width={44}
          />
        }
      />
    );
  }

  const lastValue = series[series.length - 1].roi;
  const lineColor = lastValue >= 0 ? "#16C784" : "#EA3943";

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#26272B" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            tick={{ fill: "#6B7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
            tick={{ fill: "#6B7280", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <ReferenceLine y={0} stroke="#3A3B40" strokeDasharray="3 3" />
          <Tooltip
            cursor={{ stroke: "#3A3B40", strokeWidth: 1 }}
            formatter={(value) => [`${Number(value).toFixed(2)}%`, "ROI"]}
            contentStyle={{
              backgroundColor: "#1F2023",
              border: "1px solid #26272B",
              borderRadius: 12,
              fontSize: 11,
              color: "#F5F5F7"
            }}
            labelStyle={{ color: "#9CA3AF", fontSize: 10 }}
            itemStyle={{ color: "#F5F5F7" }}
            labelFormatter={(label) => formatAxisDate(String(label))}
          />
          <Area
            type="monotone"
            dataKey="roi"
            stroke={lineColor}
            strokeWidth={1.8}
            fill="url(#performanceFill)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
