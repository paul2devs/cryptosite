import { formatDecimal, parseDecimal } from "./money";

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

const EXPLORERS: Record<string, string> = {
  BTC: "https://blockchain.com/btc/tx/",
  BITCOIN: "https://blockchain.com/btc/tx/",
  ETH: "https://etherscan.io/tx/",
  ETHEREUM: "https://etherscan.io/tx/",
  ERC20: "https://etherscan.io/tx/",
  USDT_ERC20: "https://etherscan.io/tx/",
  BNB: "https://bscscan.com/tx/",
  BSC: "https://bscscan.com/tx/",
  SOL: "https://solscan.io/tx/",
  TRX: "https://tronscan.org/#/transaction/",
  TRC20: "https://tronscan.org/#/transaction/",
  USDT_TRC20: "https://tronscan.org/#/transaction/",
  XRP: "https://xrpscan.com/tx/"
};

export function explorerUrlFor(network: string | null | undefined, txHash: string | null | undefined): string | null {
  if (!network || !txHash || txHash.trim().length < 8) return null;
  const base = EXPLORERS[network.toUpperCase()];
  if (!base) return null;
  return `${base}${txHash.trim()}`;
}

export function shortenAddress(value: string | null | undefined, head = 6, tail = 4): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 3) return trimmed;
  return `${trimmed.slice(0, head)}…${trimmed.slice(-tail)}`;
}

export function maskAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-4)}`;
}

export function generateReference(sourceType: string, sourceId: string): string {
  const prefix = sourceType.slice(0, 3).toUpperCase();
  const compact = sourceId.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  return `${prefix}-${compact.slice(0, 10)}`;
}

export function normalizeDepositStatus(status: string): TransactionStatus {
  if (status === "Approved") return "completed";
  if (status === "Rejected") return "failed";
  if (status === "UnderReview") return "processing";
  return "pending";
}

const WITHDRAWAL_STATUS_MAP: Record<string, TransactionStatus> = {
  requested: "pending",
  under_review: "processing",
  approved: "processing",
  processing: "processing",
  completed: "completed",
  failed: "failed",
  rejected: "rejected",
  cancelled: "cancelled"
};

export function normalizeWithdrawalStatus(status: string, detailedStatus?: string | null): TransactionStatus {
  if (detailedStatus && WITHDRAWAL_STATUS_MAP[detailedStatus]) {
    return WITHDRAWAL_STATUS_MAP[detailedStatus];
  }
  if (status === "Approved") return "completed";
  if (status === "Rejected") return "rejected";
  return "pending";
}

export function withdrawalStatusLabel(status: string, detailedStatus?: string | null): string {
  const key = detailedStatus && WITHDRAWAL_STATUS_MAP[detailedStatus] ? detailedStatus : null;
  if (key === "requested") return "Requested";
  if (key === "under_review") return "Under review";
  if (key === "approved") return "Approved";
  if (key === "processing") return "Processing";
  if (key === "completed") return "Completed";
  if (key === "failed") return "Failed";
  if (key === "rejected") return "Rejected";
  if (key === "cancelled") return "Cancelled";
  if (status === "Approved") return "Completed";
  if (status === "Rejected") return "Rejected";
  return "Pending";
}

const LEDGER_TYPE_MAP: Record<string, { category: TransactionCategory; label: string; direction: TransactionDirection; external: boolean }> = {
  deposit_confirmed: { category: "deposit", label: "Deposit confirmed", direction: "in", external: true },
  promotional_bonus_credited: { category: "bonus", label: "Promotional bonus credited", direction: "in", external: false },
  reward_granted: { category: "reward", label: "Reward granted", direction: "in", external: false },
  reward_redeemed: { category: "reward", label: "Reward redeemed", direction: "in", external: false },
  withdrawal_reserved: { category: "withdrawal", label: "Withdrawal reserved", direction: "internal", external: false },
  withdrawal_completed: { category: "withdrawal", label: "Withdrawal completed", direction: "out", external: true },
  withdrawal_released: { category: "withdrawal", label: "Withdrawal released", direction: "internal", external: false },
  investment_allocation: { category: "investment", label: "Investment allocation", direction: "internal", external: false },
  investment_redemption: { category: "investment", label: "Investment redemption", direction: "internal", external: false },
  profit_distribution: { category: "distribution", label: "Realised profit distribution", direction: "internal", external: false },
  fee_charged: { category: "fee", label: "Fee charged", direction: "out", external: false },
  fee_refund: { category: "fee", label: "Fee refund", direction: "in", external: false },
  account_adjustment: { category: "adjustment", label: "Account adjustment", direction: "internal", external: false },
  adjustment_reversal: { category: "adjustment", label: "Adjustment reversal", direction: "internal", external: false }
};

export function classifyLedgerTransaction(transactionType: string): {
  category: TransactionCategory;
  label: string;
  direction: TransactionDirection;
  external: boolean;
} {
  const match = LEDGER_TYPE_MAP[transactionType];
  if (match) return match;
  return { category: "other", label: transactionType.replace(/_/g, " "), direction: "internal", external: false };
}

export function ledgerDirectionToFlow(direction: "debit" | "credit"): TransactionDirection {
  return direction === "credit" ? "in" : "out";
}

export function resolveDateRange(
  range: string,
  now: Date = new Date(),
  custom?: { from?: string | null; to?: string | null }
): { from: Date | null; to: Date } {
  const to = custom?.to ? new Date(custom.to) : now;
  const validTo = Number.isNaN(to.getTime()) ? now : to;
  if (range === "custom") {
    const from = custom?.from ? new Date(custom.from) : null;
    return { from: from && !Number.isNaN(from.getTime()) ? from : null, to: validTo };
  }
  const days: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  const span = days[range];
  if (!span) return { from: null, to: validTo };
  const from = new Date(validTo.getTime());
  if (range === "24h") from.setUTCHours(from.getUTCHours() - 24);
  else from.setUTCDate(from.getUTCDate() - span);
  return { from, to: validTo };
}

export function matchesSearch(row: TransactionView, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [
    row.reference,
    row.type,
    row.typeLabel,
    row.asset,
    row.network ?? "",
    row.txHash ?? "",
    row.destinationAddress ?? "",
    row.relatedReference ?? ""
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(trimmed);
}

export function summarizeTransactions(rows: TransactionView[], periodStart: Date | null, periodEnd: Date): TransactionSummary {
  let confirmedDeposits = 0n;
  let completedWithdrawals = 0n;
  let pendingCount = 0;
  for (const row of rows) {
    if (row.category === "deposit" && row.status === "completed") {
      confirmedDeposits += parseDecimal(row.amount, 8);
    }
    if (row.category === "withdrawal" && row.status === "completed") {
      completedWithdrawals += parseDecimal(row.amount, 8);
    }
    if (row.status === "pending" || row.status === "processing") {
      pendingCount += 1;
    }
  }
  return {
    confirmedDeposits: formatDecimal(confirmedDeposits, 8),
    completedWithdrawals: formatDecimal(completedWithdrawals, 8),
    pendingCount,
    totalCount: rows.length,
    periodStart: periodStart ? periodStart.toISOString() : null,
    periodEnd: periodEnd.toISOString()
  };
}

export function sortTransactionsByDate(rows: TransactionView[]): TransactionView[] {
  return [...rows].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

export function paginate<T>(rows: T[], page: number, pageSize: number): { rows: T[]; page: number; pageSize: number; total: number } {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const offset = (safePage - 1) * safeSize;
  return {
    rows: rows.slice(offset, offset + safeSize),
    page: safePage,
    pageSize: safeSize,
    total: rows.length
  };
}
