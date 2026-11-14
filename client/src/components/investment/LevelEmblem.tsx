import { useId } from "react";

export type LevelEmblemSize = "sm" | "md" | "lg";

const FINISHES = [
  "emblem-bronze",
  "emblem-silver",
  "emblem-gold",
  "emblem-platinum",
  "emblem-diamond",
  "emblem-private"
] as const;

/** Hexagonal crest clip used for every investment level emblem. */
const CREST_CLIP = "polygon(50% 2%, 96% 26%, 96% 74%, 50% 98%, 4% 74%, 4% 26%)";

const CREST_OUTER = "M50 2 L96 26 L96 74 L50 98 L4 74 L4 26 Z";
const CREST_BEVEL = "M50 12 L87 31 L87 69 L50 88 L13 69 L13 31 Z";
const CREST_GLOSS = "M17 29 Q50 12 83 29 L83 21 Q50 3 17 21 Z";

const LOCK_BODY =
  "M39 45 h22 a3 3 0 0 1 3 3 v10 a3 3 0 0 1 -3 3 h-22 a3 3 0 0 1 -3 -3 v-10 a3 3 0 0 1 3 -3 z";
const LOCK_SHACKLE = "M44 46 v-4 a6 6 0 0 1 12 0 v4";

/** Name-derived motifs so each level keeps a stable, distinctive sigil. */
const SIGILS = [
  "M50 23 L71 40 L50 57 L29 40 Z",
  "M50 23 L56 34 L71 40 L56 46 L50 57 L44 46 L29 40 L44 34 Z",
  "M50 23 L68 32 L68 48 L50 57 L32 48 L32 32 Z",
  "M50 23 L70 31 L70 44 Q70 55 50 60 Q30 55 30 44 L30 31 Z",
  "M50 23 L70 42 L62 50 L50 38 L38 50 L30 42 Z",
  "M50 24 L70 57 L30 57 Z"
];

const SIZE_BOX: Record<LevelEmblemSize, string> = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-[5.25rem] w-[5.25rem]"
};

function finishForOrder(order: number): string {
  const index = Math.min(Math.max(Math.trunc(order) - 1, 0), FINISHES.length - 1);
  return FINISHES[index];
}

function hashName(value: string): number {
  const source = value.trim().toLowerCase();
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function LevelEmblem({
  levelName,
  order,
  locked = false,
  size = "md"
}: {
  levelName: string;
  order: number;
  locked?: boolean;
  size?: LevelEmblemSize;
}) {
  const uid = useId().replace(/:/g, "");
  const sheenId = `emblem-sheen-${uid}`;
  const sigilId = `emblem-sigil-${uid}`;
  const safeOrder = Number.isFinite(order) ? Math.max(0, Math.trunc(order)) : 0;
  const sigil = SIGILS[hashName(levelName) % SIGILS.length];

  return (
    <span
      aria-hidden="true"
      style={{ clipPath: CREST_CLIP, WebkitClipPath: CREST_CLIP }}
      className={[
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
        "transition-transform duration-300 ease-out hover:scale-[1.05]",
        "motion-reduce:transition-none motion-reduce:hover:scale-100",
        locked ? "emblem-locked" : finishForOrder(safeOrder),
        SIZE_BOX[size]
      ].join(" ")}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full" focusable="false">
        <defs>
          <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
            <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.30" />
          </linearGradient>
          <linearGradient id={sigilId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.30" />
          </linearGradient>
        </defs>

        <path d={CREST_OUTER} fill={`url(#${sheenId})`} />
        <path d={CREST_GLOSS} fill="#FFFFFF" opacity="0.10" />
        <path d={CREST_BEVEL} fill="none" stroke="#FFFFFF" strokeOpacity="0.28" strokeWidth="1.4" />

        {safeOrder > 0 ? (
          <path
            d={sigil}
            fill={locked ? "rgba(255,255,255,0.20)" : `url(#${sigilId})`}
            stroke={locked ? "none" : "#FFFFFF"}
            strokeOpacity="0.16"
            strokeWidth="0.75"
          />
        ) : (
          <g>
            <path
              d={LOCK_SHACKLE}
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path d={LOCK_BODY} fill="rgba(255,255,255,0.4)" />
          </g>
        )}

        {safeOrder > 0 ? (
          <>
            <text
              x="50"
              y="74"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="21"
              fontWeight="700"
              fill="rgba(0,0,0,0.45)"
            >
              {safeOrder}
            </text>
            <text
              x="50"
              y="73"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="21"
              fontWeight="700"
              className="financial-figure"
              fill={locked ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.94)"}
            >
              {safeOrder}
            </text>
          </>
        ) : null}
      </svg>
    </span>
  );
}
