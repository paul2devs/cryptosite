import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";

export type BenefitState = "locked" | "unavailable" | "requires_activation" | "active";
export type TierEligibility = "achieved" | "current" | "locked";
export type MembershipSource = "automatic" | "admin" | "recalculation";

export interface MembershipQualificationMetric {
  code: string;
  label: string;
  description: string;
}

export interface MembershipRules {
  qualificationMetric: MembershipQualificationMetric;
  creditedEvents: string[];
  excludedEvents: string[];
  automaticUpgrades: boolean;
  downgradesSupported: boolean;
  downgradePolicy: string;
  retentionPolicy: string;
  manualOverridePolicy: string;
  reviewPeriodDays: number | null;
  gracePeriodDays: number | null;
  minimumRetentionAmount: string | null;
}

export interface MembershipStatus {
  code: string;
  label: string;
  description: string;
}

export interface MembershipCurrentTier {
  tierId: string;
  name: string;
  description: string;
  benefits: string[];
  icon: string;
  theme: { accent?: string };
  achievedAt: string | null;
  minAmount: string;
  maxAmount: string | null;
  source: "automatic" | "admin";
  manualReason: string | null;
  manualSetAt: string | null;
  isHighestTier: boolean;
}

export interface MembershipTierBenefit {
  benefitId: string;
  name: string;
  description: string;
  requiresActivation: boolean;
  state: BenefitState;
}

export interface MembershipTierProgress {
  tierId: string;
  name: string;
  description: string;
  icon: string;
  theme: { accent?: string };
  minAmount: string;
  maxAmount: string | null;
  sortOrder: number;
  state: TierEligibility;
  requirement: string;
  benefits: MembershipTierBenefit[];
}

export interface MembershipBenefit {
  benefitId: string;
  code: string;
  name: string;
  description: string;
  available: boolean;
  requiresActivation: boolean;
  state: BenefitState;
  applicableTierId: string;
  applicableTierName: string | null;
  activatedAt: string | null;
}

export interface MembershipNextTierBenefit {
  benefitId: string;
  name: string;
  description: string;
  requiresActivation: boolean;
}

export interface MembershipComparison {
  tiers: Array<{
    tierId: string;
    name: string;
    minAmount: string;
    maxAmount: string | null;
    isCurrent: boolean;
  }>;
  benefits: Array<{
    benefitId: string;
    name: string;
    description: string;
    requiresActivation: boolean;
    includedInTierIds: string[];
    availableAtCurrentTier: boolean;
  }>;
}

export interface MembershipHistoryEntry {
  historyId: string;
  fromTierId: string | null;
  toTierId: string | null;
  fromTierName: string | null;
  toTierName: string | null;
  qualifyingAmount: string;
  reason: string;
  source: MembershipSource;
  actorAdminId: string | null;
  createdAt: string;
}

export interface MembershipData {
  qualificationMetric: MembershipQualificationMetric;
  rules: MembershipRules;
  qualifyingAmount: string | null;
  qualifyingComplete: boolean;
  explanation: string;
  status: MembershipStatus;
  current: MembershipCurrentTier | null;
  next: { tierId: string; name: string; minAmount: string } | null;
  nextTierBenefits: MembershipNextTierBenefit[];
  remainingToNext: string | null;
  progressPercent: number;
  topTierReached: boolean;
  tiers: MembershipTierProgress[];
  benefits: MembershipBenefit[];
  comparison: MembershipComparison;
  history: MembershipHistoryEntry[];
}

export interface ActivatedBenefit {
  benefitId: string;
  code: string;
  name: string;
  requiresActivation: boolean;
  activatedAt: string;
  alreadyActive: boolean;
}

export interface MembershipDataState {
  data: MembershipData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  activatingBenefitId: string | null;
  activationError: string | null;
  activateBenefit: (benefitId: string) => Promise<boolean>;
}

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

export function useMembershipData(): MembershipDataState {
  const [data, setData] = useState<MembershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingBenefitId, setActivatingBenefitId] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<MembershipData>("/operations/membership");
      setData(response.data);
    } catch (requestError) {
      setData(null);
      setError(extractMessage(requestError, "Membership information is unavailable."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activateBenefit = useCallback(
    async (benefitId: string): Promise<boolean> => {
      setActivatingBenefitId(benefitId);
      setActivationError(null);
      try {
        await api.post<ActivatedBenefit>(`/operations/membership/benefits/${benefitId}/activate`);
        await load();
        return true;
      } catch (requestError) {
        setActivationError(extractMessage(requestError, "The benefit could not be activated."));
        return false;
      } finally {
        setActivatingBenefitId(null);
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
      activatingBenefitId,
      activationError,
      activateBenefit
    }),
    [data, loading, error, load, activatingBenefitId, activationError, activateBenefit]
  );
}
