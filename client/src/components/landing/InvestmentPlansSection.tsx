import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { DISCLOSURES } from "../../constants/copy";
import {
  DEPOSIT_USD_MAX,
  DEPOSIT_USD_MIN,
  INVESTMENT_LEVELS
} from "./landingContent";
import { Eyebrow, Reveal, landingContainer } from "./landingPrimitives";
import { GlowOrb } from "./landingArtwork";
import { LevelEmblem } from "../investment/LevelEmblem";

/**
 * SECTION A. Investment opportunities.
 *
 * Sits directly beneath the hero and answers the visitor's real question:
 * "what investment options do you offer, and which one could work for me?"
 *
 * NexaCrypto does not sell fixed-return "plans". Its investment options are the
 * ten investment levels in `INVESTMENT_LEVELS`, which mirror the live
 * configuration in `server/src/services/investmentLevelService.ts`. Each level
 * is reached once approved, on-chain verified invested principal passes its
 * threshold and unlocks one account benefit. Nothing here is a rate, a return
 * or a duration: the value of invested capital follows the market price of the
 * assets held and can rise or fall.
 *
 * The layout is a comparison-first ledger rather than a row of pricing cards,
 * because the honest decision criteria are the amount that qualifies and the
 * access each level unlocks, not a headline percentage.
 */

/** Plain, financial formatting: "$1,000" with no decimals and no rounding drift. */
function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

export function InvestmentPlansSection() {
  const [openLevel, setOpenLevel] = useState<number | null>(null);

  const firstLevel = INVESTMENT_LEVELS[0];
  const lastLevel = INVESTMENT_LEVELS[INVESTMENT_LEVELS.length - 1];
  const hasLevels = INVESTMENT_LEVELS.length > 0;

  const facts = [
    {
      label: "Investment levels",
      value: hasLevels ? `${firstLevel.levelNumber} – ${lastLevel.levelNumber}` : "N/A"
    },
    { label: "Minimum deposit", value: formatUsd(DEPOSIT_USD_MIN) },
    {
      label: "Level 1 from",
      value: hasLevels ? `${formatUsd(firstLevel.thresholdUsd)} invested principal` : "N/A"
    },
    { label: "Maximum depositable", value: formatUsd(DEPOSIT_USD_MAX) }
  ];

  /**
   * The terms a visitor needs in order to compare honestly. Each entry defines
   * the term and then states how it actually applies on this platform, with
   * no implied guarantee and no fixed rate that does not exist.
   */
  const terms = [
    {
      term: "Investment amount",
      definition: "The capital you commit to your investment account.",
      applies: hasLevels
        ? `Deposits start at ${formatUsd(DEPOSIT_USD_MIN)} and are accepted up to ${formatUsd(DEPOSIT_USD_MAX)}. Investment levels are assigned from ${formatUsd(firstLevel.thresholdUsd)} to ${formatUsd(lastLevel.thresholdUsd)} of invested principal.`
        : "Deposits start at a configured minimum and levels are assigned from invested principal."
    },
    {
      term: "ROI, return on investment",
      definition:
        "The change in the value of what you invested, relative to the amount you put in.",
      applies:
        "Not fixed and never guaranteed. The value of your invested capital follows the market price of the assets you hold and can rise or fall. Projected figures are shown for context and are never credited as earnings."
    },
    {
      term: "Duration & maturity",
      definition:
        "How long capital is committed, and the date it becomes available again.",
      applies:
        "There is no fixed term and no maturity date. Investment levels are not time-locked products. A level reflects your current invested principal and can adjust if that changes."
    },
    {
      term: "Crediting",
      definition: "The moment a deposit is recognised in your balance.",
      applies:
        "Only after the platform verifies the transaction on-chain. A submitted deposit stays pending until that verification completes, and only then forms invested principal."
    },
    {
      term: "Withdrawal restrictions",
      definition: "Any conditions that apply before funds can leave your account.",
      applies:
        "Investment levels do not add a separate lock. Withdrawals follow the platform's standard request-and-status process, and qualification already earned is not removed by a later withdrawal."
    }
  ];

  return (
    <section
      id="plans"
      className="relative scroll-mt-20 overflow-hidden border-t border-[#1B1C1F] bg-[#0F0F10]"
    >
      <div className={`${landingContainer} relative py-16 sm:py-24`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-full"
        >
          <GlowOrb tone="gold" className="-left-32 top-4 h-72 w-72 opacity-30" />
        </div>

        <div className="relative">
          {/* Editorial header */}
          <Reveal className="max-w-3xl">
            <Eyebrow>Investment opportunities</Eyebrow>
            <h2 className="display-font mt-3 text-[30px] font-medium leading-[1.1] tracking-[-0.02em] text-[#F5F5F7] sm:text-[42px] lg:text-[52px]">
              Find an investment approach that fits your goals.
            </h2>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#9CA3AF] sm:text-[15px]">
              Explore our available investment plans, understand their terms, and choose an
              approach that aligns with your investment preferences.
            </p>
          </Reveal>

          {/* Real, current figures, drawn from the platform's own configuration */}
          <Reveal delay={0.05}>
            <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[#1F2023] py-6 sm:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                    {fact.label}
                  </dt>
                  <dd className="financial-figure mt-1.5 text-[15px] font-medium text-[#F5F5F7]">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          {/* The ledger: every available option, with enough room to compare */}
          <div className="mt-12 sm:mt-16">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">
                All investment levels · assigned from invested principal
              </p>
            </Reveal>

            {hasLevels ? (
              <ul className="mt-2">
                {INVESTMENT_LEVELS.map((level) => {
                  const open = openLevel === level.levelNumber;
                  return (
                    <li key={level.levelNumber} className="border-b border-[#1F2023]">
                      <Reveal>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenLevel(open ? null : level.levelNumber)
                          }
                          aria-expanded={open}
                          aria-controls={`plan-detail-${level.levelNumber}`}
                          className="group -mx-3 flex w-full items-start gap-4 rounded-2xl px-3 py-5 text-left transition-colors hover:bg-white/[0.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A15B]/50 sm:gap-6"
                        >
                          <LevelEmblem
                            levelName={level.name}
                            order={level.levelNumber}
                            size="sm"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                              <p className="display-font text-[15px] font-medium tracking-tight text-[#F5F5F7]">
                                {level.name}
                              </p>
                              <p className="financial-figure text-[15px] font-medium text-[#C6A15B]">
                                <span className="mr-2 text-[10px] font-normal uppercase tracking-[0.16em] text-[#6B7280]">
                                  from
                                </span>
                                {formatUsd(level.thresholdUsd)}
                              </p>
                            </div>

                            <p className="mt-1.5 text-xs leading-relaxed text-[#9CA3AF]">
                              {level.description}
                            </p>

                            <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#9CA3AF]">
                              <span className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                                Unlocks
                              </span>
                              <span className="text-[#F5F5F7]">{level.unlock.name}</span>
                              {level.unlock.requiresActivation ? (
                                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[#C6A15B]">
                                  <span
                                    aria-hidden="true"
                                    className="h-1 w-1 rounded-full bg-[#C6A15B]"
                                  />
                                  Activation required
                                </span>
                              ) : null}
                            </p>
                          </div>

                          <ChevronDown
                            aria-hidden="true"
                            className={`mt-1 h-4 w-4 shrink-0 text-[#6B7280] transition-transform duration-200 motion-reduce:transition-none ${
                              open ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        <div
                          id={`plan-detail-${level.levelNumber}`}
                          hidden={!open}
                          className="pb-6 pl-0 sm:pl-[4.25rem]"
                        >
                          <div className="card-quiet p-4 sm:p-5">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                              What it unlocks
                            </p>
                            <p className="display-font mt-1.5 text-[14px] font-medium text-[#F5F5F7]">
                              {level.unlock.name}
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                              {level.unlock.description}
                            </p>
                            <p className="mt-3 text-[11px] leading-relaxed text-[#6B7280]">
                              {level.unlock.requiresActivation
                                ? "Activation required. Enable it in your account to be included in the next cycle."
                                : "Included automatically while this level is assigned to your account."}
                            </p>
                          </div>
                        </div>
                      </Reveal>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-6 text-sm leading-relaxed text-[#9CA3AF]">
                Investment levels are not available right now. Please check back shortly.
              </p>
            )}

            <Reveal>
              <p className="mt-5 text-[11px] leading-relaxed text-[#6B7280]">
                Investment levels are assigned from your invested principal, the USD value of
                approved deposits verified on-chain. They are not a rate, a return or a lock.
              </p>
            </Reveal>
          </div>

          {/* How to compare: the criteria that actually decide, defined plainly */}
          <div className="mt-14 sm:mt-20">
            <Reveal>
              <h3 className="display-font text-[20px] font-medium tracking-tight text-[#F5F5F7] sm:text-[24px]">
                How to compare these options
              </h3>
            </Reveal>

            <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {terms.map((item, index) => (
                <Reveal key={item.term} delay={index * 0.04}>
                  <div className="border-t border-[#1F2023] pt-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#C6A15B]">
                      {item.term}
                    </p>
                    <p className="display-font mt-2 text-[14px] font-medium leading-snug text-[#F5F5F7]">
                      {item.definition}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                      {item.applies}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          {/* Restrained closing action. Every available option is shown above,
              so this links to the real next step rather than a redundant
              "see all plans" destination. */}
          <Reveal delay={0.05}>
            <div className="mt-14 flex flex-col gap-5 border-t border-[#1F2023] pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="display-font text-[15px] font-medium text-[#F5F5F7]">
                  An account is where an investment level begins
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                  Deposit a supported asset and your investment level is assigned automatically
                  from your verified invested principal.
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-[#6B7280]">
                  {DISCLOSURES.noGuarantee}
                </p>
              </div>
              <Link
                to="/register"
                className="nx-cta nx-cta-primary group shrink-0 self-start sm:self-auto"
              >
                Open an account
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
