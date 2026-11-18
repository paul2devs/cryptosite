import { api } from "./api";
import type { Tone } from "../components/dashboard/primitives";

export type BalanceAdjustmentType =
  | "credit"
  | "debit"
  | "investment_allocation"
  | "investment_deallocation"
  | "correction"
  | "reversal";

export type BalanceAdjustmentDirection = "credit" | "debit";

export type BalanceAdjustmentStatus = "applied" | "reversed";

export const REQUESTABLE_ADJUSTMENT_TYPES: BalanceAdjustmentType[] = [
  "credit",
  "debit",
  "investment_allocation",
  "investment_deallocation",
  "correction"
];

export const BALANCE_ADJUSTMENT_LABEL: Record<BalanceAdjustmentType, string> = {
  credit: "Credit",
  debit: "Debit",
  investment_allocation: "Investment allocation",
  investment_deallocation: "Investment deallocation",
  correction: "Correction",
  reversal: "Reversal"
};

export interface BalancePositionView {
  positionId: string;
  asset: string;
  principal: string;
  currentValuation: string | null;
  verificationStatus: string;
  strategy: string;
  depositId: string | null;
}

export interface BalanceOverview {
  account: {
    userId: string;
    name: string | null;
    email: string;
    isAdmin: boolean;
    createdAt: string;
  };
  balance: {
    available: string;
    locked: string;
    ledgerAvailable: string;
  };
  totals: {
    totalDeposited: string;
    totalWithdrawn: string;
    pendingDepositCount: number;
    pendingDepositAmount: string;
    pendingWithdrawalCount: number;
    pendingWithdrawalAmount: string;
    activeInvestmentCount: number;
  };
  investment: {
    investedPrincipal: string;
    currentInvestmentValue: string;
    valuationComplete: boolean;
    unrealisedProfitLoss: string | null;
    totalRealisedProfitLoss: string;
    overallReturnPercent: string | null;
  };
  positions: BalancePositionView[];
  ledgerTotals: Record<string, string>;
}

export interface BalanceAdjustmentRecord {
  adjustmentId: string;
  userId: string;
  adminId: string;
  type: BalanceAdjustmentType;
  typeLabel: string;
  direction: BalanceAdjustmentDirection;
  amount: string;
  asset: string;
  balanceBefore: string;
  balanceAfter: string;
  principalBefore: string;
  principalAfter: string;
  positionId: string | null;
  reason: string;
  note: string | null;
  reference: string;
  reversalOf: string | null;
  reversedBy: string | null;
  status: BalanceAdjustmentStatus;
  createdAt: string;
  userEmail?: string | null;
  userName?: string | null;
  adminEmail?: string | null;
  adminName?: string | null;
}

export interface BalanceAdjustmentPage {
  page: number;
  pageSize: number;
  total: number;
  adjustments: BalanceAdjustmentRecord[];
}

export interface ApplyBalanceAdjustmentInput {
  userId: string;
  type: BalanceAdjustmentType;
  amount: string;
  direction?: BalanceAdjustmentDirection | null;
  reason: string;
  note?: string | null;
  positionId?: string | null;
  asset?: string | null;
  idempotencyKey?: string;
}

export interface ApplyBalanceAdjustmentResult {
  adjustment: BalanceAdjustmentRecord;
  overview: BalanceOverview;
}

const TONE: Record<BalanceAdjustmentType, Tone> = {
  credit: "positive",
  debit: "negative",
  investment_allocation: "gold",
  investment_deallocation: "gold",
  correction: "neutral",
  reversal: "negative"
};

export function adjustmentTone(type: BalanceAdjustmentType): Tone {
  return TONE[type] ?? "neutral";
}

export function adjustmentLabel(type: BalanceAdjustmentType): string {
  return BALANCE_ADJUSTMENT_LABEL[type] ?? type;
}

export async function fetchBalanceOverview(userId: string): Promise<BalanceOverview> {
  const response = await api.get<BalanceOverview>(
    `/operations/admin/balance/users/${userId}/overview`
  );
  return response.data;
}

export async function fetchBalanceAdjustments(
  query: {
    page?: number;
    pageSize?: number;
    userId?: string;
    type?: string;
    status?: string;
    from?: string;
    to?: string;
    reference?: string;
  } = {}
): Promise<BalanceAdjustmentPage> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.userId) params.set("userId", query.userId);
  if (query.type) params.set("type", query.type);
  if (query.status) params.set("status", query.status);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.reference) params.set("reference", query.reference);
  const response = await api.get<BalanceAdjustmentPage>(
    `/operations/admin/balance/adjustments?${params.toString()}`
  );
  return response.data;
}

export async function applyBalanceAdjustment(
  input: ApplyBalanceAdjustmentInput
): Promise<ApplyBalanceAdjustmentResult> {
  const { idempotencyKey, ...body } = input;
  const response = await api.post<ApplyBalanceAdjustmentResult>(
    "/operations/admin/balance/adjustments",
    body,
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined
  );
  return response.data;
}

export async function reverseBalanceAdjustment(
  adjustmentId: string,
  reason: string,
  note?: string | null
): Promise<ApplyBalanceAdjustmentResult> {
  const response = await api.post<ApplyBalanceAdjustmentResult>(
    `/operations/admin/balance/adjustments/${adjustmentId}/reverse`,
    { reason, note: note ?? null }
  );
  return response.data;
}
