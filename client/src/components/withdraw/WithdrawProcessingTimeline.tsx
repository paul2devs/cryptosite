import { Panel, SectionHeader } from "../dashboard/primitives";

const TIMELINE_STEPS: Array<{ title: string; detail: string }> = [
  {
    title: "Requested",
    detail: "Your details are validated and the amount is reserved from your matured balance."
  },
  {
    title: "Under review",
    detail: "Our team reviews the request for security. No amount is deducted twice during this stage."
  },
  {
    title: "Approved · Processing",
    detail: "Once approved, the payout is broadcast to the selected network and a transaction hash is recorded."
  },
  {
    title: "Completed",
    detail: "The withdrawal is marked complete only after the transaction is verified on-chain."
  }
];

/**
 * Describes the real processing stages the backend drives a withdrawal through.
 * No fixed durations are promised: completion is only confirmed on-chain.
 */
export function WithdrawProcessingTimeline() {
  return (
    <Panel className="space-y-4">
      <SectionHeader
        eyebrow="Processing"
        title="How your withdrawal is processed"
        description="These are the stages your request moves through. Completion is only confirmed once the transaction is verified on-chain."
      />

      <ol className="space-y-3">
        {TIMELINE_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex flex-col items-center">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#C6A15B]/12 text-[11px] font-medium text-[#C6A15B]">
                {index + 1}
              </span>
              {index < TIMELINE_STEPS.length - 1 ? (
                <span className="mt-1 h-full w-px flex-1 bg-[#26272B]" aria-hidden="true" />
              ) : null}
            </span>
            <div className="min-w-0 space-y-0.5 pb-1">
              <p className="text-xs font-medium text-[#F5F5F7]">{step.title}</p>
              <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-[11px] leading-relaxed text-[#6B7280]">
        If a request is rejected or fails on-chain, the reserved amount is released back to your
        available balance automatically and the reason is recorded on your account.
      </p>
    </Panel>
  );
}
