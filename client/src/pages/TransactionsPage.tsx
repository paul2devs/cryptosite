import { RefreshCw } from "lucide-react";
import { Seo } from "../components/Seo";
import { Section, SectionHeader, Panel } from "../components/dashboard/primitives";
import { useTransactionsData } from "../hooks/useTransactionsData";
import { TransactionSummaryHeader } from "../components/transactions/TransactionSummaryHeader";
import { TransactionFilters } from "../components/transactions/TransactionFilters";
import { TransactionList } from "../components/transactions/TransactionList";
import { TransactionDetailDrawer } from "../components/transactions/TransactionDetailDrawer";

export function TransactionsPage() {
  const {
    loading,
    error,
    feed,
    filters,
    page,
    pageSize,
    setFilters,
    resetFilters,
    setPage,
    refresh,
    detail,
    detailLoading,
    detailError,
    activeReference,
    openDetail,
    closeDetail
  } = useTransactionsData();

  return (
    <div className="page-responsive borderless-ui space-y-8 sm:space-y-10">
      <Seo
        title="Transactions – deposits, withdrawals and ledger history"
        description="Review every recorded transaction on your account: deposits, withdrawals, allocations, distributions, fees and adjustments, with status, references and on-chain details."
        path="/transactions"
        robots="noindex,nofollow"
      />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="display-font text-2xl font-semibold tracking-tight text-[#F5F5F7]">
            Transactions
          </h1>
          <p className="max-w-2xl text-sm text-[#9CA3AF]">
            Every confirmed financial event on your account, in one auditable record.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh transactions"
          className="btn btn-secondary btn-sm shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </header>

      <TransactionSummaryHeader
        summary={feed?.summary ?? null}
        reportingPeriod={feed?.reportingPeriod ?? ""}
        loading={loading}
      />

      <Section id="transactions-feed">
        <SectionHeader
          title="Transaction history"
          description="Filter by type, status and date, or search by reference, hash, asset or type. All filtering and pagination is performed server-side."
        />
        <Panel className="mt-4">
          <TransactionFilters filters={filters} onChange={setFilters} onReset={resetFilters} />
        </Panel>
        <div className="mt-4">
          <TransactionList
            transactions={feed?.transactions ?? []}
            total={feed?.total ?? 0}
            page={feed?.page ?? page}
            pageSize={feed?.pageSize ?? pageSize}
            loading={loading}
            error={error}
            onRetry={refresh}
            onSelect={openDetail}
            onPageChange={setPage}
          />
        </div>
      </Section>

      <TransactionDetailDrawer
        reference={activeReference}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onClose={closeDetail}
      />
    </div>
  );
}
