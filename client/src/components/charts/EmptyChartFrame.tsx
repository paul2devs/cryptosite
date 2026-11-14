import type { ReactNode } from "react";
import { AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer } from "recharts";
import type { PerformanceRange } from "../../hooks/useDashboardData";

/** Deterministic day span used to lay out the empty x-axis for each range. */
const RANGE_SPAN_DAYS: Record<PerformanceRange, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  // "all" has no known inception with no data, so a representative year is used.
  all: 365
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Builds a deterministic set of evenly-spaced date ticks spanning from the start
 * of the selected range to today. These are only used to give the empty chart a
 * meaningful x-axis; no performance values are derived from them.
 */
export function buildRangeTicks(
  range: PerformanceRange,
  tickCount = 7
): Array<{ date: string }> {
  const spanDays = RANGE_SPAN_DAYS[range];
  const count = Math.max(2, tickCount);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const startMs = end.getTime() - spanDays * 24 * 60 * 60 * 1000;
  const stepMs = (end.getTime() - startMs) / (count - 1);

  const ticks: Array<{ date: string }> = [];
  for (let index = 0; index < count; index += 1) {
    ticks.push({ date: toDateKey(new Date(startMs + stepMs * index)) });
  }
  return ticks;
}

export interface EmptyChartFrameProps {
  /** Height classes matching the data chart, e.g. "h-56 sm:h-64". */
  heightClassName: string;
  /** Deterministic tick points used only to lay out the empty x-axis. */
  ticks: Array<{ date: string }>;
  /** The chart's XAxis element, configured exactly like the data chart. */
  xAxis: ReactNode;
  /** The chart's YAxis element, configured exactly like the data chart. */
  yAxis: ReactNode;
  /** Chart margins matching the data chart. */
  margin: { top: number; right: number; bottom: number; left: number };
  /** Render the y=0 baseline when the data chart shows one. */
  showBaseline?: boolean;
  /** Short, accurate empty-state message shown over the frame. */
  message: string;
}

/**
 * Renders the chart frame (grid, axes and optional baseline) even when there is
 * no data series, with a centered message over it. It never draws a line or any
 * fabricated performance value.
 */
export function EmptyChartFrame({
  heightClassName,
  ticks,
  xAxis,
  yAxis,
  margin,
  showBaseline = false,
  message
}: EmptyChartFrameProps) {
  return (
    <div className={`relative w-full ${heightClassName}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={ticks} margin={margin}>
          <CartesianGrid stroke="#26272B" strokeDasharray="3 3" vertical={false} />
          {xAxis}
          {yAxis}
          {showBaseline ? (
            <ReferenceLine y={0} stroke="#3A3B40" strokeDasharray="3 3" />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
        <p className="max-w-[18rem] text-balance text-center text-[11px] leading-relaxed text-[#6B7280]">
          {message}
        </p>
      </div>
    </div>
  );
}
