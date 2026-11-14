import { Metric, Section, SkeletonBlock, StatStrip } from "../dashboard/primitives";
import { formatNumber, parseDecimalString } from "../../utils/format";
import type { TransactionSummary } from "../../utils/transactions";

function amountLabel(value: string | undefined): string {
  const parsed = parseDecimalString(value ?? null);
  if (parsed === null) return "0";
  return formatNumber(parsed, 8);
}

export function TransactionSummaryHeader({
  summary,
  reportingPeriod,
  loading
}: {
  summary: TransactionSummary | null;
  reportingPeriod: string;
  loading: boolean;
}) {
  if (loading && !summary) {
    return (
      <Section id="transactions-summary">
        <StatStrip className="card px-4 py-3 sm:px-5">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="min-w-0 py-1">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="mt-3 h-5 w-24" />
            </div>
          ))}
        </StatStrip>
      </Section>
    );
  }

  return (
    <Section id="transactions-summary">
      <StatStrip className="card px-4 py-3 sm:px-5">
        <Metric
          label="Confirmed deposits"
          value={amountLabel(summary?.confirmedDeposits)}
          hint="Settled to the ledger"
          tone="gold"
        />
        <Metric
          label="Completed withdrawals"
          value={amountLabel(summary?.completedWithdrawals)}
          hint="Paid out and debited"
          tone="neutral"
        />
        <Metric
          label="Pending transactions"
          value={String(summary?.pendingCount ?? 0)}
          hint="Awaiting confirmation or review"
          tone={(summary?.pendingCount ?? 0) > 0 ? "gold" : "neutral"}
        />
        <Metric
          label="Total transactions"
          value={String(summary?.totalCount ?? 0)}
          hint="All recorded events"
          tone="neutral"
        />
      </StatStrip>
      <p className="mt-3 text-[11px] leading-relaxed text-[#6B7280]">
        {reportingPeriod || "Aggregated from confirmed ledger records across all assets."} Amounts
        shown are recorded asset units; mixed assets are not converted.
      </p>
    </Section>
  );
}
