import { useId, type ReactElement } from "react";

export type TierEmblemSize = "sm" | "md" | "lg";

type EmblemFinish = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "private";

const FINISH_SEQUENCE: EmblemFinish[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
  "private"
];

const FINISH_CLASS: Record<EmblemFinish, string> = {
  bronze: "emblem-bronze",
  silver: "emblem-silver",
  gold: "emblem-gold",
  platinum: "emblem-platinum",
  diamond: "emblem-diamond",
  private: "emblem-private"
};

/* Each tier resolves to a distinct silhouette. The CSS clip-path shapes the
   metallic gradient surface while the SVG overlay (OUTLINE) draws the matching
   faceted silhouette for depth. */
const SILHOUETTE: Record<EmblemFinish, string> = {
  bronze: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
  silver: "polygon(50% 0%, 100% 16%, 100% 62%, 50% 100%, 0% 62%, 0% 16%)",
  gold: "polygon(8% 30%, 29% 54%, 50% 13%, 71% 54%, 92% 30%, 92% 88%, 8% 88%)",
  platinum: "polygon(29% 0%, 71% 0%, 100% 29%, 100% 71%, 71% 100%, 29% 100%, 0% 71%, 0% 29%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  private: "circle(50% at 50% 50%)"
};

const OUTLINE: Record<EmblemFinish, ReactElement> = {
  bronze: <path d="M24 2 L44.6 12 L44.6 36 L24 46 L3.4 36 L3.4 12 Z" />,
  silver: <path d="M24 2 L45 8 L45 28 Q45 41 24 46 Q3 41 3 28 L3 8 Z" />,
  gold: <path d="M3.8 14.4 L13.9 25.9 L24 6.2 L34.1 25.9 L44.2 14.4 L44.2 42.2 L3.8 42.2 Z" />,
  platinum: <path d="M13.9 3 L34.1 3 L45 13.9 L45 34.1 L34.1 45 L13.9 45 L3 34.1 L3 13.9 Z" />,
  diamond: <path d="M24 2 L46 24 L24 46 L2 24 Z" />,
  private: <circle cx="24" cy="24" r="21" />
};

const SIZE_CLASS: Record<TierEmblemSize, string> = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-20 w-20 sm:h-24 sm:w-24"
};

const MONOGRAM_SIZE: Record<TierEmblemSize, string> = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-xl sm:text-[26px]"
};

const DARK_MONOGRAM = "text-[#0F0F10]/90";
const LIGHT_MONOGRAM = "text-[#F5F5F7] drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]";

function resolveFinish(tierName: string, order: number): EmblemFinish {
  const normalized = tierName.toLowerCase();
  const matched = FINISH_SEQUENCE.find((finish) => normalized.includes(finish));
  if (matched) {
    return matched;
  }
  const safeOrder = Number.isFinite(order) ? Math.abs(Math.trunc(order)) : 0;
  return FINISH_SEQUENCE[safeOrder % FINISH_SEQUENCE.length];
}

function deriveMonogram(tierName: string, order: number): string {
  const match = tierName.match(/[A-Za-z0-9]/);
  if (match) {
    return match[0].toUpperCase();
  }
  const safeOrder = Number.isFinite(order) ? Math.abs(Math.trunc(order)) : 0;
  return String(safeOrder);
}

export interface TierEmblemProps {
  tierName: string;
  order: number;
  locked?: boolean;
  size?: TierEmblemSize;
}

export function TierEmblem({ tierName, order, locked = false, size = "md" }: TierEmblemProps) {
  const rawId = useId();
  const gradientId = `emblem-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const finish = resolveFinish(tierName, order);
  const surfaceClass = locked ? "emblem-locked" : FINISH_CLASS[finish];
  const monogramTone = locked || finish === "bronze" ? LIGHT_MONOGRAM : DARK_MONOGRAM;
  const outline = OUTLINE[finish];
  const strokeOuter = locked ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.42)";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${SIZE_CLASS[size]} ${surfaceClass} transition-transform duration-300 ease-out motion-safe:hover:scale-105 motion-reduce:transition-none`}
      style={{ clipPath: SILHOUETTE[finish], WebkitClipPath: SILHOUETTE[finish] }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${gradientId}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </linearGradient>
          <radialGradient id={`${gradientId}-glow`} cx="34%" cy="26%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="48" height="48" fill={`url(#${gradientId}-sheen)`} opacity={locked ? 0.22 : 0.44} />
        <rect width="48" height="48" fill={`url(#${gradientId}-glow)`} opacity={locked ? 0.12 : 0.4} />
        <g stroke={strokeOuter} strokeWidth="0.9" strokeLinejoin="round">
          {outline}
        </g>
        <g
          stroke="rgba(0,0,0,0.24)"
          strokeWidth="0.8"
          strokeLinejoin="round"
          transform="translate(24 24) scale(0.6) translate(-24 -24)"
        >
          {outline}
        </g>
      </svg>
      <span
        className={`display-font relative z-10 font-semibold tracking-tight ${MONOGRAM_SIZE[size]} ${monogramTone}`}
      >
        {deriveMonogram(tierName, order)}
      </span>
    </span>
  );
}
