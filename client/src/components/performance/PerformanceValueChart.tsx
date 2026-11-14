import { useState } from "react";
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
  Divider,
  ErrorRow,
  Panel,
  Section,
  SectionHeader,
  SegmentedControl,
  SkeletonBlock,
  StatStrip,
  getToneText,
  type Tone
} from "../dashboard/primitives";
import { buildRangeTicks, EmptyChartFrame } from "../charts/EmptyChartFrame";
import {
  formatPercent,
  formatShortDate,
  formatSignedUsd,
  formatUsd,
  parseDecimalString
} from "../../utils/format";
import type {
  PerformanceChartData,
  PerformanceRange,
  PerformanceView
} from "../../hooks/useDashboardData";

const RANGE_OPTIONS: Array<{ value: PerformanceRange; label: string }> = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "ALL" }
];

type SeriesMetric = "value" | "pnl";

const METRIC_OPTIONS: Array<{ value: SeriesMetric; label: string }> = [
  { value: "value", label: "Value" },
  { value: "pnl", label: "Profit / loss" }
];

interface ChartPoint {
  date: string;
  value: number;
  roi: number | null;
  externalFlow: number;
  status: string;
}

function toneFromValue(value: number | null): Tone {
  if (value === null || value === 0) return "neutral";
  return value > 0 ? "positive" : "negative";
}

function buildSeries(chart: PerformanceChartData | null, metric: SeriesMetric): ChartPoint[] {
  if (!chart) return [];
  const points: ChartPoint[] = [];
  for (const point of chart.points) {
    const raw = metric === "value" ? point.portfolioValue : point.cumulativeProfitLoss;
    const numeric = parseDecimalString(raw);
    if (numeric === null) continue;
    points.push({
      date: point.date,
      value: numeric,
      roi: parseDecimalString(point.roiPercent),
      externalFlow: parseDecimalString(point.externalFlow) ?? 0,
      status: point.status
    });
  }
  return points.sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
}

function formatAxisDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
}

function ChartTooltip({
  active,
  payload,
  metric
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
  metric: SeriesMetric;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-[#26272B] bg-[#1F2023] px-3 py-2">
      <p className="text-[10px] text-[#9CA3AF]">{formatShortDate(point.date)}</p>
      <p className="financial-figure mt-1 text-xs font-medium text-[#F5F5F7]">
        {metric === "value" ? formatUsd(point.value) : formatSignedUsd(point.value)}
      </p>
      {point.roi !== null ? (
        <p className={`mt-0.5 text-[10px] ${getToneText(toneFromValue(point.roi))}`}>
          {formatPercent(point.roi, { signed: true })} ROI
        </p>
      ) : null}
      {point.externalFlow !== 0 ? (
        <p className="mt-0.5 text-[10px] text-[#9CA3AF]">
          Net cash flow {formatSignedUsd(point.externalFlow)}
        </p>
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
      <p className="financial-figure mt-0.5 text-xs text-[#F5F5F7]">{value}</p>
    </div>
  );
}

export function PerformanceValueChart({
  performance,
  range,
  onRangeChange,
  loading,
  busy,
  error,
  onRetry
}: {
  performance: PerformanceView | null;
  range: PerformanceRange;
  onRangeChange: (range: PerformanceRange) => void;
  loading: boolean;
  busy: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const [metric, setMetric] = useState<SeriesMetric>("value");
  const chart = performance?.chart ?? null;
  const series = buildSeries(chart, metric);
  const lastValue = series.length > 0 ? series[series.length - 1].value : 0;
  const lineColor = lastValue >= 0 ? "#16C784" : "#EA3943";

  const openingValue = parseDecimalString(chart?.openingValue ?? null);
  const closingValue = parseDecimalString(chart?.closingValue ?? null);
  const contributions = parseDecimalString(chart?.externalContributions ?? null);
  const withdrawals = parseDecimalString(chart?.externalWithdrawals ?? null);

  return (
    <Section id="performance-chart">
      <SectionHeader
        title="Performance over time"
        description="Built only from verified daily valuations. Missing days are omitted rather than estimated."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B7280]" aria-hidden="true" />
            ) : null}
            <SegmentedControl
              ariaLabel="Chart metric"
              options={METRIC_OPTIONS}
              value={metric}
              onChange={setMetric}
            />
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
          <SkeletonBlock className="h-56 w-full rounded-xl sm:h-64" />
        ) : series.length === 0 ? (
          <EmptyChartFrame
            heightClassName="h-56 sm:h-64"
            ticks={buildRangeTicks(range)}
            margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            showBaseline={metric === "pnl"}
            message="Your performance history will appear here once verified daily valuations are available for this range."
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
                domain={metric === "pnl" ? [-1, 1] : [0, 1]}
                tick={false}
                axisLine={false}
                tickLine={false}
                width={64}
              />
            }
          />
        ) : (
          <>
            <div className="h-56 w-full sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="performanceValueFill" x1="0" y1="0" x2="0" y2="1">
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
                    tickFormatter={(value) =>
                      metric === "value" ? formatUsd(Number(value)) : `${Number(value).toFixed(0)}`
                    }
                    tick={{ fill: "#6B7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  {metric === "pnl" ? (
                    <ReferenceLine y={0} stroke="#3A3B40" strokeDasharray="3 3" />
                  ) : null}
                  <Tooltip
                    cursor={{ stroke: "#3A3B40", strokeWidth: 1 }}
                    content={<ChartTooltip metric={metric} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={lineColor}
                    strokeWidth={1.8}
                    fill="url(#performanceValueFill)"
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4">
              <Divider />
              <div className="pt-4">
                <StatStrip>
                  <SummaryStat
                    label="Opening value"
                    value={openingValue === null ? "Unavailable" : formatUsd(openingValue)}
                  />
                  <SummaryStat
                    label="Closing value"
                    value={closingValue === null ? "Unavailable" : formatUsd(closingValue)}
                  />
                  <SummaryStat
                    label="External contributions"
                    value={contributions === null ? "Unavailable" : `+${formatUsd(contributions)}`}
                  />
                  <SummaryStat
                    label="External withdrawals"
                    value={withdrawals === null ? "Unavailable" : `-${formatUsd(withdrawals)}`}
                  />
                </StatStrip>
              </div>
            </div>
          </>
        )}
        {performance?.note ? (
          <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">{performance.note}</p>
        ) : null}
      </Panel>
    </Section>
  );
}
