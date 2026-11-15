import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  useLiveMarket,
  type LiveMarketSymbol,
  type LiveMarketSnapshot
} from "../../hooks/useLiveMarket";
import { MARKET_SYMBOLS } from "./landingContent";

/**
 * Shared building blocks for the public landing page.
 *
 * The composition style is deliberately restrained: open, divided layouts with
 * a single surface colour, hairline separators and one accent (gold), instead
 * of a card per fact. Every animated element is disabled when the visitor
 * prefers reduced motion.
 */

export const landingContainer = "mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8";

export const LANDING_MARKET_SYMBOLS: LiveMarketSymbol[] = [...MARKET_SYMBOLS];

export function useLandingMarket(): {
  data: LiveMarketSnapshot;
  loading: boolean;
  error: string | null;
} {
  const { data, loading, error } = useLiveMarket(LANDING_MARKET_SYMBOLS);
  return { data, loading, error };
}

export function formatLivePrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) {
    return "—";
  }
  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (price >= 1) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }
  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  })}`;
}

export function formatChange(change: number): string {
  if (!Number.isFinite(change)) {
    return "—";
  }
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";
  return `${sign}${Math.abs(change).toFixed(2)}%`;
}

export function changeTone(change: number): "up" | "down" | "flat" {
  if (!Number.isFinite(change) || change === 0) {
    return "flat";
  }
  return change > 0 ? "up" : "down";
}

/**
 * Scrolls to a landing section using the same fixed-header offset as the
 * navigation, and falls back to an instant jump when motion is reduced.
 */
export function scrollToLandingSection(id: string): void {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  const headerOffset = 72;
  const top = window.scrollY + element.getBoundingClientRect().top - headerOffset;
  const prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top, behavior: prefersReduced ? "auto" : "smooth" });
}

export function Reveal({
  children,
  delay = 0,
  className = ""
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-medium uppercase tracking-[0.22em] text-[#C6A15B] ${className}`}>
      {children}
    </p>
  );
}

/**
 * A landing section with an optional editorial header. Sections are separated
 * by a hairline rather than a heavy border, and each carries its own generous
 * vertical rhythm so the page breathes.
 */
export function LandingSection({
  id,
  eyebrow,
  title,
  lede,
  children,
  className = "",
  headerClassName = "",
  contentClassName = "",
  first = false
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  lede?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  first?: boolean;
}) {
  const hasHeader = Boolean(eyebrow || title || lede);
  return (
    <section
      id={id}
      className={`scroll-mt-20 ${first ? "" : "border-t border-[#1B1C1F]"} ${className}`}
    >
      <div className={`${landingContainer} py-16 sm:py-24`}>
        {hasHeader ? (
          <Reveal className={`max-w-3xl ${headerClassName}`}>
            {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
            {title ? (
              <h2 className="display-font mt-3 text-[26px] font-semibold leading-[1.15] tracking-tight text-[#F5F5F7] sm:text-4xl">
                {title}
              </h2>
            ) : null}
            {lede ? (
              <p className="mt-4 text-sm leading-relaxed text-[#9CA3AF] sm:text-[15px]">{lede}</p>
            ) : null}
          </Reveal>
        ) : null}
        <div className={`${hasHeader ? "mt-10 sm:mt-14" : ""} ${contentClassName}`}>{children}</div>
      </div>
    </section>
  );
}
