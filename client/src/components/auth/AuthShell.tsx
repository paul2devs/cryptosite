import { ReactNode } from "react";
import { Atmosphere } from "../landing/landingArtwork";

/**
 * Shared layout for every authentication screen (login, registration and the
 * two password-recovery steps).
 *
 * It exists so all four screens inherit one premium language: the atmospheric
 * charcoal canvas, the gold accent and the same form surface. The public
 * `Layout` already renders the navigation bar and footer for these routes, so
 * this shell provides only the body between them.
 */

const ASSURANCES = [
  "Deposits are verified on-chain before they are credited.",
  "Balances are recorded as traceable ledger entries.",
  "Member tiers follow the USD value of your confirmed deposits."
];

export function AuthShell({
  eyebrow,
  headline,
  support,
  title,
  description,
  children,
  footer
}: {
  eyebrow: string;
  headline: ReactNode;
  support: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="landing-page page-responsive landing-atmosphere relative w-full overflow-hidden">
      <Atmosphere variant="dual" />
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
        <section className="hidden max-w-md flex-col space-y-7 lg:flex">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#C6A15B]">{eyebrow}</p>
          <h1 className="display-font text-[34px] font-semibold leading-[1.1] tracking-tight text-[#F5F5F7] xl:text-[42px]">
            {headline}
          </h1>
          <p className="text-sm leading-relaxed text-[#9CA3AF]">{support}</p>
          <ul className="space-y-3 pt-1">
            {ASSURANCES.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[13px] leading-relaxed text-[#C9CCD3]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C6A15B]" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full">
          <div className="mx-auto w-full max-w-md">
            <div className="glass rounded-3xl p-6 sm:p-8">
              <h2 className="display-font text-2xl font-semibold tracking-tight text-[#F5F5F7]">
                {title}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#9CA3AF]">{description}</p>
              <div className="mt-6">{children}</div>
            </div>
            {footer ? (
              <div className="mt-5 space-y-3 text-center text-[13px] text-[#9CA3AF]">{footer}</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
