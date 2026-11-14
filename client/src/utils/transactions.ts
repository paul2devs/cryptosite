import { api } from "./api";

export type TransactionTone = "neutral" | "positive" | "negative" | "gold";

export interface DepositRecord {
  deposit_id: string;
  user_id: string;
  crypto_type: string;
  amount: number;
  tx_hash: string | null;
  network: string | null;
  deposit_wallet: string | null;
  confirmation_count: number;
  confirmed_at: string | null;
  status: string;
  multiplier: number;
  pending_earning: number;
  timestamp: string;
  approved_at: string | null;
  total_earned: number;
}

export interface WithdrawalRecord {
  withdrawal_id: string;
  user_id: string;
  amount: number;
  status: string;
  asset: string | null;
  destination_address: string | null;
  network: string | null;
  network_fee: string;
  platform_fee: string;
  tx_hash: string | null;
  review_reason: string | null;
  detailed_status: string | null;
  processed_at: string | null;
  timestamp: string;
}

export interface TransactionRecord {
  id: string;
  kind: "deposit" | "withdrawal";
  title: string;
  detail: string;
  amount: number;
  asset: string;
  timestamp: string;
  statusLabel: string;
  tone: TransactionTone;
}

interface StatusDescriptor {
  label: string;
  tone: TransactionTone;
}

const WITHDRAWAL_STATUS: Record<string, StatusDescriptor> = {
  requested: { label: "Requested", tone: "gold" },
  under_review: { label: "Under review", tone: "gold" },
  approved: { label: "Approved", tone: "positive" },
  processing: { label: "Processing", tone: "gold" },
  completed: { label: "Completed", tone: "positive" },
  failed: { label: "Failed", tone: "negative" },
  rejected: { label: "Rejected", tone: "negative" }
};

function describeDeposit(deposit: DepositRecord): StatusDescriptor {
  if (deposit.status === "Approved") {
    return { label: "Confirmed", tone: "positive" };
  }
  if (deposit.status === "Rejected") {
    return { label: "Rejected", tone: "negative" };
  }
  return { label: "Pending", tone: "gold" };
}

function resolveWithdrawalState(withdrawal: WithdrawalRecord): string {
  if (withdrawal.detailed_status && WITHDRAWAL_STATUS[withdrawal.detailed_status]) {
    return withdrawal.detailed_status;
  }
  if (withdrawal.status === "Approved") {
    return "approved";
  }
  if (withdrawal.status === "Rejected") {
    return "rejected";
  }
  return "requested";
}

function describeWithdrawal(withdrawal: WithdrawalRecord): StatusDescriptor {
  return WITHDRAWAL_STATUS[resolveWithdrawalState(withdrawal)];
}

export function mapDepositToTransaction(deposit: DepositRecord): TransactionRecord {
  const status = describeDeposit(deposit);
  const network = deposit.network ? ` · ${deposit.network}` : "";
  return {
    id: deposit.deposit_id,
    kind: "deposit",
    title: "Deposit",
    detail: `${deposit.crypto_type}${network}`,
    amount: deposit.amount,
    asset: deposit.crypto_type,
    timestamp: deposit.timestamp,
    statusLabel: status.label,
    tone: status.tone
  };
}

export function mapWithdrawalToTransaction(withdrawal: WithdrawalRecord): TransactionRecord {
  const status = describeWithdrawal(withdrawal);
  const asset = withdrawal.asset || "USDT";
  const network = withdrawal.network ? ` · ${withdrawal.network}` : "";
  return {
    id: withdrawal.withdrawal_id,
    kind: "withdrawal",
    title: "Withdrawal",
    detail: `${asset}${network}`,
    amount: withdrawal.amount,
    asset,
    timestamp: withdrawal.timestamp,
    statusLabel: status.label,
    tone: status.tone
  };
}

export function buildTransactionHistory(
  deposits: DepositRecord[],
  withdrawals: WithdrawalRecord[]
): TransactionRecord[] {
  const merged = [
    ...deposits.map(mapDepositToTransaction),
    ...withdrawals.map(mapWithdrawalToTransaction)
  ];
  return merged.sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
  );
}

export async function fetchUserTransactions(): Promise<TransactionRecord[]> {
  const [depositResponse, withdrawalResponse] = await Promise.all([
    api.get<DepositRecord[]>("/deposits/me"),
    api.get<WithdrawalRecord[]>("/withdrawals/me")
  ]);
  return buildTransactionHistory(depositResponse.data, withdrawalResponse.data);
}

export type TransactionCategory =
  | "deposit"
  | "bonus"
  | "reward"
  | "withdrawal"
  | "investment"
  | "distribution"
  | "fee"
  | "adjustment"
  | "other";

export type TransactionDirection = "in" | "out" | "internal";

export type TransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "rejected"
  | "cancelled";

export interface TransactionView {
  reference: string;
  category: TransactionCategory;
  type: string;
  typeLabel: string;
  asset: string;
  amount: string;
  direction: TransactionDirection;
  status: TransactionStatus;
  statusLabel: string;
  network: string | null;
  txHash: string | null;
  explorerUrl: string | null;
  destinationAddress: string | null;
  sourceAddress: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  relatedReference: string | null;
  failureReason: string | null;
  description: string;
  externalCashFlow: boolean;
  fees?: string | null;
  netAmount?: string | null;
}

export interface TransactionSummary {
  confirmedDeposits: string;
  completedWithdrawals: string;
  pendingCount: number;
  totalCount: number;
  periodStart: string | null;
  periodEnd: string;
}

export interface TransactionFeedQuery {
  range?: string;
  category?: string;
  status?: string;
  search?: string;
  asset?: string;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

export interface TransactionListResponse {
  summary: TransactionSummary;
  page: number;
  pageSize: number;
  total: number;
  transactions: TransactionView[];
  reportingPeriod: string;
}

export type TransactionEventSource = "record" | "audit" | "activity";

export interface TransactionProcessingEvent {
  id: string;
  type: string;
  source: TransactionEventSource;
  timestamp: string | null;
  detail: string;
}

export interface TransactionDetailResponse {
  transaction: TransactionView;
  processingEvents: TransactionProcessingEvent[];
}

export interface AdminTransactionView extends TransactionView {
  userId: string;
  userEmail: string;
}

export interface AdminTransactionListResponse {
  summary: TransactionSummary;
  page: number;
  pageSize: number;
  total: number;
  transactions: AdminTransactionView[];
}

export interface AdminTransactionQuery extends TransactionFeedQuery {
  userId?: string;
}

export interface ReconciliationIssue {
  code: string;
  reference: string;
  detail: string;
}

export interface TransactionReconciliationResult {
  scope: string;
  depositsChecked: number;
  withdrawalsChecked: number;
  mismatched: number;
  issues: ReconciliationIssue[];
}

export interface PerformanceReconciliationResult {
  date: string;
  checked: number;
  mismatched: number;
  correctionsRecorded: number;
  issues: ReconciliationIssue[];
}

export interface ReconciliationHistoryEntry {
  auditId: string;
  adminId: string;
  action: string;
  scope: string;
  reason: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

const STATUS_TONE: Record<TransactionStatus, TransactionTone> = {
  pending: "gold",
  processing: "gold",
  completed: "positive",
  failed: "negative",
  rejected: "negative",
  cancelled: "neutral"
};

const DIRECTION_TONE: Record<TransactionDirection, TransactionTone> = {
  in: "positive",
  out: "neutral",
  internal: "neutral"
};

export function transactionStatusTone(status: TransactionStatus): TransactionTone {
  return STATUS_TONE[status] ?? "neutral";
}

export function transactionDirectionTone(direction: TransactionDirection): TransactionTone {
  return DIRECTION_TONE[direction] ?? "neutral";
}

export function isTransactionSettled(transaction: TransactionView): boolean {
  return transaction.status === "completed";
}

function buildQueryString(query: TransactionFeedQuery): string {
  const params = new URLSearchParams();
  if (query.range) params.set("range", query.range);
  if (query.category) params.set("category", query.category);
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  if (query.asset) params.set("asset", query.asset);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  return params.toString();
}

export async function fetchTransactionFeed(
  query: TransactionFeedQuery = {}
): Promise<TransactionListResponse> {
  const response = await api.get<TransactionListResponse>(
    `/operations/transactions?${buildQueryString(query)}`
  );
  return response.data;
}

export async function fetchTransactionDetail(reference: string): Promise<TransactionDetailResponse> {
  const response = await api.get<TransactionDetailResponse>(
    `/operations/transactions/${encodeURIComponent(reference)}`
  );
  return response.data;
}

export async function fetchAdminTransactions(
  query: AdminTransactionQuery = {}
): Promise<AdminTransactionListResponse> {
  const queryString = buildQueryString(query);
  const suffix = query.userId ? `&userId=${encodeURIComponent(query.userId)}` : "";
  const response = await api.get<AdminTransactionListResponse>(
    `/operations/admin/transactions?${queryString}${suffix}`
  );
  return response.data;
}

export async function runTransactionReconciliation(
  userId?: string
): Promise<TransactionReconciliationResult> {
  const response = await api.post<TransactionReconciliationResult>(
    "/operations/admin/reconcile/transactions",
    userId ? { userId } : {}
  );
  return response.data;
}

export async function runPerformanceReconciliation(
  date: string
): Promise<PerformanceReconciliationResult> {
  const response = await api.post<PerformanceReconciliationResult>(
    "/operations/admin/reconcile/performance",
    { date }
  );
  return response.data;
}

export async function fetchReconciliationHistory(): Promise<ReconciliationHistoryEntry[]> {
  const response = await api.get<ReconciliationHistoryEntry[]>("/operations/admin/reconcile/history");
  return response.data;
}
