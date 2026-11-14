export type WithdrawStepState = "done" | "active" | "upcoming";

export interface WithdrawStep {
  id: string;
  label: string;
  state: WithdrawStepState;
}

const circleClass: Record<WithdrawStepState, string> = {
  done: "bg-[#16C784]/12 text-[#16C784]",
  active: "bg-[#C6A15B]/15 text-[#C6A15B]",
  upcoming: "bg-[#26272B]/60 text-[#6B7280]"
};

const labelClass: Record<WithdrawStepState, string> = {
  done: "text-[#9CA3AF]",
  active: "text-[#F5F5F7]",
  upcoming: "text-[#6B7280]"
};

/**
 * Numbered progress indicator for the withdrawal flow. It scrolls horizontally
 * inside its own track when the steps do not fit, so it never forces the page
 * itself to overflow on small screens.
 */
export function WithdrawStepper({ steps }: { steps: WithdrawStep[] }) {
  return (
    <ol
      aria-label="Withdrawal progress"
      className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
    >
      {steps.map((step, index) => (
        <li key={step.id} className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${circleClass[step.state]}`}
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
            <span className="mx-1 h-px w-5 shrink-0 bg-[#26272B]" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
