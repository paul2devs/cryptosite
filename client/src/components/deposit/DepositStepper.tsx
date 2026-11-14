export type DepositStepState = "done" | "active" | "upcoming";

export interface DepositStep {
  id: string;
  label: string;
  state: DepositStepState;
}

const badgeClass: Record<DepositStepState, string> = {
  done: "bg-[#16C784]/12 text-[#16C784] ring-1 ring-inset ring-[#16C784]/30",
  active: "bg-[#C6A15B]/15 text-[#C6A15B] ring-1 ring-inset ring-[#C6A15B]/40",
  upcoming: "bg-[#26272B]/60 text-[#6B7280]"
};

const labelClass: Record<DepositStepState, string> = {
  done: "text-[#9CA3AF]",
  active: "text-[#F5F5F7]",
  upcoming: "text-[#6B7280]"
};

export function DepositStepper({ steps }: { steps: DepositStep[] }) {
  return (
    <ol className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
      {steps.map((step, index) => (
        <li key={step.id} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span
            className={`financial-figure inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${badgeClass[step.state]}`}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span
            className={`whitespace-nowrap text-[11px] font-medium ${labelClass[step.state]}`}
            aria-current={step.state === "active" ? "step" : undefined}
          >
            {step.label}
          </span>
          {index < steps.length - 1 ? (
            <span className="mx-0.5 h-px w-4 shrink-0 bg-[#26272B] sm:mx-1 sm:w-5" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
