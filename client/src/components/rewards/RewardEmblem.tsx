import { useId, type ReactElement } from "react";
import type { RewardCategory } from "../../utils/rewards";

export type RewardEmblemSize = "sm" | "md" | "lg";

const SURFACE_CLASS: Record<RewardCategory, string> = {
  loyalty: "emblem-reward-loyalty",
  promotional: "emblem-reward-promotional",
  referral: "emblem-reward-referral",
  special: "emblem-reward-special"
};

/* Each reward category resolves to a distinct faceted silhouette so an
   available reward, a locked reward, and a membership tier never look alike. */
const SILHOUETTE: Record<RewardCategory, string> = {
  loyalty: "polygon(8% 20%, 50% 2%, 92% 20%, 92% 62%, 50% 98%, 8% 62%)",
  promotional: "polygon(50% 0%, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0% 50%, 39% 39%)",
  referral: "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)",
  special: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)"
};

const OUTLINE: Record<RewardCategory, ReactElement> = {
  loyalty: <path d="M4 9.6 L24 1 L44 9.6 L44 29.8 Q44 40 24 47 Q4 40 4 29.8 Z" />,
  promotional: (
    <path d="M24 2 L29.3 18.7 L46 24 L29.3 29.3 L24 46 L18.7 29.3 L2 24 L18.7 18.7 Z" />
  ),
  referral: <path d="M12 3 H36 L45 24 L36 45 H12 L3 24 Z" />,
  special: <path d="M14.4 3 H33.6 L45 14.4 V33.6 L33.6 45 H14.4 L3 33.6 V14.4 Z" />
};

const SIZE_CLASS: Record<RewardEmblemSize, string> = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16 sm:h-20 sm:w-20"
};

const MONOGRAM_SIZE: Record<RewardEmblemSize, string> = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-lg sm:text-xl"
};

const DARK_CATEGORIES: RewardCategory[] = ["loyalty", "promotional"];

function deriveMonogram(name: string): string {
  const match = name.match(/[A-Za-z0-9]/);
  return match ? match[0].toUpperCase() : "R";
}

export interface RewardEmblemProps {
  category: RewardCategory;
  name: string;
  locked?: boolean;
  size?: RewardEmblemSize;
}

export function RewardEmblem({ category, name, locked = false, size = "md" }: RewardEmblemProps) {
  const rawId = useId();
  const gradientId = `reward-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const surfaceClass = locked ? "emblem-reward-locked" : SURFACE_CLASS[category];
  const monogramTone = locked
    ? "text-[#6B7280]"
    : DARK_CATEGORIES.includes(category)
      ? "text-[#0F0F10]/90"
      : "text-[#F5F5F7] drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]";
  const outline = OUTLINE[category];
  const strokeOuter = locked ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.42)";

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${SIZE_CLASS[size]} ${surfaceClass} transition-transform duration-300 ease-out motion-safe:hover:scale-105 motion-reduce:transition-none`}
      style={{ clipPath: SILHOUETTE[category], WebkitClipPath: SILHOUETTE[category] }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${gradientId}-sheen`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="44%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
          </linearGradient>
          <radialGradient id={`${gradientId}-glow`} cx="34%" cy="26%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="48" height="48" fill={`url(#${gradientId}-sheen)`} opacity={locked ? 0.2 : 0.42} />
        <rect width="48" height="48" fill={`url(#${gradientId}-glow)`} opacity={locked ? 0.1 : 0.38} />
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
      {locked ? (
        <svg viewBox="0 0 24 24" className="relative z-10 h-1/3 w-1/3 text-[#6B7280]" fill="none" aria-hidden="true">
          <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ) : (
        <span
          className={`display-font relative z-10 font-semibold tracking-tight ${MONOGRAM_SIZE[size]} ${monogramTone}`}
        >
          {deriveMonogram(name)}
        </span>
      )}
    </span>
  );
}
