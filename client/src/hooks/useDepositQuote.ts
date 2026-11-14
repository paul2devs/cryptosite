import { useCallback, useEffect, useState } from "react";
import { api } from "../utils/api";
import { ERRORS } from "../constants/copy";
import type { CryptoType } from "../utils/deposit";

/**
 * Snapshot returned by `GET /api/deposits/quote`. Every field is derived from
 * the backend pricing service — the client never computes or hardcodes rates.
 */
export interface DepositQuote {
  available: boolean;
  reason: string | null;
  cryptoType: string;
  symbol: string;
  network: string;
  decimals: number;
  usdAmount: number | null;
  cryptoAmount: number | null;
  cryptoAmountLabel: string | null;
  rate: number | null;
  rateSource: string | null;
  rateUpdatedAt: string | null;
  stale: boolean;
  minUsd: number;
  maxUsd: number;
  feeUsd: number;
  feeNote: string;
  networkFeeNote: string;
  estimatedReceivedLabel: string | null;
}

const DEBOUNCE_MS = 250;

export interface DepositQuoteState {
  quote: DepositQuote | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetch the USD→crypto conversion for a deposit. Re-runs whenever the selected
 * asset/network changes or the USD amount changes (debounced), so the estimated
 * crypto amount always reflects the current verified rate.
 */
export function useDepositQuote(
  cryptoType: CryptoType,
  usdAmount: number | null
): DepositQuoteState {
  const [quote, setQuote] = useState<DepositQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => {
    setNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get<DepositQuote>("/deposits/quote", {
          params: {
            crypto_type: cryptoType,
            ...(usdAmount !== null ? { usd_amount: usdAmount } : {})
          }
        });
        if (!cancelled) {
          setQuote(response.data);
          setError(null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(ERRORS.pricingUnavailable);
          setQuote(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [cryptoType, usdAmount, nonce]);

  return { quote, loading, error, refresh };
}
