import { Loader2 } from "lucide-react";
import {
  EmptyState,
  ErrorRow,
  ListRow,
  Panel,
  Section,
  SectionHeader,
  StatusBadge
} from "../dashboard/primitives";
import { formatDateTime } from "../../utils/format";
import type { InvestmentBenefit, InvestmentLevelData } from "../../hooks/useInvestmentLevelData";
import { benefitStateMeta } from "./investmentLevelUtils";

function dotColor(benefit: InvestmentBenefit): string {
  if (benefit.state === "active") return "bg-[#16C784]";
  if (benefit.state === "requires_activation") return "bg-[#C6A15B]";
  if (benefit.state === "locked") return "bg-[#4B5563]";
  return "bg-[#6B7280]";
}

function BenefitRow({
  benefit,
  activatingBenefitId,
  onActivate
}: {
  benefit: InvestmentBenefit;
  activatingBenefitId: string | null;
  onActivate: (benefitId: string) => void;
}) {
  const meta = benefitStateMeta(benefit.state);
  const isActivating = activatingBenefitId === benefit.benefitId;

  return (
    <ListRow>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor(benefit)}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-[#F5F5F7]">{benefit.name}</p>
          <StatusBadge tone={meta.tone} label={meta.label} />
        </div>
        <p className="text-xs leading-relaxed text-[#9CA3AF]">{benefit.description}</p>
        <p className="text-[11px] text-[#6B7280]">
          From {benefit.applicableLevelName ?? "your level"} and above
          {benefit.requiresActivation ? " · requires activation" : ""}
          {benefit.state === "active" && benefit.activatedAt
            ? ` · active since ${formatDateTime(benefit.activatedAt)}`
            : ""}
        </p>
      </div>
      {benefit.state === "requires_activation" ? (
        <button
          type="button"
          disabled={isActivating}
          onClick={() => onActivate(benefit.benefitId)}
          className="btn btn-secondary btn-sm shrink-0"
        >
          {isActivating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : null}
          {isActivating ? "Activating" : "Activate"}
        </button>
      ) : null}
    </ListRow>
  );
}

export function LevelBenefitsSection({
  data,
  activatingBenefitId,
  activationError,
  onActivate,
  onRetry
}: {
  data: InvestmentLevelData;
  activatingBenefitId: string | null;
  activationError: string | null;
  onActivate: (benefitId: string) => void;
  onRetry: () => void;
}) {
  const available = data.benefits.filter((benefit) => benefit.state !== "locked");
  const locked = data.benefits.filter((benefit) => benefit.state === "locked");

  return (
    <Section id="investment-level-benefits">
      <Panel className="space-y-5">
        <SectionHeader
          eyebrow="Unlocks"
          title="What your level unlocks"
          description="Benefits are configured by the platform and only list what is genuinely delivered on your account. A higher investment level never promises investment performance."
        />

        {activationError ? <ErrorRow message={activationError} onRetry={onRetry} /> : null}

        {data.benefits.length === 0 ? (
          <EmptyState
            title="No benefits are configured"
            description="The platform has not published any investment level benefits yet."
          />
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">At your level</p>
              <div className="mt-1">
                {available.length === 0 ? (
                  <p className="py-2 text-[11px] text-[#9CA3AF]">
                    No benefits are available until an investment level is assigned.
                  </p>
                ) : (
                  available.map((benefit) => (
                    <BenefitRow
                      key={benefit.benefitId}
                      benefit={benefit}
                      activatingBenefitId={activatingBenefitId}
                      onActivate={onActivate}
                    />
                  ))
                )}
              </div>
            </div>

            {locked.length > 0 ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                  Unlocks at higher levels
                </p>
                <div className="mt-1">
                  {locked.map((benefit) => (
                    <BenefitRow
                      key={benefit.benefitId}
                      benefit={benefit}
                      activatingBenefitId={activatingBenefitId}
                      onActivate={onActivate}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Panel>
    </Section>
  );
}
