import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  DEPOSIT_USD_MAX,
  DEPOSIT_USD_MIN,
  INVESTMENT_LEVELS,
  SUPPORTED_ASSETS
} from "./landingContent";
import {
  Eyebrow,
  Reveal,
  landingContainer,
  scrollToLandingSection
} from "./landingPrimitives";
import { ProgressBar } from "../dashboard/primitives";
import { formatUsd } from "../../utils/format";

/**
 * SECTION B. How it works.
 *
 * Sits immediately after the Investment Plans section and answers the next
 * question: "how do I actually get started, fund it, track it, and get value
 * out?" Every step below mirrors the real implementation and describes only
 * what the platform genuinely does:
 *
 *  - Deposits are on-chain crypto transfers (BTC / ETH / SOL / USDT ERC-20 or
 *    TRC-20), verified on-chain before they are credited as invested principal
 *    (server/src/domain/depositRules.ts, blockchainVerificationService.ts).
 *  - There is no fixed rate, no guaranteed return, no automatic payout, no
 *    automatic renewal and no maturity date. The `illustrativeDailyRatePercent`
 *    setting is a modelled projection and is never credited
 *    (server/src/services/platformSettingsService.ts).
 *  - Withdrawals are requests, not unconditional transfers: eligibility depends
 *    on account state and every request is reviewed
 *    (server/src/services/withdrawalService.ts).
 *
 * The step 03 panel is a clearly labelled sample. It makes no API call and
 * never implies a real account.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * A single numbered stage. The marker sits on the vertical connector line so
 * the four stages read as one continuous process, and the two-column split on
 * desktop keeps the title beside its explanation.
 */
function StepItem({
  index,
  title,
  delay,
  last = false,
  children
}: {
  index: string;
  title: string;
  delay: number;
  last?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const className =
    "relative grid gap-x-10 gap-y-3 pb-12 pl-10 last:pb-0 lg:grid-cols-12 lg:pb-16 lg:pl-14";
  const body = (
    <>
      {!last ? (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[13px] top-7 w-px -translate-x-1/2 bg-gradient-to-b from-[#C6A15B]/35 to-[#C6A15B]/10 lg:left-[21px]"
        />
      ) : null}
      <span
        aria-hidden="true"
        className="absolute left-[13px] top-[7px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#C6A15B] shadow-[0_0_0_4px_rgba(198,161,91,0.12)] lg:left-[21px]"
      />
      <div className="lg:col-span-5">
        <p className="financial-figure text-[11px] tracking-[0.22em] text-[#C6A15B]">
          STEP {index}
        </p>
        <h3 className="display-font mt-2 text-[20px] font-medium leading-snug tracking-tight text-[#F5F5F7] sm:text-[24px]">
          {title}
        </h3>
      </div>
      <div className="lg:col-span-7">{children}</div>
    </>
  );

  if (reduceMotion) {
    return <li className={className}>{body}</li>;
  }

  return (
    <motion.li
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {body}
    </motion.li>
  );
}

export function HowItWorksSection() {
  const levelSix = INVESTMENT_LEVELS.find((level) => level.levelNumber === 6);
  const levelSeven = INVESTMENT_LEVELS.find((level) => level.levelNumber === 7);
  const hasLevelSample = Boolean(levelSix && levelSeven);

  // Example figure: a chosen principal sitting between two real thresholds.
  const SAMPLE_PRINCIPAL_USD = 13_500;
  const sampleFloorUsd = levelSix?.thresholdUsd ?? 0;
  const sampleCeilUsd = levelSeven?.thresholdUsd ?? 0;
  const samplePercent =
    sampleCeilUsd > sampleFloorUsd
      ? ((SAMPLE_PRINCIPAL_USD - sampleFloorUsd) / (sampleCeilUsd - sampleFloorUsd)) * 100
      : 0;

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 border-t border-[#1B1C1F] landing-band-deep"
    >
      <div className={`${landingContainer} py-16 sm:py-24`}>
        <Reveal className="max-w-3xl">
          <Eyebrow>The investment process</Eyebrow>
          <h2 className="display-font mt-3 text-[30px] font-medium leading-[1.1] tracking-[-0.02em] text-[#F5F5F7] sm:text-[42px] lg:text-[52px]">
            From choosing a plan to tracking your investment.
          </h2>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#9CA3AF] sm:text-[15px]">
            Getting started should be straightforward. Explore the available plans, fund your
            investment, and follow its progress through your NexaCrypto account.
          </p>
        </Reveal>

        <ol className="mt-12 sm:mt-16">
          <StepItem index="01" title="Choose your plan" delay={0}>
            <p className="text-sm leading-relaxed text-[#9CA3AF]">
              Every investment option is an investment level. Review what each level requires and
              what it unlocks, then decide how much invested principal you want to work toward. A
              level is only assigned once your own deposits have been approved and verified.
            </p>
          </StepItem>

          <StepItem index="02" title="Fund your investment" delay={0.06}>
            <p className="text-sm leading-relaxed text-[#9CA3AF]">
              Fund your account by sending a supported crypto asset on its own network to the
              deposit address shown in your account, then submit the transaction for verification.
              Deposits are accepted from {formatUsd(DEPOSIT_USD_MIN, 0)} to{" "}
              {formatUsd(DEPOSIT_USD_MAX, 0)}, and each one stays pending until it is verified
              on-chain. Only then is it credited as invested principal.
            </p>

            <div className="mt-5 border-t border-[#1F2023] pt-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                Supported deposit assets
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-7 gap-y-3">
                {SUPPORTED_ASSETS.map((asset) => (
                  <li key={asset.symbol} className="flex items-center gap-2.5">
                    <img src={asset.logo} alt="" aria-hidden="true" className="h-5 w-5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium text-[#F5F5F7]">
                        {asset.name}
                      </span>
                      <span className="block text-[10px] text-[#6B7280]">
                        {asset.networks.join(" · ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </StepItem>

          <StepItem index="03" title="Track your progress" delay={0.12}>
            <p className="text-sm leading-relaxed text-[#9CA3AF]">
              Your account is the single place to follow everything: confirmed balances, invested
              principal, progress toward the next investment level and live prices for the assets
              you hold. Portfolio and performance views break down your holdings and any
              independently verified performance, and your ledger records every deposit, withdrawal
              and level change.
            </p>

            {hasLevelSample ? (
              <div className="glass-quiet mt-5 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                    Investment level progress
                  </p>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#C6A15B]/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#C6A15B] ring-1 ring-inset ring-[#C6A15B]/25">
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#C6A15B]" />
                    Sample preview
                  </span>
                </div>
                <div className="mt-3.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="display-font text-sm font-medium text-[#F5F5F7]">
                    Level {levelSix?.levelNumber}
                  </p>
                  <p className="financial-figure text-[10px] text-[#9CA3AF]">
                    {formatUsd(SAMPLE_PRINCIPAL_USD, 0)} of {formatUsd(sampleCeilUsd, 0)} invested
                    principal
                  </p>
                </div>
                <ProgressBar value={samplePercent} tone="gold" className="mt-2.5" />
                <p className="mt-2.5 text-[10px] leading-relaxed text-[#6B7280]">
                  Sample layout only, not a real account and not NexaCrypto performance. Levels
                  advance from approved, on-chain verified invested principal.
                </p>
              </div>
            ) : null}
          </StepItem>

          <StepItem index="04" title="Returns and completion" delay={0.18} last>
            <p className="text-sm leading-relaxed text-[#9CA3AF]">
              Your invested capital tracks the market value of the assets you hold. Performance is
              recorded from independently verified valuations as they complete, and your account
              ledger reflects every change.
            </p>
          </StepItem>
        </ol>

        <Reveal delay={0.05}>
          <div className="mt-14 flex flex-col gap-5 border-t border-[#1F2023] pt-8 sm:flex-row sm:items-center sm:justify-between sm:gap-10">
            <div className="max-w-xl">
              <p className="display-font text-[16px] font-medium text-[#F5F5F7] sm:text-[18px]">
                Ready to explore your options?
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF] sm:text-[13px]">
                Take a closer look at the investment plans available on NexaCrypto.
              </p>
            </div>
            <button
              type="button"
              onClick={() => scrollToLandingSection("plans")}
              className="nx-cta nx-cta-primary group shrink-0 self-start sm:self-auto"
            >
              Explore investment plans
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
