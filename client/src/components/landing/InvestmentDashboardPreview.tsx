import { useId, useMemo } from "react";
import { ProgressBar } from "../dashboard/primitives";
import { formatUsd } from "../../utils/format";

/**
 * Public-safe preview of the NexaCrypto investment dashboard.
 *
 * The component renders entirely from local constants. It makes no API call,
 * requires no session, and never reads or implies a real account: the values
 * below are sample figures chosen only to demonstrate the interface, and the
 * surface carries a visible "Sample data" indicator plus a closing footnote so
 * a sample number can never be mistaken for platform performance.
 *
 * Field names, thresholds and progression logic mirror what the product
 * actually tracks so the preview stays faithful to the real platform:
 *  - invested principal (approved, on-chain verified deposits)
 *  - current investment value (principal plus accrued earnings)
 *  - accrued (pending) earnings that are not yet withdrawable
 *  - withdrawable and locked balances
 *  - the ten-stage investment level track (server/src/services/investmentLevelService.ts)
 *  - the membership tiers (server/src/services/membershipService.ts)
 */

const SAMPLE = {
  investedPrincipalUsd: 12400,
  accruedEarningsUsd: 1405.84,
  withdrawableUsd: 9120,
  lockedUsd: 3280,
  level: { current: 6, next: 7, floorUsd: 12000, nextThresholdUsd: 15000 },
  membership: { current: "Gold", next: "Platinum", floorUsd: 5000, nextThresholdUsd: 20000 },
  valueSeriesUsd: [12400, 12620, 12540, 12860, 12990, 13140, 13060, 13480, 13805.84]
} as const;

const CURRENT_VALUE_USD = SAMPLE.investedPrincipalUsd + SAMPLE.accruedEarningsUsd;

/** Share of the way between two thresholds, clamped to 0–100. */
function percentBetween(valueUsd: number, floorUsd: number, ceilingUsd: number): number {
  if (ceilingUsd <= floorUsd) {
    return 100;
  }
  const raw = ((valueUsd - floorUsd) / (ceilingUsd - floorUsd)) * 100;
  return Math.max(0, Math.min(100, raw));
}

const CHART_WIDTH = 480;
const CHART_HEIGHT = 110;
const CHART_PAD_X = 10;
const CHART_TOP = 12;
const CHART_BASELINE = 96;

/**
 * Restrained editorial line chart: a faint grid, one gold value line, a dashed
 * invested-principal baseline and a bare minimum of labelling. The shaded band
 * between the line and the baseline is the accrued (not yet withdrawable)
 * difference, which never changes colour and never implies a guaranteed gain.
 *
 * The SVG stretches to its container, so every stroke is drawn with
 * `vectorEffect="non-scaling-stroke"` to keep hairline weights exact.
 */
function InvestmentValueChart({
  values,
  principalUsd
}: {
  values: readonly number[];
  principalUsd: number;
}) {
  const uid = useId().replace(/[:]/g, "");
  const fillId = `nx-preview-fill-${uid}`;

  const geometry = useMemo(() => {
    const min = Math.min(...values, principalUsd);
    const max = Math.max(...values, principalUsd);
    const span = max - min || 1;
    const stepX = values.length > 1 ? (CHART_WIDTH - CHART_PAD_X * 2) / (values.length - 1) : 0;
    const yFor = (value: number) =>
      CHART_BASELINE - ((value - min) / span) * (CHART_BASELINE - CHART_TOP);
    const points = values.map((value, index) => {
      const x = CHART_PAD_X + index * stepX;
      return [x, yFor(value)] as const;
    });
    const linePath = points
      .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" ");
    const lastX = (CHART_PAD_X + (values.length - 1) * stepX).toFixed(2);
    const areaPath = `${linePath} L${lastX},${CHART_BASELINE} L${CHART_PAD_X},${CHART_BASELINE} Z`;
    return {
      points,
      linePath,
      areaPath,
      principalY: yFor(principalUsd)
    };
  }, [values, principalUsd]);

  const last = geometry.points[geometry.points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-[132px] w-full sm:h-[152px]"
      role="img"
      aria-label="Sample investment value over the last eight months, shown against invested principal"
      focusable="false"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(198,161,91,0.26)" />
          <stop offset="100%" stopColor="rgba(198,161,91,0)" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((fraction) => {
        const y = CHART_TOP + fraction * (CHART_BASELINE - CHART_TOP);
        return (
          <line
            key={fraction}
            x1={CHART_PAD_X}
            x2={CHART_WIDTH - CHART_PAD_X}
            y1={y}
            y2={y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      <line
        x1={CHART_PAD_X}
        x2={CHART_WIDTH - CHART_PAD_X}
        y1={geometry.principalY}
        y2={geometry.principalY}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        strokeDasharray="3 4"
        vectorEffect="non-scaling-stroke"
      />

      <path d={geometry.areaPath} fill={`url(#${fillId})`} />
      <path
        d={geometry.linePath}
        fill="none"
        stroke="#C6A15B"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      <line
        x1={last[0]}
        x2={last[0]}
        y1={last[1] - 5}
        y2={last[1] + 5}
        stroke="#E0C583"
        strokeWidth={1.6}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BalanceBlock({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</dt>
      <dd className="financial-figure mt-1 text-[12px] font-medium text-[#F5F5F7] sm:text-[13px]">
        {value}
      </dd>
      <dd className="mt-0.5 text-[10px] leading-snug text-[#6B7280]">{hint}</dd>
    </div>
  );
}

function ProgressionRow({
  label,
  value,
  nextLabel,
  remainingUsd,
  percent
}: {
  label: string;
  value: string;
  nextLabel: string;
  remainingUsd: number;
  percent: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">{label}</p>
        <p className="display-font text-sm font-medium text-[#F5F5F7]">{value}</p>
      </div>
      <ProgressBar value={percent} tone="gold" className="mt-2" />
      <p className="financial-figure mt-1.5 text-[10px] text-[#9CA3AF]">
        {formatUsd(remainingUsd)} to {nextLabel}
      </p>
    </div>
  );
}

export function InvestmentDashboardPreview({ className = "" }: { className?: string }) {
  const roiPercent = (SAMPLE.accruedEarningsUsd / SAMPLE.investedPrincipalUsd) * 100;
  const levelPercent = percentBetween(
    SAMPLE.investedPrincipalUsd,
    SAMPLE.level.floorUsd,
    SAMPLE.level.nextThresholdUsd
  );
  const membershipPercent = percentBetween(
    SAMPLE.investedPrincipalUsd,
    SAMPLE.membership.floorUsd,
    SAMPLE.membership.nextThresholdUsd
  );

  return (
    <div
      className={`glass relative overflow-hidden rounded-2xl ${className}`}
      aria-label="Preview of the NexaCrypto investment dashboard"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/[0.06] px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="h-5 w-5 shrink-0 rounded-full object-cover"
          />
          <span className="text-[13px] font-semibold tracking-tight text-[#F5F5F7]">
            NexaCrypto
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-[#6B7280] sm:inline">
            Investment overview
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#C6A15B]/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#C6A15B] ring-1 ring-inset ring-[#C6A15B]/25">
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#C6A15B]" />
          Sample data
        </span>
      </header>

      <div className="px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
              Current investment value
            </p>
            <p className="financial-figure mt-2 text-[30px] font-semibold leading-none tracking-tight text-[#F5F5F7] sm:text-[34px]">
              {formatUsd(CURRENT_VALUE_USD)}
            </p>
            <p className="mt-2 text-[11px] text-[#9CA3AF]">
              Invested principal{" "}
              <span className="financial-figure text-[#F5F5F7]">
                {formatUsd(SAMPLE.investedPrincipalUsd)}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">Accrued ROI</p>
            <p className="financial-figure mt-2 text-lg font-medium text-[#16C784]">
              +{roiPercent.toFixed(2)}%
            </p>
            <p className="financial-figure mt-1 text-[11px] text-[#16C784]">
              +{formatUsd(SAMPLE.accruedEarningsUsd)}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-white/[0.06] pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
              Investment progress
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              8 months · sample
            </p>
          </div>
          <div className="mt-3">
            <InvestmentValueChart
              values={SAMPLE.valueSeriesUsd}
              principalUsd={SAMPLE.investedPrincipalUsd}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-[#6B7280]">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-px w-4 border-t border-dashed border-white/25"
              />
              Invested principal {formatUsd(SAMPLE.investedPrincipalUsd)}
            </span>
            <span>Mar – Nov</span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 border-t border-white/[0.06] pt-4">
          <BalanceBlock
            label="Withdrawable"
            value={formatUsd(SAMPLE.withdrawableUsd)}
            hint="Available to request"
          />
          <BalanceBlock
            label="Locked"
            value={formatUsd(SAMPLE.lockedUsd)}
            hint="Clears on schedule"
          />
          <BalanceBlock
            label="Accrued earnings"
            value={formatUsd(SAMPLE.accruedEarningsUsd)}
            hint="Pending, not withdrawable"
          />
        </dl>

        <div className="mt-4 space-y-3.5 border-t border-white/[0.06] pt-4">
          <ProgressionRow
            label="Investment level"
            value={`Level ${SAMPLE.level.current}`}
            nextLabel={`Level ${SAMPLE.level.next}`}
            remainingUsd={SAMPLE.level.nextThresholdUsd - SAMPLE.investedPrincipalUsd}
            percent={levelPercent}
          />
          <ProgressionRow
            label="Membership"
            value={SAMPLE.membership.current}
            nextLabel={SAMPLE.membership.next}
            remainingUsd={SAMPLE.membership.nextThresholdUsd - SAMPLE.investedPrincipalUsd}
            percent={membershipPercent}
          />
        </div>
      </div>

      <footer className="border-t border-white/[0.06] px-5 py-3.5 sm:px-6">
        <p className="text-[10px] leading-relaxed text-[#6B7280]">
          Sample data shown for layout only, not a real account and not NexaCrypto
          performance. Deposits are verified on-chain before they are credited, and investment
          value can rise or fall.
        </p>
      </footer>
    </div>
  );
}
