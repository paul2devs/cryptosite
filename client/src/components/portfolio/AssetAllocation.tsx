import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Section, SectionHeader, Panel, SkeletonBlock } from "../dashboard/primitives";
import { useBalanceVisibility } from "../BalanceVisibilityProvider";
import { formatPercent, formatUsd } from "../../utils/format";
import { getAllocationColor, getAssetMeta } from "./assetMeta";
import { maskValue } from "./utils";
import { PortfolioEmptyState } from "./PortfolioEmptyState";
import type { PortfolioAllocationView } from "../../hooks/usePortfolioData";

export function AssetAllocation({
  allocation,
  loading,
  total
}: {
  allocation: PortfolioAllocationView[];
  loading: boolean;
  total: number;
}) {
  const { hidden } = useBalanceVisibility();

  const slices = useMemo(
    () =>
      allocation
        .filter((slice) => Number.isFinite(slice.value) && slice.value > 0)
        .sort((left, right) => right.value - left.value),
    [allocation]
  );

  const denominator = useMemo(
    () => slices.reduce((sum, slice) => sum + slice.value, 0),
    [slices]
  );

  return (
    <Section id="portfolio-allocation">
      <SectionHeader
        title="Asset allocation"
        description="How your holdings are distributed by current value."
      />
      <Panel className="mt-4">
        {loading && slices.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-4 sm:flex-row sm:items-center sm:gap-6">
            <SkeletonBlock className="h-40 w-40 rounded-full" />
            <div className="w-full space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonBlock key={index} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ) : slices.length === 0 || denominator <= 0 ? (
          <PortfolioEmptyState
            title="No allocation to display yet."
            description="Your allocation chart appears once you hold a confirmed, priceable position."
          />
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    dataKey="value"
                    data={slices}
                    innerRadius={54}
                    outerRadius={82}
                    paddingAngle={2}
                    stroke="#0F0F10"
                    strokeWidth={1}
                  >
                    {slices.map((slice, index) => (
                      <Cell key={slice.symbol} fill={getAllocationColor(index)} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1F2023",
                      border: "1px solid #26272B",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#F5F5F7"
                    }}
                    itemStyle={{ color: "#F5F5F7" }}
                    labelStyle={{ color: "#9CA3AF", fontSize: 10 }}
                    formatter={(value: number, _name, payload) => {
                      const entry = payload?.payload as PortfolioAllocationView | undefined;
                      const percent = entry ? entry.percent : denominator > 0 ? (value / denominator) * 100 : 0;
                      return [`${formatUsd(value)} · ${formatPercent(percent, { decimals: 1 })}`, entry?.symbol ?? ""];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">Total</p>
                <p className="financial-figure text-sm font-medium text-[#F5F5F7]">
                  {maskValue(hidden, formatUsd(denominator))}
                </p>
              </div>
            </div>

            <div className="w-full space-y-3">
              {slices.map((slice, index) => {
                const meta = getAssetMeta(slice.symbol);
                const percent = denominator > 0 ? (slice.value / denominator) * 100 : 0;
                return (
                  <div key={slice.symbol} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getAllocationColor(index) }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-medium text-[#F5F5F7]">{meta.name}</p>
                        <p className="financial-figure shrink-0 text-xs text-[#F5F5F7]">
                          {maskValue(hidden, formatUsd(slice.value))}
                        </p>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-[10px] text-[#6B7280]">{slice.symbol}</span>
                        <span className="text-[10px] text-[#9CA3AF]">
                          {formatPercent(percent, { decimals: 1 })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {total > 0 && Math.abs(denominator - total) > 0.01 ? (
                <p className="text-[10px] text-[#6B7280]">
                  Some holdings are excluded because no live price is available.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </Panel>
    </Section>
  );
}
