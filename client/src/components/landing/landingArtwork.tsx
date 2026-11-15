import { useId } from "react";
import btcLogo from "../../assets/crypto/btc.svg";
import ethLogo from "../../assets/crypto/eth.svg";
import solLogo from "../../assets/crypto/sol.svg";
import usdtLogo from "../../assets/crypto/usdt.svg";

/**
 * Original, self-contained artwork for the public landing page.
 *
 * Everything here is drawn with SVG, CSS gradients and the platform's own
 * asset logos — no third-party stock imagery and no external asset hosts, so
 * the visuals stay on-brand, load instantly and never depend on a remote
 * request. Each graphic exists to support the section it sits in.
 */

export const COIN_LOGOS: Record<string, string> = {
  BTC: btcLogo,
  ETH: ethLogo,
  SOL: solLogo,
  USDT: usdtLogo
};

/**
 * Full-bleed atmospheric backdrop: architectural grid, two corner lights and
 * a fine film grain. Layers behind content and never intercepts pointer
 * events.
 */
export function Atmosphere({
  variant = "dual",
  className = ""
}: {
  variant?: "gold" | "emerald" | "dual";
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="grid-fade absolute inset-0 opacity-70" />
      {variant !== "emerald" ? (
        <div className="glow-gold absolute -left-32 -top-40 h-[30rem] w-[30rem]" />
      ) : null}
      {variant !== "gold" ? (
        <div className="glow-emerald absolute -right-28 -top-24 h-[26rem] w-[26rem]" />
      ) : null}
      <div className="noise-overlay absolute inset-0" />
    </div>
  );
}

const NETWORK_NODES: Array<[number, number, number]> = [
  [58, 74, 3],
  [148, 38, 2],
  [252, 92, 4.5],
  [346, 56, 2],
  [92, 182, 2.5],
  [202, 158, 5],
  [304, 204, 3],
  [372, 168, 2],
  [46, 292, 3],
  [162, 272, 2],
  [262, 302, 4],
  [352, 282, 2],
  [118, 362, 2],
  [232, 384, 3.5],
  [322, 352, 2]
];

const NETWORK_EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 4],
  [1, 5],
  [2, 5],
  [3, 6],
  [2, 6],
  [4, 5],
  [5, 6],
  [6, 7],
  [4, 8],
  [5, 9],
  [6, 10],
  [5, 10],
  [7, 10],
  [8, 9],
  [9, 10],
  [10, 11],
  [8, 12],
  [9, 12],
  [10, 13],
  [11, 14],
  [12, 13],
  [13, 14]
];

/**
 * Abstract blockchain network: a constellation of nodes joined by edges.
 * Purely decorative — the ids are prefixed per instance so multiple copies on
 * one page never collide.
 */
export function NetworkGraphic({
  className = "",
  mode = "static"
}: {
  className?: string;
  mode?: "static" | "draw";
}) {
  const uid = useId().replace(/[:]/g, "");
  const edgeId = `edge-${uid}`;
  const nodeId = `node-${uid}`;
  const glowId = `glow-${uid}`;
  return (
    <svg
      viewBox="0 0 420 420"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={edgeId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(198,161,91,0.55)" />
          <stop offset="100%" stopColor="rgba(22,199,132,0.35)" />
        </linearGradient>
        <radialGradient id={nodeId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F2DCAE" />
          <stop offset="100%" stopColor="#C6A15B" />
        </radialGradient>
        <filter id={glowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${glowId})`}>
        {NETWORK_EDGES.map(([a, b], index) => {
          const from = NETWORK_NODES[a];
          const to = NETWORK_NODES[b];
          return (
            <line
              key={`${uid}-e-${index}`}
              x1={from[0]}
              y1={from[1]}
              x2={to[0]}
              y2={to[1]}
              stroke={`url(#${edgeId})`}
              strokeWidth={0.9}
              className={mode === "draw" ? "nx-draw" : undefined}
              style={mode === "draw" ? { animationDelay: `${index * 0.03}s` } : undefined}
            />
          );
        })}
      </g>
      {NETWORK_NODES.map(([x, y, r], index) => (
        <circle
          key={`${uid}-n-${index}`}
          cx={x}
          cy={y}
          r={r}
          fill={`url(#${nodeId})`}
          className={index % 3 === 0 ? "nx-pulse" : undefined}
          style={index % 3 === 0 ? { animationDelay: `${index * 0.4}s` } : undefined}
        />
      ))}
    </svg>
  );
}

/**
 * A single dimensional coin: a metallic ring around a dark disc holding the
 * real asset logo. Used to give the hero and asset sections physical depth.
 */
export function DimensionalCoin({
  symbol,
  size = 72,
  className = ""
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const logo = COIN_LOGOS[symbol];
  if (!logo) {
    return null;
  }
  return (
    <div
      className={`relative shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundImage:
            "conic-gradient(from 215deg, #6b5327 0%, #e6cf94 22%, #8a6a2f 46%, #f2dcae 68%, #6b5327 100%)",
          boxShadow: "0 20px 34px -14px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.14)"
        }}
      />
      <div className="absolute inset-[7%] rounded-full bg-[#101113]" />
      <div
        className="absolute inset-[7%] rounded-full"
        style={{
          backgroundImage:
            "radial-gradient(120% 120% at 30% 18%, rgba(255,255,255,0.18), transparent 56%)"
        }}
      />
      <img
        src={logo}
        alt=""
        className="absolute left-1/2 top-1/2 h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2 object-contain"
      />
    </div>
  );
}

/**
 * Metal tones per membership tier. Keyed by the existing brand emblem classes
 * so the dimensional emblem never invents a colour that the tier system does
 * not already use.
 */
const TIER_METAL: Record<string, [string, string, string]> = {
  "emblem-bronze": ["#3A2B20", "#B07B45", "#2E2318"],
  "emblem-silver": ["#24262A", "#C4CAD2", "#3A3D42"],
  "emblem-gold": ["#3A2E12", "#E6CF94", "#4A3B18"],
  "emblem-platinum": ["#1D262B", "#CFE0E8", "#2E3A40"],
  "emblem-diamond": ["#152036", "#8FB0E8", "#23314A"],
  "emblem-private": ["#181330", "#B3A4EC", "#2A2438"],
  "emblem-locked": ["#111214", "#3A3C42", "#1B1C1F"]
};

/**
 * A dimensional membership emblem: a metallic faceted plate carrying the tier
 * initial. The facets are drawn with SVG so the finish reads as a crafted
 * metal rather than a flat gradient.
 */
export function TierEmblem({
  emblemClass,
  label,
  size = 52,
  textClass = "text-white/90",
  active = false,
  className = ""
}: {
  emblemClass: string;
  label: string;
  size?: number;
  textClass?: string;
  active?: boolean;
  className?: string;
}) {
  const metal = TIER_METAL[emblemClass] ?? TIER_METAL["emblem-locked"];
  return (
    <div
      className={`relative shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: active ? "0 0 0 1px rgba(198,161,91,0.4), 0 18px 32px -18px rgba(198,161,91,0.55)" : undefined
      }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundImage: `conic-gradient(from 212deg, ${metal[2]} 0%, ${metal[1]} 22%, ${metal[0]} 50%, ${metal[1]} 76%, ${metal[2]} 100%)`,
          boxShadow: "0 16px 28px -18px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.16)"
        }}
      />
      <div className={`absolute inset-[9%] rounded-full ${emblemClass}`} />
      <div className="absolute inset-[9%] overflow-hidden rounded-full">
        <svg viewBox="0 0 100 100" className="h-full w-full" focusable="false">
          <polygon points="50,6 90,33 50,50" fill="rgba(255,255,255,0.18)" />
          <polygon points="50,6 10,33 50,50" fill="rgba(255,255,255,0.08)" />
          <polygon points="50,50 90,33 72,86" fill="rgba(255,255,255,0.05)" />
          <polygon points="50,50 10,33 28,86" fill="rgba(0,0,0,0.28)" />
          <polygon points="28,86 72,86 50,94" fill="rgba(0,0,0,0.18)" />
        </svg>
      </div>
      <div
        className="absolute inset-[9%] rounded-full"
        style={{
          backgroundImage:
            "radial-gradient(95% 95% at 32% 22%, rgba(255,255,255,0.32), transparent 54%)"
        }}
      />
      <span
        className={`display-font absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-semibold ${textClass}`}
        style={{ fontSize: size * 0.34 }}
      >
        {label}
      </span>
    </div>
  );
}

/** A positioned soft light used to place controlled glow behind artwork. */
export function GlowOrb({
  tone = "gold",
  className = ""
}: {
  tone?: "gold" | "emerald";
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full ${tone === "gold" ? "glow-gold" : "glow-emerald"} ${className}`}
    />
  );
}

/**
 * Horizontal trend indicator driven entirely by real 24h change. It never
 * draws a synthetic price history — the bar length encodes the magnitude of
 * the real change and the colour encodes its direction.
 */
export function TrendIndicator({ change }: { change: number }) {
  const safe = Number.isFinite(change) ? change : 0;
  const magnitude = Math.min(Math.abs(safe), 12) / 12;
  const width = `${Math.max(magnitude * 100, 6)}%`;
  const tone =
    safe > 0 ? "bg-[#16C784]" : safe < 0 ? "bg-[#EA3943]" : "bg-[#6B7280]";
  return (
    <div aria-hidden="true" className="relative h-1 w-full overflow-hidden rounded-full bg-[#1F2023]">
      <div className={`h-full rounded-full ${tone}`} style={{ width }} />
    </div>
  );
}