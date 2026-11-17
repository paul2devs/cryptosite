import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import type { DepositRecord } from "../utils/transactions";
import type { CryptoType, PlatformAsset } from "../utils/deposit";

export interface DepositAddress {
  asset: PlatformAsset;
  name: string;
  address: string;
  network: string;
  networkType: string;
  qrCodeData: string;
}

export interface ActiveBonus {
  bonus_id: string;
  label: string;
  multiplier: number;
  start_time: string;
  end_time: string;
}

export interface DepositAccountSummary {
  withdrawableBalance: number;
  lockedBalance: number;
  depositLevel: number;
  totalDepositedUsd: number;
  depositCurrentLevelRequiredTotal: number;
  depositNextLevel: number | null;
  depositNextLevelRequiredTotal: number | null;
  depositRemainingToNext: number | null;
}

/**
 * Payment instructions returned by the backend when a pending deposit is
 * created. The receiving address, the exact amount to send, the unique
 * reference and the memo capability all come from the server; the client never
 * derives or invents any of them.
 */
export interface DepositPaymentInstructions {
  reference: string;
  depositId: string;
  cryptoType: CryptoType;
  platformAsset: string;
  symbol: string;
  networkLabel: string;
  networkType: string;
  receivingAddress: string;
  amountToSend: number;
  amountToSendLabel: string;
  usdAmount: number | null;
  memo: string | null;
  memoLabel: string | null;
  memoRequired: boolean;
  memoGuidance: string | null;
  memoSupported: boolean;
  minConfirmations: number;
  sendingInstruction: string;
  networkWarning: string;
  status: {
    detailed: string;
    coarse: string;
    label: string;
    tone: string;
    message: string;
  };
  transactionHash: string | null;
  receivedAmount: number | null;
  confirmations: number;
  detectedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  approvalRequired: boolean;
  rejectionReason: string | null;
}

export interface DepositCreationDiagnostics {
  reference: string;
  cryptoType: CryptoType;
  networkLabel: string;
  rateVerified: boolean;
  rateSource: string | null;
  rateReason: string | null;
  amountSource: "client" | "server-rate";
  reusedExisting: boolean;
  internalNotes: string[];
}

/** A pending deposit only needs the asset/network and an amount. */
export interface DepositSubmissionPayload {
  crypto_type: CryptoType;
  amount?: number | null;
  usd_amount?: number | null;
  memo?: string | null;
}

export interface CreatedDeposit {
  deposit: DepositRecord;
  instructions: DepositPaymentInstructions;
  diagnostics: DepositCreationDiagnostics;
}

export interface DepositVerificationSummary {
  success: boolean;
  stage: string;
  amount: number;
  toAddress: string;
  confirmations: number;
  failureReason?: string | null;
}

export interface TransactionSubmissionResult {
  deposit: DepositRecord;
  instructions: DepositPaymentInstructions;
  verification: DepositVerificationSummary | null;
  message: string;
}

export interface DepositRescanResult {
  deposit: DepositRecord;
  instructions: DepositPaymentInstructions | null;
  outcome: unknown;
}

interface XpLevelResponse {
  withdrawableBalance?: number;
  lockedBalance?: number;
  depositLevel?: number;
  totalDepositedUsd?: number;
  depositCurrentLevelRequiredTotal?: number;
  depositNextLevel?: number | null;
  depositNextLevelRequiredTotal?: number | null;
  depositRemainingToNext?: number | null;
}

export interface DepositData {
  addresses: DepositAddress[];
  deposits: DepositRecord[];
  account: DepositAccountSummary | null;
  bonuses: ActiveBonus[];
  loading: boolean;
  depositsLoading: boolean;
  addressesError: string | null;
  accountError: string | null;
  depositsError: string | null;
  submitting: boolean;
  submittingTransaction: boolean;
  createDeposit: (payload: DepositSubmissionPayload) => Promise<CreatedDeposit>;
  submitTransaction: (reference: string, txHash: string) => Promise<TransactionSubmissionResult>;
  rescanDeposit: (reference: string) => Promise<DepositRescanResult>;
  refreshDeposit: (reference: string) => Promise<DepositRecord | null>;
  refresh: () => void;
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

function toAccountSummary(raw: XpLevelResponse): DepositAccountSummary {
  return {
    withdrawableBalance: toNumber(raw.withdrawableBalance),
    lockedBalance: toNumber(raw.lockedBalance),
    depositLevel: toNumber(raw.depositLevel),
    totalDepositedUsd: toNumber(raw.totalDepositedUsd),
    depositCurrentLevelRequiredTotal: toNumber(raw.depositCurrentLevelRequiredTotal),
    depositNextLevel: toNullableNumber(raw.depositNextLevel),
    depositNextLevelRequiredTotal: toNullableNumber(raw.depositNextLevelRequiredTotal),
    depositRemainingToNext: toNullableNumber(raw.depositRemainingToNext)
  };
}

/**
 * A per-attempt idempotency key. It is stable for one user action so a
 * double-click or an automatic retry reuses the same pending deposit instead of
 * creating a second one.
 */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dep-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function useDepositData(): DepositData {
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [account, setAccount] = useState<DepositAccountSummary | null>(null);
  const [bonuses, setBonuses] = useState<ActiveBonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [depositsLoading, setDepositsLoading] = useState(true);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [depositsError, setDepositsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingTransaction, setSubmittingTransaction] = useState(false);
  const configLoaded = useRef(false);

  const loadConfig = useCallback(async () => {
    if (!configLoaded.current) {
      setLoading(true);
    }
    const [addressesResult, accountResult, bonusesResult] = await Promise.allSettled([
      api.get<DepositAddress[]>("/deposits/addresses"),
      api.get<XpLevelResponse>("/user/current_xp_level"),
      api.get<ActiveBonus[]>("/bonuses/active")
    ]);

    if (addressesResult.status === "fulfilled") {
      setAddresses(Array.isArray(addressesResult.value.data) ? addressesResult.value.data : []);
      setAddressesError(null);
    } else {
      setAddresses([]);
      setAddressesError(
        extractMessage(
          addressesResult.reason,
          "Deposit addresses are unavailable right now. Please try again."
        )
      );
    }

    if (accountResult.status === "fulfilled") {
      setAccount(toAccountSummary(accountResult.value.data));
      setAccountError(null);
    } else {
      setAccount(null);
      setAccountError(
        extractMessage(
          accountResult.reason,
          "Your balance summary is unavailable right now."
        )
      );
    }

    if (bonusesResult.status === "fulfilled") {
      setBonuses(Array.isArray(bonusesResult.value.data) ? bonusesResult.value.data : []);
    } else {
      setBonuses([]);
    }

    configLoaded.current = true;
    setLoading(false);
  }, []);

  const loadDeposits = useCallback(async () => {
    setDepositsLoading(true);
    try {
      const response = await api.get<DepositRecord[]>("/deposits/me");
      setDeposits(Array.isArray(response.data) ? response.data : []);
      setDepositsError(null);
    } catch (requestError) {
      setDepositsError(
        extractMessage(requestError, "We could not load your deposit history right now.")
      );
    } finally {
      setDepositsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    void loadDeposits();
  }, [loadDeposits]);

  const refresh = useCallback(() => {
    void loadConfig();
    void loadDeposits();
  }, [loadConfig, loadDeposits]);

  const upsertDeposit = useCallback((deposit: DepositRecord) => {
    setDeposits((previous) => {
      const without = previous.filter((item) => item.deposit_id !== deposit.deposit_id);
      return [deposit, ...without];
    });
  }, []);

  const createDeposit = useCallback(
    async (payload: DepositSubmissionPayload) => {
      setSubmitting(true);
      try {
        const response = await api.post<CreatedDeposit>("/deposits", payload, {
          headers: { "idempotency-key": newIdempotencyKey() }
        });
        upsertDeposit(response.data.deposit);
        void loadConfig();
        void loadDeposits();
        return response.data;
      } finally {
        setSubmitting(false);
      }
    },
    [loadConfig, loadDeposits, upsertDeposit]
  );

  const submitTransaction = useCallback(
    async (reference: string, txHash: string) => {
      setSubmittingTransaction(true);
      try {
        const response = await api.post<TransactionSubmissionResult>(
          `/deposits/${encodeURIComponent(reference)}/transaction`,
          { tx_hash: txHash }
        );
        upsertDeposit(response.data.deposit);
        void loadDeposits();
        return response.data;
      } finally {
        setSubmittingTransaction(false);
      }
    },
    [loadDeposits, upsertDeposit]
  );

  const rescanDeposit = useCallback(
    async (reference: string) => {
      setSubmittingTransaction(true);
      try {
        const response = await api.post<DepositRescanResult>(
          `/deposits/${encodeURIComponent(reference)}/rescan`,
          {}
        );
        upsertDeposit(response.data.deposit);
        return response.data;
      } finally {
        setSubmittingTransaction(false);
      }
    },
    [upsertDeposit]
  );

  const refreshDeposit = useCallback(
    async (reference: string) => {
      try {
        const response = await api.get<{
          deposit: DepositRecord;
          instructions: DepositPaymentInstructions;
        }>(`/deposits/${encodeURIComponent(reference)}`);
        upsertDeposit(response.data.deposit);
        return response.data.deposit;
      } catch {
        return null;
      }
    },
    [upsertDeposit]
  );

  return {
    addresses,
    deposits,
    account,
    bonuses,
    loading,
    depositsLoading,
    addressesError,
    accountError,
    depositsError,
    submitting,
    submittingTransaction,
    createDeposit,
    submitTransaction,
    rescanDeposit,
    refreshDeposit,
    refresh
  };
}
