import { Plus } from "lucide-react";
import { FAQ_ITEMS } from "./landingContent";
import { LandingSection } from "./landingPrimitives";

/**
 * The FAQ carries the technical detail that no longer belongs on the landing
 * narrative: deposit steps, on-chain verification, levels, rewards, maturity
 * and withdrawals. It is the right place for that precision, and the marketing
 * sections stay focused on what the platform offers.
 */
export function LandingFaq() {
  return (
    <LandingSection
      id="faq"
      eyebrow="Questions, answered"
      title="The detail behind the platform."
      lede="Deposits, verification, levels, rewards and withdrawals, explained plainly. If anything is still unclear, support can walk you through it from inside your account."
    >
      <div className="max-w-3xl">
        {FAQ_ITEMS.map((item) => (
          <details key={item.id} className="group border-b border-[#1F2023]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14px] font-medium tracking-tight text-[#F5F5F7] [&::-webkit-details-marker]:hidden">
              <span>{item.question}</span>
              <Plus
                className="h-4 w-4 shrink-0 text-[#6B7280] transition-transform duration-200 group-open:rotate-45"
                aria-hidden="true"
              />
            </summary>
            <p className="pb-5 pr-8 text-xs leading-relaxed text-[#9CA3AF]">{item.answer}</p>
          </details>
        ))}
      </div>
    </LandingSection>
  );
}
