import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchRewardDashboard,
  redeemUserReward,
  type RewardDashboard
} from "../utils/rewards";

export interface RewardsDataState {
  data: RewardDashboard | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  redeemingId: string | null;
  redemptionError: string | null;
  redemptionNotice: string | null;
  redeem: (userRewardId: string) => Promise<boolean>;
}

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

export function useRewardsData(): RewardsDataState {
  const [data, setData] = useState<RewardDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);
  const [redemptionNotice, setRedemptionNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await fetchRewardDashboard();
      setData(dashboard);
    } catch (requestError) {
      setData(null);
      setError(extractMessage(requestError, "Rewards information is unavailable."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const redeem = useCallback(
    async (userRewardId: string): Promise<boolean> => {
      setRedeemingId(userRewardId);
      setRedemptionError(null);
      setRedemptionNotice(null);
      try {
        const result = await redeemUserReward(userRewardId);
        setRedemptionNotice(
          `${result.name} redeemed. ${result.amount} ${result.asset} is now in your available balance.`
        );
        await load();
        return true;
      } catch (requestError) {
        setRedemptionError(extractMessage(requestError, "This reward could not be redeemed."));
        return false;
      } finally {
        setRedeemingId(null);
      }
    },
    [load]
  );

  return useMemo(
    () => ({
      data,
      loading,
      error,
      reload: () => void load(),
      redeemingId,
      redemptionError,
      redemptionNotice,
      redeem
    }),
    [data, loading, error, load, redeemingId, redemptionError, redemptionNotice, redeem]
  );
}
