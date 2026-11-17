import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../utils/api";
import { ERRORS } from "../constants/copy";
import type { CryptoType } from "../utils/deposit";

/**
 * Snapshot returned by `GET /api/deposits/quote`. Every field is derived from
 * the backend pricing service; the client never computes or hardcodes rates.
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
  /** True when the shown rate is served from cache rather than fetched live. */
  cached: boolean;
  minUsd: number;
  maxUsd: number;
  feeUsd: number;
  feeNote: string;
  networkFeeNote: string;
  estimatedReceivedLabel: string | null;
}

/**
 * Amount edits are coalesced so a new rate is fetched once the user pauses, not
 * on every keystroke. The interval keeps a displayed rate from going stale while
 * the user is on the amount step.
 */
const DEBOUNCE_MS = 250;
const AUTO_REFRESH_MS = 60_000;

export interface DepositQuoteState {
  quote: DepositQuote | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function isAbortError(error: unknown): boolean {
  const candidate = error as { code?: string; name?: string } | undefined;
  return (
    candidate?.code === "ERR_CANCELED" ||
    candidate?.name === "CanceledError" ||
    candidate?.name === "AbortError"
  );
}

/**
 * Fetch the USD→crypto conversion for a deposit. Re-runs whenever the selected
 * asset/network changes or the USD amount changes (debounced), so the estimated
 * crypto amount always reflects the current verified rate. Requests are
 * sequenced so a slow response can never overwrite a newer result.
 */
export function useDepositQuote(
  cryptoType: CryptoType,
  usdAmount: number | null
): DepositQuoteState {
  const [quote, setQuote] = useState<DepositQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const requestSeq = useRef(0);

  const refresh = useCallback(() => {
    setNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    const sequence = requestSeq.current + 1;
    requestSeq.current = sequence;
    let cancelled = false;
    const controller = new AbortController();

    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get<DepositQuote>("/deposits/quote", {
          params: {
            crypto_type: cryptoType,
            ...(usdAmount !== null ? { usd_amount: usdAmount } : {})
          },
          signal: controller.signal
        });
        if (cancelled || sequence !== requestSeq.current) {
          return;
        }
        setQuote(response.data);
        setError(null);
      } catch (requestError) {
        if (cancelled || sequence !== requestSeq.current || isAbortError(requestError)) {
          return;
        }
        setError(ERRORS.rateUnavailable.title);
        setQuote(null);
      } finally {
        if (!cancelled && sequence === requestSeq.current) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [cryptoType, usdAmount, nonce]);

  // Keep the displayed rate fresh: a rate that goes stale is replaced by the
  // next automatic refresh rather than being left on screen as if it were live.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        setNonce((current) => current + 1);
      }
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  return { quote, loading, error, refresh };
}
