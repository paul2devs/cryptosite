import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../utils/api";
import type { WithdrawalRecord } from "../utils/transactions";
import type { WithdrawCryptoType } from "../utils/withdraw";

export interface SupportedWithdrawalNetwork {
  cryptoType: WithdrawCryptoType;
  platformAsset: string;
  networkLabel: string;
  networkType: string;
  decimals: number;
  networkFee: number;
  minAmount: number;
  maxAmount: number;
}

export interface SupportedWithdrawalAsset {
  symbol: string;
  name: string;
  networks: SupportedWithdrawalNetwork[];
}

export interface WithdrawalEligibility {
  canWithdraw: boolean;
  levelMet: boolean;
  balanceAvailable: boolean;
  cooldownCleared: boolean;
  reasons: string[];
}

export interface MaturityEligibility {
  policyInEffect: boolean;
  policyVersion: string;
  lockupDays: number;
  effectiveAt: string | null;
  startDate: string | null;
  expectedMaturityDate: string | null;
  remainingSeconds: number;
  maturingAmount: number;
  maturedAmount: number;
  eligibleAtMaturity: number;
  reason: string;
  terms: string;
}

export interface WithdrawalDepositLevel {
  level: number;
  total_deposited_usd: number;
  current_level_required_total: number;
  next_level: number | null;
  next_level_required_total: number | null;
  remaining_to_next: number | null;
}

export interface WithdrawalSummary {
  withdrawable_balance: number;
  locked_balance: number;
  invested_balance: number;
  pending_withdrawal_amount: number;
  pending_earnings_total: number;
  total_account_balance: number;
  user_level: number;
  min_level: number;
  cooldown_seconds_remaining: number;
  deposit_level: WithdrawalDepositLevel;
  supported_assets: SupportedWithdrawalAsset[];
  platform_fee_percent: number;
  eligibility: WithdrawalEligibility;
  maturity: MaturityEligibility;
  min_withdrawal_amount: number;
}

export interface WithdrawalSubmissionPayload {
  asset: WithdrawCryptoType;
  network: string;
  address: string;
  amount: number;
  idempotencyKey: string;
}

export interface WithdrawData {
  summary: WithdrawalSummary | null;
  withdrawals: WithdrawalRecord[];
  loading: boolean;
  historyLoading: boolean;
  summaryError: string | null;
  historyError: string | null;
  submitting: boolean;
  submitWithdrawal: (payload: WithdrawalSubmissionPayload) => Promise<WithdrawalRecord>;
  refresh: () => void;
  refreshHistory: () => void;
}

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeNetworks(raw: unknown): SupportedWithdrawalNetwork[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => {
    const item = entry as Record<string, unknown>;
    return {
      cryptoType: String(item.cryptoType) as WithdrawCryptoType,
      platformAsset: String(item.platformAsset ?? ""),
      networkLabel: String(item.networkLabel ?? ""),
      networkType: String(item.networkType ?? ""),
      decimals: toNumber(item.decimals),
      networkFee: toNumber(item.networkFee),
      minAmount: toNumber(item.minAmount),
      maxAmount: toNumber(item.maxAmount)
    };
  });
}

function normalizeSummary(raw: Record<string, unknown>): WithdrawalSummary {
  const depositLevel = (raw.deposit_level ?? {}) as Record<string, unknown>;
  const eligibility = (raw.eligibility ?? {}) as Record<string, unknown>;
  const maturity = (raw.maturity ?? {}) as Record<string, unknown>;
  const reasons = Array.isArray(eligibility.reasons)
    ? eligibility.reasons.filter((value): value is string => typeof value === "string")
    : [];
  const supportedAssets = Array.isArray(raw.supported_assets)
    ? raw.supported_assets.map((entry) => {
        const item = entry as Record<string, unknown>;
        return {
          symbol: String(item.symbol ?? ""),
          name: String(item.name ?? ""),
          networks: normalizeNetworks(item.networks)
        };
      })
    : [];

  return {
    withdrawable_balance: toNumber(raw.withdrawable_balance),
    locked_balance: toNumber(raw.locked_balance),
    invested_balance: toNumber(raw.invested_balance),
    pending_withdrawal_amount: toNumber(raw.pending_withdrawal_amount),
    pending_earnings_total: toNumber(raw.pending_earnings_total),
    total_account_balance: toNumber(raw.total_account_balance),
    user_level: toNumber(raw.user_level),
    min_level: toNumber(raw.min_level),
    cooldown_seconds_remaining: toNumber(raw.cooldown_seconds_remaining),
    deposit_level: {
      level: toNumber(depositLevel.level),
      total_deposited_usd: toNumber(depositLevel.total_deposited_usd),
      current_level_required_total: toNumber(depositLevel.current_level_required_total),
      next_level: toNullableNumber(depositLevel.next_level),
      next_level_required_total: toNullableNumber(depositLevel.next_level_required_total),
      remaining_to_next: toNullableNumber(depositLevel.remaining_to_next)
    },
    supported_assets: supportedAssets,
    platform_fee_percent: toNumber(raw.platform_fee_percent),
    eligibility: {
      canWithdraw: eligibility.canWithdraw === true,
      levelMet: eligibility.levelMet === true,
      balanceAvailable: eligibility.balanceAvailable === true,
      cooldownCleared: eligibility.cooldownCleared === true,
      reasons
    },
    maturity: {
      policyInEffect: maturity.policyInEffect === true,
      policyVersion: String(maturity.policyVersion ?? "v1"),
      lockupDays: toNumber(maturity.lockupDays),
      effectiveAt: typeof maturity.effectiveAt === "string" ? maturity.effectiveAt : null,
      startDate: typeof maturity.startDate === "string" ? maturity.startDate : null,
      expectedMaturityDate:
        typeof maturity.expectedMaturityDate === "string" ? maturity.expectedMaturityDate : null,
      remainingSeconds: toNumber(maturity.remainingSeconds),
      maturingAmount: toNumber(maturity.maturingAmount),
      maturedAmount: toNumber(maturity.maturedAmount),
      eligibleAtMaturity: toNumber(maturity.eligibleAtMaturity),
      reason: String(maturity.reason ?? ""),
      terms: String(maturity.terms ?? "")
    },
    min_withdrawal_amount: toNumber(raw.min_withdrawal_amount)
  };
}

export function useWithdrawData(): WithdrawData {
  const [summary, setSummary] = useState<WithdrawalSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const summaryLoaded = useRef(false);

  const loadSummary = useCallback(async () => {
    if (!summaryLoaded.current) {
      setLoading(true);
    }
    try {
      const response = await api.get<Record<string, unknown>>("/withdrawals/summary");
      setSummary(normalizeSummary(response.data));
      setSummaryError(null);
    } catch (requestError) {
      setSummary(null);
      setSummaryError(
        extractMessage(requestError, "Your withdrawal summary is unavailable right now.")
      );
    } finally {
      summaryLoaded.current = true;
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await api.get<WithdrawalRecord[]>("/withdrawals/me");
      setWithdrawals(Array.isArray(response.data) ? response.data : []);
      setHistoryError(null);
    } catch (requestError) {
      setHistoryError(
        extractMessage(requestError, "We could not load your withdrawal history right now.")
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const refresh = useCallback(() => {
    void loadSummary();
    void loadHistory();
  }, [loadSummary, loadHistory]);

  const refreshHistory = useCallback(() => {
    void loadHistory();
  }, [loadHistory]);

  const submitWithdrawal = useCallback(
    async (payload: WithdrawalSubmissionPayload) => {
      setSubmitting(true);
      try {
        const response = await api.post<WithdrawalRecord>("/withdrawals", {
          asset: payload.asset,
          network: payload.network,
          address: payload.address,
          amount: payload.amount,
          idempotencyKey: payload.idempotencyKey
        });
        const created = response.data;
        setWithdrawals((previous) => {
          const withoutDuplicate = previous.filter(
            (item) => item.withdrawal_id !== created.withdrawal_id
          );
          return [created, ...withoutDuplicate];
        });
        void loadSummary();
        void loadHistory();
        return created;
      } finally {
        setSubmitting(false);
      }
    },
    [loadSummary, loadHistory]
  );

  const orderedSummary = useMemo(() => summary, [summary]);

  return {
    summary: orderedSummary,
    withdrawals,
    loading,
    historyLoading,
    summaryError,
    historyError,
    submitting,
    submitWithdrawal,
    refresh,
    refreshHistory
  };
}
