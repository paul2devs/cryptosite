import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  ScanSearch,
  Search
} from "lucide-react";
import {
  EmptyState,
  ErrorRow,
  Panel,
  SegmentedControl,
  Stat,
  StatStrip,
  StatusBadge,
  type Tone
} from "../dashboard/primitives";
import { formatDateTime, formatNumber, formatUsd, truncateMiddle } from "../../utils/format";
import { api } from "../../utils/api";
import { CopyButton } from "../deposit/CopyButton";

export type AdminDepositFilter =
  | "open"
  | "pending"
  | "detected"
  | "confirming"
  | "awaiting_approval"
  | "completed"
  | "rejected"
  | "expired"
  | "failed"
  | "all";

export interface AdminDepositUser {
  userId: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface AdminDepositRow {
  depositId: string;
  reference: string;
  status: string;
  detailedStatus: string;
  statusLabel: string;
  statusMessage: string;
  approvalRequired: boolean;
  user: AdminDepositUser | null;
  cryptoType: string;
  symbol: string;
  network: string;
  networkLabel: string;
  receivingAddress: string | null;
  expectedAmount: number;
  expectedAmountLabel: string;
  receivedAmount: number | null;
  usdAmount: number | null;
  memo: string | null;
  memoLabel: string | null;
  memoRequired: boolean;
  txHash: string | null;
  explorerUrl: string | null;
  confirmations: number;
  minConfirmations: number;
  verification: {
    stage: string;
    success: boolean;
    amount: number;
    toAddress: string;
    confirmations: number;
    failureReason: string | null;
  } | null;
  createdAt: string;
  detectedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  approvedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  canApprove: boolean;
  canReject: boolean;
}

export interface AdminDepositListResult {
  page: number;
  pageSize: number;
  total: number;
  filter: AdminDepositFilter;
  counts: Record<string, number>;
  deposits: AdminDepositRow[];
}

export interface AdminDepositAuditEntry {
  auditId: string;
  adminId: string;
  action: string;
  reason: string;
  metadata: unknown;
  createdAt: string;
}

export interface AdminDepositDetail {
  deposit: AdminDepositRow;
  auditTrail: AdminDepositAuditEntry[];
  canApprove: boolean;
  canReject: boolean;
  approvalBlockedReason: string | null;
}

const PAGE_SIZE = 20;

const FILTER_OPTIONS: Array<{ value: AdminDepositFilter; label: string }> = [
  { value: "open", label: "Open" },
  { value: "awaiting_approval", label: "Awaiting approval" },
  { value: "pending", label: "Pending" },
  { value: "detected", label: "Detected" },
  { value: "confirming", label: "Confirming" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "failed", label: "Failed" },
  { value: "all", label: "All" }
];

const ASSET_OPTIONS = ["", "BTC", "ETH", "SOL", "ERC20", "TRC20"];

const DETAIL_TONE: Record<string, Tone> = {
  PENDING: "gold",
  DETECTED: "gold",
  CONFIRMING: "gold",
  AWAITING_ADMIN_APPROVAL: "gold",
  COMPLETED: "positive",
  REJECTED: "negative",
  EXPIRED: "negative",
  FAILED: "negative"
};

const COUNT_KEYS: Array<{ key: string; label: string }> = [
  { key: "PENDING", label: "Pending" },
  { key: "DETECTED", label: "Detected" },
  { key: "CONFIRMING", label: "Confirming" },
  { key: "AWAITING_ADMIN_APPROVAL", label: "Awaiting approval" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" }
];

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

function toneFor(detailedStatus: string): Tone {
  return DETAIL_TONE[String(detailedStatus).toUpperCase()] ?? "neutral";
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
      <p className="break-all text-[11px] text-[#F5F5F7]">{value}</p>
    </div>
  );
}

export function CryptoDepositsPanel() {
  const [filter, setFilter] = useState<AdminDepositFilter>("open");
  const [asset, setAsset] = useState("");
  const [network, setNetwork] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<AdminDepositListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDepositDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<AdminDepositListResult>("/deposits/admin", {
        params: {
          status: filter,
          page,
          pageSize: PAGE_SIZE,
          ...(asset ? { asset } : {}),
          ...(network.trim() ? { network: network.trim() } : {}),
          ...(debouncedSearch ? { q: debouncedSearch } : {})
        }
      });
      setPayload(response.data);
    } catch (requestError) {
      setPayload(null);
      setError(extractMessage(requestError, "Failed to load the deposit queue"));
    } finally {
      setLoading(false);
    }
  }, [filter, asset, network, debouncedSearch, page, reloadToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (depositId: string) => {
    setDetailLoading(true);
    try {
      const response = await api.get<AdminDepositDetail>(
        `/deposits/admin/${encodeURIComponent(depositId)}`
      );
      setDetail(response.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const toggleExpanded = (depositId: string) => {
    setReason("");
    setActionError(null);
    setActionMessage(null);
    setExpanded((current) => {
      const next = current === depositId ? null : depositId;
      if (next) {
        void loadDetail(next);
      } else {
        setDetail(null);
      }
      return next;
    });
  };

  const runAction = async (
    depositId: string,
    action: "approve" | "reject" | "rescan"
  ): Promise<void> => {
    setBusy(`${action}:${depositId}`);
    setActionError(null);
    setActionMessage(null);
    try {
      const response = await api.post(
        `/deposits/admin/${encodeURIComponent(depositId)}/${action}`,
        action === "reject" ? { reason: reason.trim() } : reason.trim() ? { reason: reason.trim() } : {}
      );
      if (action === "approve") {
        setActionMessage(
          response.data?.credited
            ? "Deposit approved — the wallet was credited exactly once."
            : "Deposit approved. No additional credit was applied."
        );
      } else if (action === "reject") {
        setActionMessage("Deposit rejected. No wallet credit was applied.");
      } else {
        setActionMessage("On-chain re-scan complete. The queue has been refreshed.");
      }
      setReason("");
      await load();
      if (expanded === depositId) {
        await loadDetail(depositId);
      }
    } catch (requestError) {
      setActionError(
        extractMessage(
          requestError,
          action === "approve"
            ? "Failed to approve that deposit"
            : action === "reject"
              ? "Failed to reject that deposit"
              : "Failed to re-scan that deposit"
        )
      );
    } finally {
      setBusy(null);
    }
  };

  const totalPages = useMemo(() => {
    if (!payload) {
      return 1;
    }
    return Math.max(1, Math.ceil(payload.total / payload.pageSize));
  }, [payload]);

  const reasonValid = reason.trim().length >= 3;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
              Status
            </span>
            <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto">
              <div className="min-w-max">
                <SegmentedControl
                  ariaLabel="Crypto deposit status filter"
                  options={FILTER_OPTIONS}
                  value={filter}
                  onChange={(value) => {
                    setFilter(value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
              Filters
            </span>
            <select
              value={asset}
              onChange={(event) => {
                setAsset(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none focus:border-[#C6A15B]/60 sm:w-36"
            >
              {ASSET_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>
                  {value || "All assets"}
                </option>
              ))}
            </select>
            <input
              value={network}
              onChange={(event) => {
                setNetwork(event.target.value);
                setPage(1);
              }}
              placeholder="Network"
              className="w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none focus:border-[#C6A15B]/60 sm:w-40"
            />
            <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Reference, hash, user email or name"
                className="w-full rounded-xl border border-[#26272B] bg-[#0F0F10] py-1.5 pl-9 pr-3 text-xs text-[#F5F5F7] outline-none focus:border-[#C6A15B]/60"
              />
            </div>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              disabled={loading}
              className="btn btn-sm btn-secondary w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              )}
              Refresh
            </button>
          </div>
        </div>
      </Panel>

      {payload ? (
        <Panel className="min-w-0">
          <StatStrip>
            {COUNT_KEYS.map((entry) => (
              <Stat
                key={entry.key}
                label={entry.label}
                value={String(payload.counts[entry.key] ?? 0)}
                tone={entry.key === "AWAITING_ADMIN_APPROVAL" ? "gold" : undefined}
              />
            ))}
          </StatStrip>
        </Panel>
      ) : null}

      {actionMessage ? (
        <p className="rounded-xl bg-[#16C784]/8 px-3 py-2.5 text-[11px] text-[#F5F5F7]">
          {actionMessage}
        </p>
      ) : null}
      {actionError ? <ErrorRow message={actionError} /> : null}

      <Panel className="p-0">
        {loading && !payload ? (
          <p className="px-5 py-6 text-xs text-[#9CA3AF]">Loading crypto deposits…</p>
        ) : error ? (
          <div className="p-4">
            <ErrorRow message={error} onRetry={() => setReloadToken((token) => token + 1)} />
          </div>
        ) : !payload || payload.deposits.length === 0 ? (
          <div className="px-5 py-4">
            <EmptyState title="No crypto deposits match these filters" />
          </div>
        ) : (
          <>
            <div className="divide-y divide-[#26272B]/60">
              {payload.deposits.map((row) => {
                const isExpanded = expanded === row.depositId;
                const approved = busy === `approve:${row.depositId}`;
                const rejected = busy === `reject:${row.depositId}`;
                const scanning = busy === `rescan:${row.depositId}`;
                const disabled = busy !== null;
                return (
                  <div key={row.depositId}>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.depositId)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-[#1F2023]/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-[#F5F5F7]">
                          {row.symbol} · {row.networkLabel}
                          <span className="ml-2 font-mono font-normal text-[#6B7280]">
                            {row.reference || "no reference"}
                          </span>
                        </span>
                        <span className="block truncate text-[10px] text-[#6B7280]">
                          {row.user ? `${row.user.name} · ${row.user.email}` : row.depositId} ·{" "}
                          {formatDateTime(row.createdAt)}
                        </span>
                      </span>
                      <span className="financial-figure text-xs text-[#F5F5F7]">
                        {row.expectedAmountLabel}
                      </span>
                      <StatusBadge tone={toneFor(row.detailedStatus)} label={row.statusLabel} />
                    </button>

                    {isExpanded ? (
                      <div className="space-y-3 border-t border-[#26272B]/60 bg-[#0F0F10]/40 px-4 py-3">
                        <p className="text-[11px] text-[#9CA3AF]">{row.statusMessage}</p>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <DetailField
                            label="Expected amount"
                            value={row.expectedAmountLabel}
                          />
                          <DetailField
                            label="Received amount"
                            value={
                              row.receivedAmount === null
                                ? "Not detected yet"
                                : `${formatNumber(row.receivedAmount, 8)} ${row.symbol}`
                            }
                          />
                          <DetailField
                            label="USD value"
                            value={row.usdAmount === null ? "Not recorded" : formatUsd(row.usdAmount)}
                          />
                          <DetailField
                            label="Confirmations"
                            value={`${row.confirmations} of ${row.minConfirmations} required`}
                          />
                          <DetailField
                            label="Receiving address"
                            value={row.receivingAddress ?? "Not configured"}
                          />
                          <DetailField
                            label="Memo / destination tag"
                            value={
                              row.memo
                                ? `${row.memoLabel ?? "Memo"}: ${row.memo}`
                                : `${row.networkLabel} does not use a memo or destination tag`
                            }
                          />
                          <DetailField
                            label="Detected"
                            value={row.detectedAt ? formatDateTime(row.detectedAt) : "Not detected"}
                          />
                          <DetailField
                            label="Verified"
                            value={row.verifiedAt ? formatDateTime(row.verifiedAt) : "Not verified"}
                          />
                          <DetailField
                            label="Approved"
                            value={row.approvedAt ? formatDateTime(row.approvedAt) : "Not approved"}
                          />
                          <DetailField
                            label="Expires"
                            value={row.expiresAt ? formatDateTime(row.expiresAt) : "—"}
                          />
                          <DetailField
                            label="Reviewed by"
                            value={row.reviewedBy ?? "Not reviewed"}
                          />
                          <DetailField
                            label="Reviewed at"
                            value={row.reviewedAt ? formatDateTime(row.reviewedAt) : "Not reviewed"}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                            Transaction hash
                          </span>
                          {row.txHash ? (
                            <>
                              <span className="break-all font-mono text-[11px] text-[#9CA3AF]">
                                {truncateMiddle(row.txHash, 14, 10)}
                              </span>
                              <CopyButton value={row.txHash} label="Copy hash" />
                              {row.explorerUrl ? (
                                <a
                                  href={row.explorerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-[#C6A15B]"
                                >
                                  explorer
                                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                </a>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-[11px] text-[#9CA3AF]">
                              No hash recorded — scan the chain or reconcile manually.
                            </span>
                          )}
                        </div>

                        {row.rejectionReason ? (
                          <p className="rounded-xl bg-[#EA3943]/8 px-3 py-2.5 text-[11px] text-[#EA3943]">
                            {row.rejectionReason}
                          </p>
                        ) : null}

                        {detailLoading && !detail ? (
                          <p className="text-[11px] text-[#9CA3AF]">Loading approval history…</p>
                        ) : null}

                        {detail && detail.deposit.depositId === row.depositId ? (
                          <div className="space-y-2">
                            {detail.approvalBlockedReason ? (
                              <p className="rounded-xl bg-[#C6A15B]/8 px-3 py-2.5 text-[11px] text-[#F5F5F7]">
                                {detail.approvalBlockedReason}
                              </p>
                            ) : null}
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                                Approval audit trail
                              </p>
                              {detail.auditTrail.length === 0 ? (
                                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                                  No administrator decision recorded yet.
                                </p>
                              ) : (
                                <ul className="mt-1 space-y-1">
                                  {detail.auditTrail.map((entry) => (
                                    <li key={entry.auditId} className="text-[11px] text-[#9CA3AF]">
                                      <span className="font-mono text-[#F5F5F7]">{entry.action}</span> ·{" "}
                                      {entry.reason || "no reason recorded"} · admin {entry.adminId} ·{" "}
                                      {formatDateTime(entry.createdAt)}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <label
                            htmlFor={`deposit-reason-${row.depositId}`}
                            className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]"
                          >
                            Review reason (required to reject, optional to approve)
                          </label>
                          <input
                            id={`deposit-reason-${row.depositId}`}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            maxLength={500}
                            placeholder="Recorded in the audit log"
                            className="w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-2 text-xs text-[#F5F5F7] outline-none placeholder:text-[#6B7280] focus:border-[#C6A15B]/60"
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => runAction(row.depositId, "approve")}
                            disabled={disabled || !row.canApprove}
                            className="btn btn-sm bg-[#16C784]/12 text-[#16C784] hover:bg-[#16C784]/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {approved ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : null}
                            Approve &amp; credit
                          </button>
                          <button
                            type="button"
                            onClick={() => runAction(row.depositId, "reject")}
                            disabled={disabled || !row.canReject || !reasonValid}
                            className="btn btn-sm bg-[#EA3943]/12 text-[#EA3943] hover:bg-[#EA3943]/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {rejected ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : null}
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => runAction(row.depositId, "rescan")}
                            disabled={disabled}
                            className="btn btn-sm btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {scanning ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <ScanSearch className="h-3 w-3" aria-hidden="true" />
                            )}
                            Re-scan chain
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#26272B] px-4 py-3">
              <p className="text-[11px] text-[#6B7280]">
                {payload.total} deposits · page {payload.page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="btn btn-sm btn-secondary"
                >
                  <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className="btn btn-sm btn-secondary"
                >
                  Next
                  <ChevronRight className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
