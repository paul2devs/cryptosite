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

export interface DepositSubmissionPayload {
  crypto_type: CryptoType;
  amount: number;
  tx_hash: string;
  /** USD value the user entered; re-validated against the backend rate. */
  usd_amount: number;
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
  submitDeposit: (payload: DepositSubmissionPayload) => Promise<DepositRecord>;
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

  const submitDeposit = useCallback(
    async (payload: DepositSubmissionPayload) => {
      setSubmitting(true);
      try {
        const response = await api.post<DepositRecord>("/deposits", payload);
        const created = response.data;
        setDeposits((previous) => [created, ...previous]);
        void loadConfig();
        void loadDeposits();
        return created;
      } finally {
        setSubmitting(false);
      }
    },
    [loadConfig, loadDeposits]
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
    submitDeposit,
    refresh
  };
}
