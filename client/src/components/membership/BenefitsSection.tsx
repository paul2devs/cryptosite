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
import type { BenefitState, MembershipBenefit, MembershipData } from "../../hooks/useMembershipData";
import { benefitStateMeta } from "./membershipUtils";

const GROUPS: Array<{ state: BenefitState; label: string }> = [
  { state: "active", label: "Active now" },
  { state: "requires_activation", label: "Ready to activate" },
  { state: "unavailable", label: "Not currently provided" },
  { state: "locked", label: "Available at higher tiers" }
];

function BenefitRow({
  benefit,
  isActivating,
  onActivate
}: {
  benefit: MembershipBenefit;
  isActivating: boolean;
  onActivate: (benefitId: string) => void;
}) {
  const meta = benefitStateMeta(benefit.state);

  return (
    <ListRow>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-[#F5F5F7]">{benefit.name}</p>
          <StatusBadge tone={meta.tone} label={meta.label} />
        </div>
        <p className="text-xs leading-relaxed text-[#9CA3AF]">{benefit.description}</p>
        <p className="text-[11px] text-[#6B7280]">
          Included from {benefit.applicableTierName ?? "your tier"} and above
          {benefit.requiresActivation ? " · requires activation" : ""}
        </p>
        {benefit.state === "active" && benefit.activatedAt ? (
          <p className="text-[11px] text-[#16C784]">
            Active since {formatDateTime(benefit.activatedAt)}
          </p>
        ) : null}
      </div>
      {benefit.state === "requires_activation" ? (
        <button
          type="button"
          disabled={isActivating}
          onClick={() => onActivate(benefit.benefitId)}
          className="btn btn-sm btn-secondary shrink-0"
        >
          {isActivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          {isActivating ? "Activating" : "Activate"}
        </button>
      ) : null}
    </ListRow>
  );
}

export function BenefitsSection({
  data,
  activatingBenefitId,
  activationError,
  onActivate,
  onRetry
}: {
  data: MembershipData;
  activatingBenefitId: string | null;
  activationError: string | null;
  onActivate: (benefitId: string) => void;
  onRetry: () => void;
}) {
  const groups = GROUPS.map((group) => ({
    ...group,
    items: data.benefits.filter((benefit) => benefit.state === group.state)
  })).filter((group) => group.items.length > 0);

  return (
    <Section id="membership-benefits">
      <Panel className="space-y-5">
        <SectionHeader
          eyebrow="Benefits"
          title="Your benefits"
          description="Only benefits genuinely delivered on your account are listed."
        />

        {activationError ? <ErrorRow message={activationError} onRetry={onRetry} /> : null}

        {data.benefits.length === 0 ? (
          <EmptyState
            title="No benefits configured"
            description="The platform has not published membership benefits yet."
          />
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.state} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
                    {group.label}
                  </p>
                  <span className="financial-figure text-[10px] text-[#6B7280]">
                    {group.items.length}
                  </span>
                </div>
                <div>
                  {group.items.map((benefit) => (
                    <BenefitRow
                      key={benefit.benefitId}
                      benefit={benefit}
                      isActivating={activatingBenefitId === benefit.benefitId}
                      onActivate={onActivate}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </Section>
  );
}
