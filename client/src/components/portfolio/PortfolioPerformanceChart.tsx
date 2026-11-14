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
import { Loader2 } from "lucide-react";
import {
  Section,
  SectionHeader,
  Panel,
  SegmentedControl,
  SkeletonBlock,
  ErrorRow,
  getToneText
} from "../dashboard/primitives";
import { buildRangeTicks, EmptyChartFrame } from "../charts/EmptyChartFrame";
import { formatPercent, formatShortDate, formatSignedUsd, parseDecimalString } from "../../utils/format";
import { toneFromValue } from "./utils";
import type { PerformanceRange, PerformanceSnapshot } from "../../hooks/useDashboardData";
import type { PortfolioPerformanceView } from "../../hooks/usePortfolioData";

const RANGE_OPTIONS: Array<{ value: PerformanceRange; label: string }> = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "ALL" }
];

interface ChartPoint {
  date: string;
  roi: number;
  profitLoss: number | null;
}

function buildSeries(history: PerformanceSnapshot[]): ChartPoint[] {
  return history
    .filter((snapshot) => snapshot.verification_status === "verified" && snapshot.roi_percent !== null)
    .map((snapshot) => ({
      date: snapshot.snapshot_date,
      roi: Number(snapshot.roi_percent),
      profitLoss: parseDecimalString(snapshot.profit_loss)
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

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-[#26272B] bg-[#1F2023] px-3 py-2">
      <p className="text-[10px] text-[#9CA3AF]">{formatShortDate(point.date)}</p>
      <p className={`financial-figure mt-1 text-xs font-medium ${getToneText(toneFromValue(point.roi))}`}>
        {formatPercent(point.roi, { signed: true })} ROI
      </p>
      {point.profitLoss !== null ? (
        <p className="mt-0.5 text-[10px] text-[#9CA3AF]">
          {formatSignedUsd(point.profitLoss)} profit / loss
        </p>
      ) : null}
    </div>
  );
}

export function PortfolioPerformanceChart({
  performance,
  range,
  onRangeChange,
  loading,
  busy,
  error,
  onRetry
}: {
  performance: PortfolioPerformanceView | null;
  range: PerformanceRange;
  onRangeChange: (range: PerformanceRange) => void;
  loading: boolean;
  busy: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const series = performance ? buildSeries(performance.history) : [];
  const lastValue = series.length > 0 ? series[series.length - 1].roi : 0;
  const lineColor = lastValue >= 0 ? "#16C784" : "#EA3943";

  return (
    <Section id="portfolio-performance">
      <SectionHeader
        title="Portfolio performance"
        description="Based on verified valuation records only. Nothing is estimated or simulated."
        action={
          <div className="flex items-center gap-2">
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B7280]" aria-hidden="true" />
            ) : null}
            <SegmentedControl
              ariaLabel="Performance range"
              options={RANGE_OPTIONS}
              value={range}
              onChange={onRangeChange}
            />
          </div>
        }
      />
      <Panel className="mt-4">
        {error && !performance ? (
          <ErrorRow message={error} onRetry={onRetry} />
        ) : loading && series.length === 0 ? (
          <SkeletonBlock className="h-56 w-full rounded-xl" />
        ) : series.length === 0 ? (
          <EmptyChartFrame
            heightClassName="h-56 sm:h-64"
            ticks={buildRangeTicks(range)}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            showBaseline
            message="Your performance history will appear here once verified valuation records are available for this range."
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
        ) : (
          <>
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="portfolioPerformanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.26} />
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
                    content={<ChartTooltip />}
                  />
                  <Area
                    type="monotone"
                    dataKey="roi"
                    stroke={lineColor}
                    strokeWidth={1.8}
                    fill="url(#portfolioPerformanceFill)"
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {performance?.note ? (
              <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">{performance.note}</p>
            ) : null}
          </>
        )}
      </Panel>
    </Section>
  );
}
