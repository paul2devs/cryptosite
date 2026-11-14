import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";

export type InvestmentBenefitState = "locked" | "unavailable" | "requires_activation" | "active";
export type InvestmentJourneyState = "completed" | "current" | "upcoming" | "locked";
export type InvestmentLevelSource = "automatic" | "admin" | "recalculation";

export interface InvestmentQualificationMetric {
  code: string;
  label: string;
  description: string;
}

export interface InvestmentLevelRules {
  qualificationMetric: InvestmentQualificationMetric;
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

export interface InvestmentLevelStatus {
  code: string;
  label: string;
  description: string;
}

export interface InvestmentCurrentLevel {
  levelId: string;
  name: string;
  levelNumber: number;
  description: string;
  threshold: string;
  icon: string;
  theme: { accent?: string };
  benefits: string[];
  achievedAt: string | null;
  source: "automatic" | "admin";
  manualReason: string | null;
  manualSetAt: string | null;
  isHighestLevel: boolean;
}

export interface InvestmentLevelBenefitRef {
  benefitId: string;
  name: string;
  description: string;
  requiresActivation: boolean;
  state: InvestmentBenefitState;
}

export interface InvestmentJourneyLevel {
  levelId: string;
  name: string;
  levelNumber: number;
  description: string;
  icon: string;
  theme: { accent?: string };
  threshold: string;
  effectiveFrom: string | null;
  state: InvestmentJourneyState;
  requirement: string;
  benefits: InvestmentLevelBenefitRef[];
}

export interface InvestmentBenefit {
  benefitId: string;
  code: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  requiresActivation: boolean;
  state: InvestmentBenefitState;
  applicableLevelId: string;
  applicableLevelName: string | null;
  applicableLevelNumber: number | null;
  activatedAt: string | null;
}

export interface InvestmentNextLevelBenefit {
  benefitId: string;
  name: string;
  description: string;
  requiresActivation: boolean;
}

export interface InvestmentComparison {
  levels: Array<{
    levelId: string;
    name: string;
    levelNumber: number;
    threshold: string;
    isCurrent: boolean;
  }>;
  benefits: Array<{
    benefitId: string;
    name: string;
    description: string;
    category: string;
    requiresActivation: boolean;
    includedInLevelIds: string[];
    availableAtCurrentLevel: boolean;
  }>;
}

export interface InvestmentHistoryEntry {
  historyId: string;
  fromLevelId: string | null;
  toLevelId: string | null;
  fromLevelNumber: number | null;
  toLevelNumber: number | null;
  fromLevelName: string | null;
  toLevelName: string | null;
  qualifyingAmount: string;
  reason: string;
  source: InvestmentLevelSource;
  actorAdminId: string | null;
  createdAt: string;
}

export interface InvestmentLevelData {
  qualificationMetric: InvestmentQualificationMetric;
  rules: InvestmentLevelRules;
  qualifyingAmount: string | null;
  qualifyingComplete: boolean;
  explanation: string;
  status: InvestmentLevelStatus;
  current: InvestmentCurrentLevel | null;
  next: { levelId: string; name: string; levelNumber: number; threshold: string } | null;
  nextLevelBenefits: InvestmentNextLevelBenefit[];
  remainingToNext: string | null;
  progressPercent: number;
  topLevelReached: boolean;
  levels: InvestmentJourneyLevel[];
  benefits: InvestmentBenefit[];
  comparison: InvestmentComparison;
  history: InvestmentHistoryEntry[];
}

export interface ActivatedInvestmentBenefit {
  benefitId: string;
  code: string;
  name: string;
  requiresActivation: boolean;
  activatedAt: string;
  alreadyActive: boolean;
}

export interface InvestmentLevelDataState {
  data: InvestmentLevelData | null;
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

export function useInvestmentLevelData(): InvestmentLevelDataState {
  const [data, setData] = useState<InvestmentLevelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingBenefitId, setActivatingBenefitId] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<InvestmentLevelData>("/operations/investment-level");
      setData(response.data);
    } catch (requestError) {
      setData(null);
      setError(extractMessage(requestError, "Investment level information is unavailable."));
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
        await api.post<ActivatedInvestmentBenefit>(
          `/operations/investment-level/benefits/${benefitId}/activate`
        );
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
