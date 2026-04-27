import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import {
  ArrowRight,
  Trophy,
  Wallet,
  TrendingUp,
  Sparkles,
  LineChart,
  Shield,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Lock,
  Users,
  Share2,
  Copy,
  Mail,
  Send,
  Network,
  HelpCircle,
  Timer,
  ArrowRightCircle
} from "lucide-react";
import { FaDiscord, FaTelegramPlane, FaWhatsapp, FaTwitter } from "react-icons/fa";
import type { RootState } from "../store";
import btcLogo from "../assets/crypto/btc.svg";
import ethLogo from "../assets/crypto/eth.svg";
import solLogo from "../assets/crypto/sol.svg";
import usdtLogo from "../assets/crypto/usdt.svg";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import { useLiveMarket } from "../hooks/useLiveMarket";

type MarketSymbol = "BTC" | "ETH" | "USDT" | "SOL";

interface LandingMarketPoint {
  symbol: MarketSymbol;
  price: number;
  change24h: number;
}

type LandingMarketResponse = Record<string, LandingMarketPoint>;

const MARKET_TICKER_SYMBOLS: MarketSymbol[] = ["BTC", "ETH", "USDT", "SOL"];

const MARKET_META: Record<MarketSymbol, { name: string; logo: string }> = {
  BTC: {
    name: "Bitcoin",
    logo: btcLogo
  },
  ETH: {
    name: "Ethereum",
    logo: ethLogo
  },
  USDT: {
    name: "Tether",
    logo: usdtLogo
  },
  SOL: {
    name: "Solana",
    logo: solLogo
  }
};

interface SupportedAsset {
  id: string;
  name: string;
  symbol: string;
  logo?: string;
}

const SUPPORTED_ASSETS: SupportedAsset[] = [
  {
    id: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    logo: btcLogo
  },
  {
    id: "eth",
    name: "Ethereum",
    symbol: "ETH",
    logo: ethLogo
  },
  {
    id: "usdt",
    name: "Tether (USDT)",
    symbol: "USDT",
    logo: usdtLogo
  },
  {
    id: "sol",
    name: "Solana",
    symbol: "SOL",
    logo: solLogo
  }
];

interface Testimonial {
  id: string;
  username: string;
  level: number;
  levelProgress: number;
  approvedDeposits: number;
  multiplier: number;
  quote: string;
  avatarColor: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    username: "Alex M.",
    level: 3,
    levelProgress: 58,
    approvedDeposits: 3450,
    multiplier: 1.25,
    quote: "Seeing my portfolio grow with every approved deposit feels structured and reliable.",
    avatarColor: "#1F2937"
  },
  {
    id: "t2",
    username: "Priya K.",
    level: 4,
    levelProgress: 72,
    approvedDeposits: 12870,
    multiplier: 1.6,
    quote: "The level system makes it clear how my deposits translate into rewards.",
    avatarColor: "#7C2D12"
  },
  {
    id: "t3",
    username: "Daniel R.",
    level: 2,
    levelProgress: 43,
    approvedDeposits: 2150,
    multiplier: 1.18,
    quote: "I like seeing my progress bar move every time a deposit is approved.",
    avatarColor: "#0F766E"
  },
  {
    id: "t4",
    username: "Sofia L.",
    level: 5,
    levelProgress: 26,
    approvedDeposits: 24560,
    multiplier: 2.0,
    quote: "The combination of live market data and multipliers keeps me engaged without feeling risky.",
    avatarColor: "#4A044E"
  }
];

interface FaqItem {
  id: string;
  question: string;
  summary: string;
  answer: string;
  icon: "deposits" | "withdrawals" | "levels" | "safety" | "mistakes";
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "deposits-verification",
    question: "How are deposits verified?",
    summary: "On-chain checks for every incoming transaction.",
    answer:
      "When you send a deposit, our infrastructure tracks the blockchain for your transaction, validates the amount, asset type, destination address, and required confirmations, and then posts it into your account once confirmed. If something looks unusual, an admin can place the deposit into manual review before it impacts your level or rewards.",
    icon: "deposits"
  },
  {
    id: "withdrawals-timing",
    question: "When can I withdraw?",
    summary: "Withdrawals unlock once you reach Level 5.",
    answer:
      "Your withdrawable balance is calculated from approved deposits and reward rules for your current level. Withdrawals are available from Level 5 and above, with cooldown timers to keep the system fair and protect liquidity. Each request is signed off by an admin and settled back to the wallet address you control.",
    icon: "withdrawals"
  },
  {
    id: "levels-skipping",
    question: "Can I skip levels?",
    summary: "Higher deposits can unlock multiple levels at once.",
    answer:
      "Yes. The platform continuously evaluates your approved deposit total against the level ladder. If a single approved deposit moves you past several thresholds, you jump directly to the highest qualifying level and immediately benefit from the stronger multiplier tied to that level.",
    icon: "levels"
  },
  {
    id: "funds-safety",
    question: "Are my funds safe?",
    summary: "Custodial security with transparent accounting.",
    answer:
      "Deposits are held in secure wallets operated by the platform with strict internal permissions and monitoring. Every multiplier and reward calculation is deterministic, auditable, and based on on-chain verified balances, so your level, XP, and rewards are always consistent with your real deposits.",
    icon: "safety"
  },
  {
    id: "deposit-mistakes",
    question: "What if I make a mistake with a deposit?",
    summary: "Asset and network must match the instructions.",
    answer:
      "Before confirming a deposit, always double-check that you are using the correct asset and network displayed in your dashboard. If a transaction is sent on the wrong network or to an incorrect address, it may not be recoverable. Our blockchain monitoring can often detect mismatches and flag them for review, but only correctly formatted transfers are guaranteed to be credited.",
    icon: "mistakes"
  }
];

interface DepositActivity {
  id: string;
  amount: string;
  asset: string;
  timeAgo: string;
}

type LeaderboardCategory = "topDepositors" | "weeklyEarners" | "fastestGrowing";

interface LeaderboardRow {
  username: string;
  scoreLabel: string;
}

interface CommunityEvent {
  id: string;
  text: string;
  timeAgo: string;
}

const mockActivities: DepositActivity[] = [
  { id: "1", amount: "0.52", asset: "BTC", timeAgo: "2 minutes ago" },
  { id: "2", amount: "18", asset: "ETH", timeAgo: "5 minutes ago" },
  { id: "3", amount: "3,400", asset: "SOL", timeAgo: "8 minutes ago" },
  { id: "4", amount: "1.2", asset: "BTC", timeAgo: "12 minutes ago" },
  { id: "5", amount: "45", asset: "ETH", timeAgo: "15 minutes ago" },
  { id: "6", amount: "8,500", asset: "SOL", timeAgo: "18 minutes ago" },
  { id: "7", amount: "3,200", asset: "BTC", timeAgo: "25 minutes ago" },
  { id: "8", amount: "950", asset: "ETH", timeAgo: "32 minutes ago" }
];

const LEADERBOARD_DATA: Record<LeaderboardCategory, LeaderboardRow[]> = {
  topDepositors: [
    { username: "CryptoWhale", scoreLabel: "$48,000" },
    { username: "DeFiKing", scoreLabel: "$31,200" },
    { username: "ChainMaster", scoreLabel: "$27,900" },
    { username: "BlockTitan", scoreLabel: "$21,400" },
    { username: "SatoshiNode", scoreLabel: "$19,600" }
  ],
  weeklyEarners: [
    { username: "YieldPilot", scoreLabel: "$7,420" },
    { username: "GammaFlow", scoreLabel: "$6,310" },
    { username: "LayerZero", scoreLabel: "$5,980" },
    { username: "NodeRunner", scoreLabel: "$4,760" },
    { username: "VaultGuardian", scoreLabel: "$4,120" }
  ],
  fastestGrowing: [
    { username: "NewHorizon", scoreLabel: "+182%" },
    { username: "VoltaEdge", scoreLabel: "+163%" },
    { username: "SolRise", scoreLabel: "+149%" },
    { username: "EthWave", scoreLabel: "+133%" },
    { username: "BTCSignal", scoreLabel: "+127%" }
  ]
};

const COMMUNITY_EVENTS: CommunityEvent[] = [
  { id: "e1", text: "Alex deposited 0.42 BTC", timeAgo: "2 min ago" },
  { id: "e2", text: "Sarah unlocked Level 3", timeAgo: "7 min ago" },
  { id: "e3", text: "Mike deposited 3,200 MATIC", timeAgo: "11 min ago" },
  { id: "e4", text: "Referral boost activated for Daniel", timeAgo: "18 min ago" },
  { id: "e5", text: "Priya hit a new earnings milestone", timeAgo: "25 min ago" }
];

function getAssetLogo(asset: string): string {
  if (asset === "BTC") return btcLogo;
  if (asset === "ETH") return ethLogo;
  if (asset === "SOL") return solLogo;
  return btcLogo;
}

const LEVEL_LADDER: { level: number; multiplier: number }[] = [
  { level: 1, multiplier: 1.1 },
  { level: 2, multiplier: 1.25 },
  { level: 3, multiplier: 1.45 },
  { level: 4, multiplier: 1.7 },
  { level: 5, multiplier: 2.0 }
];

function calculateLevel(depositAmount: number): number {
  if (depositAmount < 1000) return 1;
  if (depositAmount < 5000) return 2;
  if (depositAmount < 10000) return 3;
  return 4;
}

function calculateMultiplier(level: number): number {
  return 1 + level * 0.25;
}

function calculateEarnings(depositAmount: number, multiplier: number): number {
  return depositAmount * (multiplier - 1) * 0.1;
}

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state: RootState) => state.auth.user);
  const [depositAmount, setDepositAmount] = useState(2500);
  const [chartData, setChartData] = useState([
    { day: 1, value: 2000 },
    { day: 8, value: 8500 },
    { day: 15, value: 12900 },
    { day: 25, value: 18942 }
  ]);
  const [floatingSignals, setFloatingSignals] = useState<
    { id: string; text: string; x: string; y: string }[]
  >([]);
  const [progressAmount, setProgressAmount] = useState(1200);
  const [simulatedPortfolioValue, setSimulatedPortfolioValue] = useState(12492);
  const [displayedPortfolioValue, setDisplayedPortfolioValue] = useState(12492);
  const [activeLadderLevel, setActiveLadderLevel] = useState(3);
  const [engineDeposit, setEngineDeposit] = useState(2000);
  const [engineDepositTouched, setEngineDepositTouched] = useState(false);
  const [activeLeaderboardTab, setActiveLeaderboardTab] =
    useState<LeaderboardCategory>("topDepositors");
  const [statsAnimated, setStatsAnimated] = useState(false);
  const [statTotalDeposits, setStatTotalDeposits] = useState(2_134_820);
  const [statActiveDepositors, setStatActiveDepositors] = useState(3_491);
  const [statHighestMultiplier, setStatHighestMultiplier] = useState(1.0);
  const [communityMembers, setCommunityMembers] = useState(12842);
  const { data: marketData, loading: marketLoading } = useLiveMarket(MARKET_TICKER_SYMBOLS);
  const [marketTrendSeries, setMarketTrendSeries] = useState<number[]>([
    1,
    1,
    1,
    1,
    1
  ]);
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);
  const [openFaqId, setOpenFaqId] = useState<string | null>("deposits-verification");

  const referralLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/register?ref=your-code`
      : "https://nexacrypto.app/ref/your-code";

  const formatUsd = (value: number): string => {
    if (!Number.isFinite(value)) {
      return "$—";
    }
    const clamped = Math.max(0, Math.min(Math.round(value), 50_000_000));
    return `$${clamped.toLocaleString()}`;
  };

  const level = useMemo(() => calculateLevel(depositAmount), [depositAmount]);
  const multiplier = useMemo(() => calculateMultiplier(level), [level]);
  const earnings = useMemo(
    () => calculateEarnings(depositAmount, multiplier),
    [depositAmount, multiplier]
  );

  const engineLevel = useMemo(() => {
    if (engineDeposit < 1000) return 1;
    if (engineDeposit < 2500) return 2;
    if (engineDeposit < 5000) return 3;
    if (engineDeposit < 7500) return 4;
    return 5;
  }, [engineDeposit]);

  const engineMultiplier = useMemo(() => {
    const match = LEVEL_LADDER.find((entry) => entry.level === engineLevel);
    return match ? match.multiplier : 1.1;
  }, [engineLevel]);

  const engineProjectedGrowth = useMemo(() => {
    const raw = engineDeposit * engineMultiplier;
    if (!Number.isFinite(raw) || raw < 0) {
      return 0;
    }
    return Math.min(raw, 10000000);
  }, [engineDeposit, engineMultiplier]);

  const engineChartSeries = useMemo(() => {
    const clamp = (v: number) => Math.max(0, Math.min(v, 10_000_000));
    const base = clamp(engineDeposit || 100);
    const finalValue = clamp(engineProjectedGrowth || engineDeposit || 100);
    const mid1 = clamp(base * 0.6);
    const mid2 = clamp((base + finalValue) / 2);
    const mid3 = clamp(finalValue * 0.85);
    return [mid1, mid2, mid3, finalValue];
  }, [engineDeposit, engineProjectedGrowth]);

  const progressMultiplier = useMemo(() => {
    if (progressAmount < 1000) {
      return 1.1;
    }
    if (progressAmount < 3000) {
      return 1.25;
    }
    return 1.45;
  }, [progressAmount]);

  useEffect(() => {
    const root = document.documentElement;
    const previousRootOverflowX = root.style.overflowX;
    const previousBodyOverflowX = document.body.style.overflowX;
    root.style.overflowX = "hidden";
    document.body.style.overflowX = "hidden";

    return () => {
      root.style.overflowX = previousRootOverflowX;
      document.body.style.overflowX = previousBodyOverflowX;
    };
  }, []);

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setChartData((prev) =>
        prev.map((point) => ({
          ...point,
          value: point.value + Math.random() * 50 - 25
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const basePrice = marketData.BTC?.price ?? 0;
    if (!basePrice) {
      return;
    }
    const changeFactor = 1 + (marketData.BTC?.change24h ?? 0) / 100;
    const nextSeries = [
      basePrice * changeFactor * 0.975,
      basePrice * changeFactor * 0.99,
      basePrice * changeFactor,
      basePrice * changeFactor * 1.015,
      basePrice * changeFactor * 1.03
    ].map((value) => value / basePrice);
    setMarketTrendSeries(nextSeries);
  }, [marketData.BTC?.price, marketData.BTC?.change24h]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedPortfolioValue((prev) => {
        const delta = (Math.random() - 0.3) * 60;
        const next = prev + delta;
        const clamped = Math.max(10000, Math.min(next, 25000));
        return clamped;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const start = displayedPortfolioValue;
    const end = simulatedPortfolioValue;
    if (start === end) {
      return;
    }
    const startTime = performance.now();
    const duration = 800;
    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const raw = start + (end - start) * eased;
      const value = Math.max(10000, Math.min(raw, 25000));
      setDisplayedPortfolioValue(value);
      if (t < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [simulatedPortfolioValue, displayedPortfolioValue]);

  useEffect(() => {
    let current = 1;
    setActiveLadderLevel(current);
    const interval = setInterval(() => {
      current += 1;
      setActiveLadderLevel((prev) => {
        if (prev >= 5) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
      if (current >= 5) {
        clearInterval(interval);
      }
    }, 900);

    return () => clearInterval(interval);
  }, []);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 50, damping: 20 });
  const multiplierSectionRef = useRef<HTMLDivElement | null>(null);
  const isMultiplierSectionInView = useInView(multiplierSectionRef, {
    once: true,
    margin: "-20% 0px"
  });
  const leaderboardSectionRef = useRef<HTMLDivElement | null>(null);
  const isLeaderboardSectionInView = useInView(leaderboardSectionRef, {
    once: true,
    margin: "-20% 0px"
  });
  const securitySectionRef = useRef<HTMLDivElement | null>(null);
  const isSecuritySectionInView = useInView(securitySectionRef, {
    once: true,
    margin: "-20% 0px"
  });
  const referralSectionRef = useRef<HTMLDivElement | null>(null);
  const isReferralSectionInView = useInView(referralSectionRef, {
    once: true,
    margin: "-20% 0px"
  });
  const marketSectionRef = useRef<HTMLDivElement | null>(null);
  const isMarketSectionInView = useInView(marketSectionRef, {
    once: true,
    margin: "-20% 0px"
  });
  const testimonialsSectionRef = useRef<HTMLDivElement | null>(null);
  const isTestimonialsSectionInView = useInView(testimonialsSectionRef, {
    once: true,
    margin: "-20% 0px"
  });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  useEffect(() => {
    if (!isLeaderboardSectionInView || statsAnimated) {
      return;
    }
    setStatsAnimated(true);
    const targetTotalDeposits = 2134820;
    const targetActiveDepositors = 3491;
    const targetHighestMultiplier = 2.75;
    const startTotalDeposits = 0;
    const startActiveDepositors = 0;
    const startHighestMultiplier = 1.0;
    const duration = 900;
    const startTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const tRaw = Math.min(1, elapsed / duration);
      const t = 1 - Math.pow(1 - tRaw, 3);

      setStatTotalDeposits(
        Math.max(
          0,
          Math.round(startTotalDeposits + (targetTotalDeposits - startTotalDeposits) * t)
        )
      );
      setStatActiveDepositors(
        Math.max(
          0,
          Math.round(
            startActiveDepositors + (targetActiveDepositors - startActiveDepositors) * t
          )
        )
      );
      setStatHighestMultiplier(
        Math.max(
          1,
          Number(
            (
              startHighestMultiplier +
              (targetHighestMultiplier - startHighestMultiplier) * t
            ).toFixed(2)
          )
        )
      );

      if (tRaw < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isLeaderboardSectionInView, statsAnimated]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCommunityMembers((prev) => {
        const increment = Math.floor(Math.random() * 3) + 1;
        const next = prev + increment;
        if (next > 99999) {
          return prev;
        }
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketTrendSeries((prev) => {
        const previous = prev.length > 0 ? prev[prev.length - 1] : 1;
        const delta = (Math.random() - 0.5) * 0.03;
        const nextValue = Math.min(1.15, Math.max(0.9, previous + delta));
        const nextSeries = [...prev.slice(-6), nextValue];
        return nextSeries;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isTestimonialsSectionInView) {
      return;
    }
    const interval = setInterval(() => {
      setActiveTestimonialIndex((prev) => {
        if (TESTIMONIALS.length === 0) {
          return prev;
        }
        return (prev + 1) % TESTIMONIALS.length;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [isTestimonialsSectionInView]);

  useEffect(() => {
    if (!location.hash) {
      return;
    }
    const id = location.hash.replace("#", "");
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    const headerOffset = 80;
    const rect = element.getBoundingClientRect();
    const targetScrollTop = window.scrollY + rect.top - headerOffset;
    window.scrollTo({
      top: targetScrollTop,
      behavior: "smooth"
    });
  }, [location.hash]);

  const scrollToLandingSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) {
      return;
    }
    const headerOffset = 80;
    const rect = element.getBoundingClientRect();
    const targetScrollTop = window.scrollY + rect.top - headerOffset;
    window.history.replaceState(null, "", `#${sectionId}`);
    window.scrollTo({
      top: targetScrollTop,
      behavior: "smooth"
    });
  };

  const safeStatTotalDeposits = Math.max(
    2_134_820,
    Number.isFinite(statTotalDeposits) ? statTotalDeposits : 2_134_820
  );
  const safeStatActiveDepositors = Math.max(
    3_491,
    Number.isFinite(statActiveDepositors) ? statActiveDepositors : 3_491
  );
  const safeStatHighestMultiplier = Math.max(1, Number.isFinite(statHighestMultiplier) ? statHighestMultiplier : 1);
  const safeCommunityMembers = Math.max(0, Number.isFinite(communityMembers) ? communityMembers : 0);
  const safeActiveToday = Math.max(
    0,
    Math.round(Math.min(safeCommunityMembers, Math.max(0, safeStatActiveDepositors * 0.4)))
  );
  return (
    <div className="landing-page page-responsive relative min-h-screen w-full overflow-x-hidden bg-[#0F0F10] pb-10 sm:pb-12">
      <Seo
        title="Custodial crypto deposits with levels, multipliers and rewards"
        description="NexaCrypto is a custodial crypto growth platform where verified deposits unlock XP, deposit tiers, streak bonuses, and multiplier-driven rewards."
        path="/landing"
      />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1c] via-[#0F0F10] to-[#151516]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at ${springX.get()}px ${springY.get()}px, rgba(198, 161, 91, 0.15) 0%, transparent 50%)`
          }}
        />
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="blockchain-pattern"
                x="0"
                y="0"
                width="100"
                height="100"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="20" cy="20" r="1.5" fill="#C6A15B" opacity="0.3">
                  <animate
                    attributeName="opacity"
                    values="0.3;0.6;0.3"
                    dur="4s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx="80" cy="40" r="1.5" fill="#16C784" opacity="0.3">
                  <animate
                    attributeName="opacity"
                    values="0.3;0.6;0.3"
                    dur="5s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle cx="50" cy="80" r="1.5" fill="#C6A15B" opacity="0.3">
                  <animate
                    attributeName="opacity"
                    values="0.3;0.6;0.3"
                    dur="6s"
                    repeatCount="indefinite"
                  />
                </circle>
                <line
                  x1="20"
                  y1="20"
                  x2="80"
                  y2="40"
                  stroke="#C6A15B"
                  strokeWidth="0.5"
                  opacity="0.2"
                />
                <line
                  x1="80"
                  y1="40"
                  x2="50"
                  y2="80"
                  stroke="#16C784"
                  strokeWidth="0.5"
                  opacity="0.2"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#blockchain-pattern)" />
          </svg>
        </div>
      </div>

      <div className="borderless-ui relative z-10 w-full min-w-0 max-w-full overflow-x-hidden">
        <section id="home" className="w-full bg-[#050509] px-4 pt-24 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl min-w-0 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="min-w-0 space-y-8">
              <div className="space-y-4">
                <h1 className="display-font text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight">
                  <span className="text-[#F5F5F7]">Grow your </span>
                  <span className="bg-gradient-to-r from-[#C6A15B] via-[#FACC15] to-[#FFFFFF] bg-clip-text display-font text-transparent">
                    crypto
                  </span>
                  <span className="text-[#F5F5F7]"> with </span>
                  <span className="bg-gradient-to-r from-[#16C784] to-[#38BDF8] bg-clip-text display-font text-transparent">
                    intelligent
                  </span>
                  <span className="text-[#F5F5F7]"> multipliers</span>
                </h1>
                <p className="text-lg sm:text-xl text-[#9CA3AF] max-w-xl">
                  Deposit assets, unlock levels, and amplify your earnings
                  automatically.
                </p>
              </div>

              <div className="space-y-6 pt-4">
                <div className="min-w-0 rounded-2xl bg-[#17181A]/80 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.75)] backdrop-blur-sm">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-[#F5F5F7] mb-2 block">
                        Deposit Amount
                      </label>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-[#9CA3AF]">$100</span>
                        <input
                          type="range"
                          min="100"
                          max="10000"
                          step="100"
                          value={depositAmount}
                          onChange={(e) =>
                            setDepositAmount(Number(e.target.value))
                          }
                          className="flex-1 h-2 bg-[#26272B] rounded-lg appearance-none cursor-pointer accent-[#C6A15B]"
                        />
                        <span className="text-xs text-[#9CA3AF]">$10,000</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <p className="text-xs text-[#9CA3AF]">Deposit Amount</p>
                        <p className="text-lg font-semibold text-[#F5F5F7]">
                          ${depositAmount.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#9CA3AF]">
                          Projected level
                        </p>
                        <p className="text-lg font-semibold text-[#C6A15B]">
                          Level {level}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[#9CA3AF]">
                          Projected multiplier
                        </p>
                        <p className="text-lg font-semibold text-[#16C784]">
                          x{multiplier.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <p className="text-xs text-[#9CA3AF] mb-1">
                        Projected earnings preview
                      </p>
                      <p className="text-xl font-semibold text-[#16C784]">
                        +{earnings.toFixed(2)} ETH
                      </p>
                    </div>
                  </div>
                </div>

                <div className="buttons-row flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <button
                    onClick={() => navigate("/register")}
                    className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#C6A15B] to-[#FACC15] px-6 py-3 text-center text-sm font-semibold text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(198,161,91,0.48)] sm:w-auto sm:min-w-[210px]"
                  >
                    <span>Start Depositing</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => scrollToLandingSection("leaderboard")}
                    className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-full border border-[#2D2F34] bg-[#17181A] px-6 py-3 text-center text-sm font-medium text-[#F5F5F7] transition-all hover:border-[#C6A15B]/45 hover:bg-[#1F2023] sm:w-auto sm:min-w-[198px]"
                  >
                    <Trophy className="h-4 w-4" />
                    <span>View Leaderboard</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-6 pt-4 text-xs text-[#9CA3AF]">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#16C784]" />
                    <span>Secure wallet infrastructure</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#16C784]" />
                    <span>Transparent multiplier engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#16C784]" />
                    <span>Community-driven rewards</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-w-0 max-w-full">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-r from-[#C6A15B]/20 via-transparent to-[#16C784]/20 blur-3xl opacity-50" />
</div>
              <div className="relative overflow-hidden rounded-3xl bg-[#17181A]/80 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.75)] backdrop-blur-sm">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-[#9CA3AF]">
                      Portfolio Value
                    </p>
                    <p className="text-3xl font-semibold text-[#F5F5F7]">
                      {formatUsd(displayedPortfolioValue)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-[#9CA3AF]">
                      Pending Earnings
                    </p>
                    <p className="text-xl font-semibold text-[#16C784]">
                      0.42 ETH
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-[#9CA3AF]">
                      Current Multiplier
                    </p>
                    <motion.p
                      className="text-2xl font-semibold text-[#C6A15B]"
                      animate={{
                        textShadow: [
                          "0 0 10px rgba(198, 161, 91, 0.5)",
                          "0 0 20px rgba(198, 161, 91, 0.8)",
                          "0 0 10px rgba(198, 161, 91, 0.5)"
                        ]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      x1.45
                    </motion.p>
                  </div>

                  <div className="pt-4 border-t border-[#26272B]">
                    <p className="text-xs text-[#9CA3AF] mb-3">Growth Chart</p>
                    <div className="h-32 relative overflow-hidden rounded-xl bg-[#0F0F10]">
                      <svg
                        className="w-full h-full"
                        viewBox="0 0 200 100"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="hero-area-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#16C784" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#16C784" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <g stroke="#1F2933" strokeWidth="0.5">
                          <line x1="0" y1="25" x2="200" y2="25" />
                          <line x1="0" y1="50" x2="200" y2="50" />
                          <line x1="0" y1="75" x2="200" y2="75" />
                        </g>
                        <g stroke="#1F2933" strokeWidth="0.5">
                          <line x1="40" y1="0" x2="40" y2="100" />
                          <line x1="80" y1="0" x2="80" y2="100" />
                          <line x1="120" y1="0" x2="120" y2="100" />
                          <line x1="160" y1="0" x2="160" y2="100" />
                        </g>
                        <motion.path
                          d={`M ${chartData
                            .map((d, i) => {
                              const x = (i / (chartData.length - 1)) * 200;
                              const y = 100 - (d.value / 20000) * 100;
                              return `${x},${y}`;
                            })
                            .join(" L ")} L 200,100 L 0,100 Z`}
                          fill="url(#hero-area-fill)"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 2.2, repeat: Infinity }}
                        />
                        <motion.polyline
                          points={chartData
                            .map((d, i) => {
                              const x = (i / (chartData.length - 1)) * 200;
                              const y = 100 - (d.value / 20000) * 100;
                              return `${x},${y}`;
                            })
                            .join(" ")}
                          fill="none"
                          stroke="#16C784"
                          strokeWidth="2"
                          strokeLinecap="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 2.2, repeat: Infinity }}
                        />
                        {chartData.map((d, i) => {
                          const x = (i / (chartData.length - 1)) * 200;
                          const y = 100 - (d.value / 20000) * 100;
                          return (
                            <circle
                              key={d.day}
                              cx={x}
                              cy={y}
                              r={2.2}
                              fill="#16C784"
                              stroke="#0F0F10"
                              strokeWidth={0.8}
                            />
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#26272B]">
                    <p className="text-xs text-[#9CA3AF] mb-3">
                      Asset Allocation
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={btcLogo}
                            alt="BTC"
                            className="h-5 w-5"
                          />
                          <span className="text-xs text-[#F5F5F7]">BTC</span>
                        </div>
                        <span className="text-xs text-[#9CA3AF]">48%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={ethLogo}
                            alt="ETH"
                            className="h-5 w-5"
                          />
                          <span className="text-xs text-[#F5F5F7]">ETH</span>
                        </div>
                        <span className="text-xs text-[#9CA3AF]">32%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img
                            src={solLogo}
                            alt="SOL"
                            className="h-5 w-5"
                          />
                          <span className="text-xs text-[#F5F5F7]">SOL</span>
                        </div>
                        <span className="text-xs text-[#9CA3AF]">20%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {floatingSignals.map((signal) => (
                  <motion.div
                    key={signal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute max-w-[calc(100%-1.5rem)] truncate rounded-full bg-[#16C784]/20 border border-[#16C784]/40 px-3 py-1.5 text-xs text-[#16C784]"
                    style={{ left: signal.x, top: signal.y }}
                  >
                    {signal.text}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/*
          Temporarily disabled marquee strip to prevent mobile overflow while we finalize responsive tuning.
          <section className="w-full bg-[#0B0B0D] px-4 py-6 border-t border-[#26272B] sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl overflow-x-auto-mobile">
              <motion.div
                className="flex gap-6 whitespace-nowrap sm:flex-wrap-mobile"
                animate={{ x: [0, -50 * mockActivities.length] }}
                transition={{ x: { repeat: Infinity, repeatType: "loop", duration: 30, ease: "linear" } }}
              >
                {[...mockActivities, ...mockActivities].map((activity, idx) => {
                  const symbol = activity.asset.toUpperCase();
                  return (
                    <div key={`${activity.id}-${idx}`} className="flex items-center gap-2 text-xs sm:text-sm text-[#9CA3AF]">
                      <img src={getAssetLogo(symbol)} alt={symbol} className="h-3.5 w-3.5 sm:h-4 sm:w-4" loading="lazy" />
                      <span className="font-medium text-[#F5F5F7]">{activity.amount} {activity.asset}</span>
                      <span>deposited</span>
                      <span>•</span>
                      <span>{activity.timeAgo}</span>
                    </div>
                  );
                })}
              </motion.div>
            </div>
          </section>
        */}

        <section
          id="how-it-works"
          className="w-full bg-[#0F0F10] px-4 py-16 border-t border-[#26272B] sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                How it works
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                How the platform works
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF]">
                Deposit assets, unlock multiplier levels, and watch your earnings grow automatically.
              </p>
            </div>

            <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)] items-start">
              <div className="min-w-0 space-y-6">
                <p className="text-xs font-medium text-[#9CA3AF]">
                  The 3-step system
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <motion.div
                    whileHover={{ y: -4, boxShadow: "0 18px 40px rgba(0,0,0,0.65)" }}
                    transition={{ type: "spring", stiffness: 200, damping: 22 }}
                    className="relative rounded-2xl bg-[#17181A]/60 px-4 py-4 space-y-3 backdrop-blur-sm"
                  >
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#0F0F10] px-3 py-1 text-[11px] text-[#9CA3AF]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#17181A] text-[#C6A15B]">
                        <Wallet className="h-3.5 w-3.5" />
                      </span>
                      <span>Step 1 · Deposit crypto</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[#F5F5F7]">
                        Deposit supported assets
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Deposit Bitcoin, Ethereum, or Solana into your secure platform address.
                      </p>
                    </div>
                    <div className="mt-2 rounded-xl bg-[#0F0F10] border border-[#26272B] px-3 py-2 space-y-2">
                      <p className="text-[10px] text-[#9CA3AF]">Select asset</p>
                      <div className="flex gap-1.5 text-[11px]">
                        <span className="rounded-full bg-[#17181A] px-2 py-1 text-[#F5F5F7]">
                          BTC
                        </span>
                        <span className="rounded-full bg-[#17181A]/70 px-2 py-1 text-[#9CA3AF]">
                          ETH
                        </span>
                        <span className="rounded-full bg-[#17181A]/70 px-2 py-1 text-[#9CA3AF]">
                          SOL
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-[#6B7280] truncate">
                        Deposit address generated · bc1q9...7af2
                      </p>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ y: -4, boxShadow: "0 18px 40px rgba(0,0,0,0.65)" }}
                    transition={{ type: "spring", stiffness: 200, damping: 22 }}
                    className="relative rounded-2xl bg-[#17181A]/60 px-4 py-4 space-y-3 backdrop-blur-sm"
                  >
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#0F0F10] px-3 py-1 text-[11px] text-[#9CA3AF]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#17181A] text-[#16C784]">
                        <TrendingUp className="h-3.5 w-3.5" />
                      </span>
                      <span>Step 2 · Unlock levels</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[#F5F5F7]">
                        Climb multiplier tiers
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        As deposits are approved, you unlock higher levels and stronger multipliers.
                      </p>
                    </div>
                    <div className="mt-2 flex gap-3">
                      <div className="flex-1 space-y-1">
                        {LEVEL_LADDER.map((entry) => {
                          const isActive = entry.level <= activeLadderLevel;
                          return (
                            <div key={entry.level} className="flex items-center gap-2">
                              <div className="h-6 w-1.5 rounded-full bg-[#26272B] overflow-hidden">
                                <motion.div
                                  className="h-full w-full rounded-full"
                                  animate={{
                                    backgroundColor: isActive ? "#C6A15B" : "#26272B",
                                    scaleY: isActive ? 1 : 0.4
                                  }}
                                  transition={{ duration: 0.6, ease: "easeOut" }}
                                  style={{ originY: 1 }}
                                />
                              </div>
                              <div className="flex items-baseline justify-between w-full text-[11px] text-[#9CA3AF]">
                                <span className="text-[#F5F5F7]">
                                  Level {entry.level}
                                </span>
                                <span>x{entry.multiplier.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    whileHover={{ y: -4, boxShadow: "0 18px 40px rgba(0,0,0,0.65)" }}
                    transition={{ type: "spring", stiffness: 200, damping: 22 }}
                    className="relative rounded-2xl bg-[#17181A]/60 px-4 py-4 space-y-3 backdrop-blur-sm"
                  >
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#0F0F10] px-3 py-1 text-[11px] text-[#9CA3AF]">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#17181A] text-[#C6A15B]">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      <span>Step 3 · Earn rewards</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-[#F5F5F7]">
                        Earnings scale automatically
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Your rewards grow with your multiplier and portfolio value over time.
                      </p>
                    </div>
                    <div className="mt-2 rounded-xl bg-[#0F0F10] border border-[#26272B] px-3 py-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                        <span>Portfolio value</span>
                        <span className="text-sm font-semibold text-[#F5F5F7]">
                          $
                          {displayedPortfolioValue.toLocaleString(undefined, {
                            maximumFractionDigits: 0
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                        <span>Multiplier</span>
                        <span className="text-sm font-semibold text-[#C6A15B]">
                          x1.35
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                        <span>Projected earnings</span>
                        <span className="text-sm font-semibold text-[#16C784]">
                          0.28 ETH
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[#111827] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-[#16C784] via-[#C6A15B] to-[#F97316]"
                          animate={{ width: ["40%", "70%", "55%"] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="min-w-0 space-y-4 rounded-2xl bg-[#17181A]/60 px-4 py-4 sm:px-5 sm:py-5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                      Deposit progress
                    </p>
                    <p className="text-sm font-medium text-[#F5F5F7]">
                      See how multipliers unlock as you deposit
                    </p>
                  </div>
                  <LineChart className="h-4 w-4 text-[#C6A15B]" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                    <span>${progressAmount.toFixed(0)}</span>
                    <span className="text-xs">
                      Multiplier{" "}
                      <span className="text-[#16C784]">
                        x{progressMultiplier.toFixed(2)}
                      </span>
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-[#6B7280]">
                      <span>$0</span>
                      <span>$1,000</span>
                      <span>$5,000</span>
                    </div>
                    <div className="relative h-2 rounded-full bg-[#111827] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#16C784] via-[#C6A15B] to-[#F97316]"
                      animate={{ width: `${(progressAmount / 5000) * 100}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    />
                  </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5000}
                    step={100}
                    value={progressAmount}
                    onChange={(e) => setProgressAmount(Number(e.target.value))}
                    className="w-full h-2 bg-[#26272B] rounded-lg appearance-none cursor-pointer accent-[#C6A15B]"
                  />
                  <p className="text-[11px] text-[#9CA3AF]">
                    As your deposits grow from{" "}
                    <span className="text-[#F5F5F7]">$0</span> to{" "}
                    <span className="text-[#F5F5F7]">$5,000+</span>, your multiplier
                    steps up from <span className="text-[#16C784]">x1.10</span> to{" "}
                    <span className="text-[#16C784]">x1.25</span> and{" "}
                    <span className="text-[#16C784]">x1.45</span>.
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#26272B] mt-2">
                  <p className="text-[11px] text-[#9CA3AF] max-w-xs">
                    Ready to see it live with your own deposits?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#26272B] bg-[#17181A] px-3 py-1.5 text-[11px] text-[#F5F5F7] hover:border-[#C6A15B]/60 hover:bg-[#1F2023] transition-colors"
                    >
                      Explore the dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#C6A15B] px-3 py-1.5 text-[11px] font-medium text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_18px_rgba(198,161,91,0.6)] transition-shadow"
                    >
                      Start your first deposit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="multiplier-engine"
          ref={multiplierSectionRef}
          className="w-full bg-[#0B0B0D] px-4 py-16 border-t border-[#26272B] sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                The multiplier engine
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                The Multiplier Engine
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF] max-w-xl">
                Unlock higher levels and amplify your earnings as your approved deposits
                grow across the platform.
              </p>
      </div>

            <div className="grid min-w-0 gap-10 lg:grid-cols-2 items-start">
              <div className="min-w-0 space-y-6">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Level ladder
                  </p>
                  <p className="text-sm font-medium text-[#F5F5F7]">
                    Each level unlocks a stronger base multiplier on your approved deposits.
                  </p>
    </div>
                <div className="relative">
                  <div className="pointer-events-none absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-[#C6A15B]/0 via-[#C6A15B]/60 to-[#16C784]/0 opacity-70" />
                  <div className="relative flex flex-col-reverse gap-6 pl-10">
                    {LEVEL_LADDER.map((entry, index) => {
                      const delay = (entry.level - 1) * 0.18;
                      const isActive = engineLevel >= entry.level;
                      return (
                        <motion.div
                          key={entry.level}
                          initial={{ opacity: 0.25, y: 8, scale: 0.96 }}
                          animate={
                            isMultiplierSectionInView
                              ? {
                                  opacity: isActive ? 1 : 0.4,
                                  y: 0,
                                  scale: isActive ? 1 : 0.98
                                }
                              : undefined
                          }
                          transition={{
                            delay,
                            duration: 0.5,
                            ease: "easeOut"
                          }}
                          className="relative flex items-center gap-4"
                        >
                          <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-[#C6A15B]/15 blur-md" />
                            <div
                              className={`relative flex h-9 w-9 items-center justify-center rounded-full border ${
                                isActive
                                  ? "border-[#C6A15B] bg-[#17181A]"
                                  : "border-[#26272B] bg-[#111214]"
                              }`}
                            >
                              <span
                                className={`text-xs font-semibold ${
                                  isActive ? "text-[#C6A15B]" : "text-[#9CA3AF]"
                                }`}
                              >
                                {entry.level}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-1 items-baseline justify-between gap-3">
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-[#F5F5F7]">
                                Level {entry.level}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF]">
                                Target total deposits grow with each tier to unlock this
                                multiplier.
                              </p>
                            </div>
                            <motion.span
                              className="text-sm font-semibold text-[#16C784]"
                              animate={
                                engineLevel === entry.level && isMultiplierSectionInView
                                  ? {
                                      scale: [1, 1.08, 1],
                                      textShadow: [
                                        "0 0 0 rgba(22,199,132,0.0)",
                                        "0 0 16px rgba(22,199,132,0.55)",
                                        "0 0 0 rgba(22,199,132,0.0)"
                                      ]
                                    }
                                  : undefined
                              }
                              transition={{
                                duration: 0.6,
                                ease: "easeInOut"
                              }}
                            >
                              x{entry.multiplier.toFixed(2)}
                            </motion.span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl bg-[#17181A]/60 px-5 py-5 sm:px-6 sm:py-6 backdrop-blur-sm shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                          Multiplier impact
                        </p>
                        <p className="text-sm font-medium text-[#F5F5F7]">
                          Preview how your deposits translate into amplified growth.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center justify-between text-xs text-[#9CA3AF]">
                        <span>Total Deposits</span>
                        <span className="text-[11px] text-[#F5F5F7]">
                          ${engineDeposit.toLocaleString()}
                        </span>
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#6B7280]">$100</span>
                        <input
                          type="range"
                          min={100}
                          max={10000}
                          step={100}
                          value={engineDeposit}
                          onChange={(e) => {
                            setEngineDeposit(Number(e.target.value));
                            if (!engineDepositTouched) {
                              setEngineDepositTouched(true);
                            }
                          }}
                          className="flex-1 h-1.5 appearance-none rounded-full bg-[#26272B] accent-[#C6A15B]"
                        />
                        <span className="text-[11px] text-[#6B7280]">$10,000</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <p className="text-[11px] text-[#9CA3AF]">Deposit</p>
                        <p className="text-base font-semibold text-[#F5F5F7]">
                          ${engineDeposit.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-[#9CA3AF]">Level</p>
                        <p className="text-base font-semibold text-[#C6A15B]">
                          Level {engineLevel}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-[#9CA3AF]">Multiplier</p>
                        <motion.p
                          key={engineLevel}
                          className="inline-flex items-baseline gap-1 text-base font-semibold text-[#16C784]"
                          initial={{ scale: 1, textShadow: "0 0 0 rgba(22,199,132,0.0)" }}
                          animate={{
                            scale: engineDepositTouched ? [1, 1.08, 1] : 1,
                            textShadow: [
                              "0 0 0 rgba(22,199,132,0.0)",
                              "0 0 16px rgba(22,199,132,0.55)",
                              "0 0 0 rgba(22,199,132,0.0)"
                            ]
                          }}
                          transition={{
                            duration: 0.8,
                            ease: "easeInOut",
                            repeat: engineDepositTouched ? 0 : Infinity,
                            repeatDelay: 2
                          }}
                        >
                          <span>x{engineMultiplier.toFixed(2)}</span>
                        </motion.p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] text-[#9CA3AF]">Projected Growth</p>
                        <p className="text-base font-semibold text-[#16C784]">
                          ${engineProjectedGrowth.toLocaleString(undefined, {
                            maximumFractionDigits: 0
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] text-[#9CA3AF]">Growth trajectory</p>
                      <div className="relative h-28 rounded-2xl bg-[#0F0F10]">
                        <svg
                          className="absolute inset-0 h-full w-full"
                          viewBox="0 0 200 100"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <linearGradient
                              id="multiplier-line"
                              x1="0"
                              y1="0"
                              x2="1"
                              y2="0"
                            >
                              <stop offset="0%" stopColor="#16C784" stopOpacity="0.2" />
                              <stop offset="60%" stopColor="#C6A15B" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#F97316" stopOpacity="0.7" />
                            </linearGradient>
                          </defs>
                          <motion.polyline
                            key={`${engineDeposit}-${engineLevel}`}
                            points={engineChartSeries
                              .map((value, index) => {
                                const x = (index / (engineChartSeries.length - 1)) * 200;
                                const maxValue =
                                  Math.max(...engineChartSeries) || engineProjectedGrowth || 1;
                                const normalized = Math.max(
                                  0,
                                  Math.min(1, value / maxValue)
                                );
                                const y = 100 - normalized * 90 - 5;
                                return `${x},${y}`;
                              })
                              .join(" ")}
                            fill="none"
                            stroke="url(#multiplier-line)"
                            strokeWidth="2"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{
                              duration: 1.4,
                              ease: "easeInOut"
                            }}
                          />
                        </svg>
                        <div className="pointer-events-none absolute inset-0">
                          <div className="absolute inset-x-0 bottom-2 flex justify-between px-3 text-[10px] text-[#6B7280]">
                            <span>Today</span>
                            <span>Projected</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-[#26272B] pt-4">
                    <p className="text-[11px] text-[#9CA3AF]">
                      Your multiplier increases automatically as your approved deposits grow.
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Higher levels unlock stronger earnings amplification across the entire
                      platform.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-5 py-2.5 text-xs font-semibold text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_24px_rgba(198,161,91,0.5)] transition-all hover:scale-105 sm:w-auto"
                  >
                    <span>Start Unlocking Multipliers</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToLandingSection("leaderboard")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#26272B] bg-[#17181A] px-5 py-2.5 text-xs font-semibold text-[#F5F5F7] hover:bg-[#1F2023] hover:border-[#C6A15B]/40 transition-all sm:w-auto"
                  >
                    <span>View Top Depositors</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="leaderboard"
          ref={leaderboardSectionRef}
          className="w-full bg-[#0F0F10] px-4 py-16 border-t border-[#26272B] sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                Leaderboards &amp; community
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                See who&apos;s leading the platform
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF] max-w-xl">
                Track the top depositors, fastest growing portfolios, and highest earning
                members building momentum inside the community.
              </p>
            </div>

            <div className="grid min-w-0 gap-10 lg:grid-cols-2 items-start">
              <div className="min-w-0 space-y-6">
                <div className="flex flex-wrap items-center gap-2 rounded-full bg-[#111214] px-1.5 py-1 text-[11px]">
                  {(
                    [
                      { id: "topDepositors", label: "Top Depositors" },
                      { id: "weeklyEarners", label: "Weekly Earners" },
                      { id: "fastestGrowing", label: "Fastest Growing" }
                    ] as { id: LeaderboardCategory; label: string }[]
                  ).map((tab) => {
                    const isActive = activeLeaderboardTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveLeaderboardTab(tab.id)}
                        className={`relative inline-flex items-center rounded-full px-3 py-1 transition-colors ${
                          isActive
                            ? "text-[#0F0F10]"
                            : "text-[#9CA3AF] hover:text-[#F5F5F7]"
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="leaderboard-tab-pill"
                            className="absolute inset-0 rounded-full bg-[#C6A15B]"
                            transition={{ type: "spring", stiffness: 260, damping: 24 }}
                          />
                        )}
                        <span className="relative z-10">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] px-1">
                    <span>Rank</span>
                    <span>User</span>
                    <span className="text-right">Score</span>
                  </div>
                  <div className="space-y-1">
                    {LEADERBOARD_DATA[activeLeaderboardTab].map((row, index) => {
                      const rank = index + 1;
                      let badge = "";
                      let accentClass = "text-[#F5F5F7]";
                      if (rank === 1) {
                        badge = "🥇";
                        accentClass = "text-[#FACC15]";
                      } else if (rank === 2) {
                        badge = "🥈";
                        accentClass = "text-[#E5E7EB]";
                      } else if (rank === 3) {
                        badge = "🥉";
                        accentClass = "text-[#FB923C]";
                      }
                      return (
                        <motion.div
                          key={`${activeLeaderboardTab}-${row.username}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={
                            isLeaderboardSectionInView
                              ? { opacity: 1, y: 0 }
                              : { opacity: 0.4, y: 4 }
                          }
                          transition={{ duration: 0.25, delay: index * 0.05 }}
                          className="group rounded-xl px-3 py-2 text-[11px] text-[#9CA3AF] transition-all hover:bg-[#111214] hover:text-[#F5F5F7]"
                        >
                          <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 w-full">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 text-xs font-semibold ${accentClass}`}>
                            #{rank}
                          </span>
                          <div className="relative h-7 w-7">
                            <div className="absolute inset-0 rounded-full bg-[#0F0F10] shadow-[0_0_0_1px_rgba(38,39,43,1)] group-hover:shadow-[0_0_0_1px_rgba(198,161,91,0.9)]" />
                            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#17181A] text-[10px] font-semibold text-[#C6A15B]">
                              {row.username.charAt(0).toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-medium text-[#F5F5F7]">
                            {row.username}
                          </span>
                          <span className="text-[10px] text-[#6B7280]">
                            {activeLeaderboardTab === "fastestGrowing"
                              ? "7-day growth"
                              : activeLeaderboardTab === "weeklyEarners"
                              ? "Earnings this week"
                              : "Approved deposits"}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          {badge && <span className="text-base">{badge}</span>}
                          <span className="text-xs font-semibold text-[#F5F5F7]">
                            {row.scoreLabel}
                          </span>
                        </div>
                      </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 pt-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#9CA3AF]">Total platform deposits</p>
                    <p className="text-lg font-semibold text-[#F5F5F7]">
                      $
                      {safeStatTotalDeposits.toLocaleString(undefined, {
                        maximumFractionDigits: 0
                      })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#9CA3AF]">Active depositors</p>
                    <p className="text-lg font-semibold text-[#F5F5F7]">
                      {safeStatActiveDepositors.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-[#9CA3AF]">Highest multiplier achieved</p>
                    <p className="text-lg font-semibold text-[#16C784]">
                      x{safeStatHighestMultiplier.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Community activity
                  </p>
                  <p className="text-sm font-medium text-[#F5F5F7]">
                    Real users progressing through levels, unlocking boosts, and stacking
                    rewards.
                  </p>
                </div>
                <div className="rounded-3xl bg-[#17181A]/60 px-4 py-4 sm:px-5 sm:py-5 backdrop-blur-sm">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                      <span>Live community feed</span>
                    </div>
                    <div className="space-y-1">
                      {COMMUNITY_EVENTS.map((event, index) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={
                            isLeaderboardSectionInView
                              ? { opacity: 1, y: 0 }
                              : { opacity: 0.6, y: 2 }
                          }
                          transition={{ duration: 0.25, delay: 0.1 + index * 0.05 }}
                          className="flex items-center justify-between rounded-xl px-2.5 py-2 text-[11px] text-[#F5F5F7]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#16C784]" />
                            <span>{event.text}</span>
                          </div>
                          <span className="text-[10px] text-[#6B7280]">
                            {event.timeAgo}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="buttons-row sm:flex sm:flex-wrap sm:gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate("/leaderboards")}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-5 py-2.5 text-xs font-semibold text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_24px_rgba(198,161,91,0.5)] transition-all hover:scale-105"
                  >
                    <span>View full leaderboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#26272B] bg-[#17181A] px-5 py-2.5 text-xs font-semibold text-[#F5F5F7] hover:bg-[#1F2023] hover:border-[#C6A15B]/40 transition-all"
                  >
                    <span>Create your account</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="security"
          ref={securitySectionRef}
          className="w-full bg-[#0B0B0D] px-4 py-16 border-t border-[#26272B] sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                Security &amp; trust
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                Security and transparency at every layer
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF] max-w-xl">
                Our infrastructure is designed to protect deposits, verify transactions, and
                maintain transparent reward mechanics across the platform.
              </p>
            </div>

            <div className="grid min-w-0 gap-10 lg:grid-cols-2 items-start">
              <div className="min-w-0 space-y-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <motion.div
                    whileHover={{
                      y: -2,
                      boxShadow: "0 18px 40px rgba(0,0,0,0.65)"
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 22 }}
                    className="group rounded-2xl bg-[#17181A]/70 px-4 py-4 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                        <motion.span
                          className="absolute inset-0 rounded-full bg-[#C6A15B]/25 blur-md opacity-0 group-hover:opacity-100"
                          animate={
                            isSecuritySectionInView
                              ? {
                                  opacity: [0.2, 0.45, 0.2]
                                }
                              : undefined
                          }
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <Shield className="relative h-4 w-4 text-[#C6A15B]" />
                      </div>
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        Secure wallet infrastructure
                      </p>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Deposits are processed through secure wallet infrastructure designed to
                      ensure accurate transaction verification and safe asset handling.
                    </p>
                  </motion.div>

                  {/* Reduced icon clutter by removing two non-essential tiles */}
                  {/* <motion.div
                    whileHover={{
                      y: -2,
                      boxShadow: "0 18px 40px rgba(0,0,0,0.65)"
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 22 }}
                    className="group rounded-2xl bg-[#17181A]/60 px-4 py-4 backdrop-blur-sm border border-[#26272B]/80"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                        <motion.span
                          className="absolute inset-0 rounded-full bg-[#16C784]/25 blur-md opacity-0 group-hover:opacity-100"
                          animate={
                            isSecuritySectionInView
                              ? {
                                  opacity: [0.2, 0.45, 0.2]
                                }
                              : undefined
                          }
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <CheckCircle2 className="relative h-4 w-4 text-[#16C784]" />
                      </div>
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        Transaction verification
                      </p>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF]">
                      All deposits are verified on-chain and approved through a structured review
                      process to maintain platform integrity.
                    </p>
                  </motion.div>

                  <motion.div
                    whileHover={{
                      y: -2,
                      boxShadow: "0 18px 40px rgba(0,0,0,0.65)"
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 22 }}
                    className="group rounded-2xl bg-[#17181A]/60 px-4 py-4 backdrop-blur-sm border border-[#26272B]/80"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                        <motion.span
                          className="absolute inset-0 rounded-full bg-[#38BDF8]/20 blur-md opacity-0 group-hover:opacity-100"
                          animate={
                            isSecuritySectionInView
                              ? {
                                  opacity: [0.2, 0.45, 0.2]
                                }
                              : undefined
                          }
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <Layers className="relative h-4 w-4 text-[#38BDF8]" />
                      </div>
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        Transparent multiplier system
                      </p>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Our multiplier engine is fully transparent, allowing users to see how deposit
                      levels translate into reward amplification.
                    </p>
                  </motion.div> */}
 
                  {/* <motion.div
                    whileHover={{
                      y: -2,
                      boxShadow: "0 18px 40px rgba(0,0,0,0.65)"
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 22 }}
                    className="group rounded-2xl bg-[#17181A]/60 px-4 py-4 backdrop-blur-sm border border-[#26272B]/80"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                        <motion.span
                          className="absolute inset-0 rounded-full bg-[#F97316]/20 blur-md opacity-0 group-hover:opacity-100"
                          animate={
                            isSecuritySectionInView
                              ? {
                                  opacity: [0.2, 0.45, 0.2]
                                }
                              : undefined
                          }
                          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <ShieldCheck className="relative h-4 w-4 text-[#F97316]" />
                      </div>
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        Platform integrity
                      </p>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Built with reliability in mind, the platform ensures fair distribution of
                      rewards while maintaining secure operational controls.
                    </p>
                  </motion.div> */}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-[11px] text-[#9CA3AF]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                      <Lock className="h-3.5 w-3.5 text-[#C6A15B]" />
                    </div>
                    <span>Transparent reward mechanics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#16C784]" />
                    </div>
                    <span>Secure transaction verification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                      <Users className="h-3.5 w-3.5 text-[#38BDF8]" />
                    </div>
                    <span>Community-driven growth</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                      <Shield className="h-3.5 w-3.5 text-[#F97316]" />
                    </div>
                    <span>Reliable platform infrastructure</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-5 py-2.5 text-xs font-semibold text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_24px_rgba(198,161,91,0.5)] transition-all hover:scale-105 sm:w-auto"
                  >
                    <span>Start Depositing Securely</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/deposit")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#26272B] bg-[#17181A] px-5 py-2.5 text-xs font-semibold text-[#F5F5F7] hover:bg-[#1F2023] hover:border-[#C6A15B]/40 transition-all sm:w-auto"
                  >
                    <span>Learn How Deposit Works</span>
                  </button>
                </div>
              </div>

              <div className="space-y-6 rounded-3xl bg-[#17181A]/60 px-4 py-5 sm:px-6 sm:py-6 backdrop-blur-sm shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Verification flow
                  </p>
                  <p className="text-sm font-medium text-[#F5F5F7]">
                    How deposits move through the security pipeline.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-5 top-4 bottom-4 w-px bg-gradient-to-b from-[#C6A15B] via-[#16C784] to-[#38BDF8]/80" />
                    <div className="space-y-4 pl-10">
                      {[
                        {
                          id: "user-deposit",
                          label: "User deposit",
                          description:
                            "You initiate a deposit to your unique platform address."
                        },
                        {
                          id: "chain-verification",
                          label: "Blockchain verification",
                          description:
                            "Our infrastructure monitors the network and confirms on-chain transactions."
                        },
                        {
                          id: "platform-approval",
                          label: "Platform approval",
                          description:
                            "Deposits are reviewed and approved through structured operational controls."
                        },
                        {
                          id: "multiplier-rewards",
                          label: "Multiplier rewards",
                          description:
                            "Once approved, multipliers and rewards are applied according to your level."
                        }
                      ].map((step, index) => (
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={
                            isSecuritySectionInView
                              ? {
                                  opacity: 1,
                                  y: 0
                                }
                              : undefined
                          }
                          transition={{
                            duration: 0.35,
                            delay: 0.1 + index * 0.08
                          }}
                          className="relative flex items-start gap-3"
                        >
                          <div className="relative mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                            <motion.div
                              className="absolute inset-1 rounded-full bg-gradient-to-br from-[#C6A15B]/10 via-[#16C784]/10 to-[#38BDF8]/10"
                              animate={
                                isSecuritySectionInView
                                  ? {
                                      opacity: [0.6, 1, 0.6]
                                    }
                                  : undefined
                              }
                              transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: index * 0.2
                              }}
                            />
                            {index === 0 && (
                              <Users className="relative h-3.5 w-3.5 text-[#C6A15B]" />
                            )}
                            {index === 1 && (
                              <Network className="relative h-3.5 w-3.5 text-[#38BDF8]" />
                            )}
                            {index === 2 && (
                              <ShieldCheck className="relative h-3.5 w-3.5 text-[#16C784]" />
                            )}
                            {index === 3 && (
                              <Sparkles className="relative h-3.5 w-3.5 text-[#F97316]" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-[#F5F5F7]">
                              {step.label}
                            </p>
                            <p className="text-[11px] text-[#9CA3AF]">
                              {step.description}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 rounded-2xl bg-[#0F0F10] border border-[#26272B] px-3 py-3 space-y-2">
                    <p className="text-[11px] text-[#9CA3AF]">
                      Each step is monitored and logged to maintain a transparent, auditable
                      rewards engine.
                    </p>
                    <p className="text-[11px] text-[#6B7280]">
                      Admin approvals and on-chain verification work together to safeguard your
                      deposits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={referralSectionRef}
          className="w-full bg-[#0F0F10] px-4 py-16 border-t border-[#26272B] sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                Referral growth engine
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                Grow your network. Boost your rewards.
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF] max-w-xl">
                Invite others to the platform and unlock additional growth opportunities through
                our referral system.
              </p>
            </div>

            <div className="grid min-w-0 gap-10 lg:grid-cols-2 items-start">
              <div className="min-w-0 space-y-6 rounded-3xl bg-[#17181A]/60 px-4 py-5 sm:px-6 sm:py-6 backdrop-blur-sm shadow-[0_18px_45px_rgba(0,0,0,0.65)]">
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Referral network
                  </p>
                  <p className="text-sm font-medium text-[#F5F5F7]">
                    Watch your network expand as referrals join and participate.
                  </p>
                </div>
                <div className="relative h-60">
                  <motion.svg
                    viewBox="0 0 260 200"
                    className="h-full w-full text-[#C6A15B]"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#C6A15B" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#C6A15B" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <motion.line
                      x1="130"
                      y1="90"
                      x2="70"
                      y2="50"
                      stroke="#26272B"
                      strokeWidth="1.2"
                      initial={{ pathLength: 0 }}
                      animate={
                        isReferralSectionInView
                          ? {
                              pathLength: 1
                            }
                          : undefined
                      }
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                    <motion.line
                      x1="130"
                      y1="90"
                      x2="190"
                      y2="50"
                      stroke="#26272B"
                      strokeWidth="1.2"
                      initial={{ pathLength: 0 }}
                      animate={
                        isReferralSectionInView
                          ? {
                              pathLength: 1
                            }
                          : undefined
                      }
                      transition={{ duration: 0.8, delay: 0.1, ease: "easeInOut" }}
                    />
                    <motion.line
                      x1="130"
                      y1="90"
                      x2="60"
                      y2="140"
                      stroke="#26272B"
                      strokeWidth="1.2"
                      initial={{ pathLength: 0 }}
                      animate={
                        isReferralSectionInView
                          ? {
                              pathLength: 1
                            }
                          : undefined
                      }
                      transition={{ duration: 0.8, delay: 0.2, ease: "easeInOut" }}
                    />
                    <motion.line
                      x1="130"
                      y1="90"
                      x2="200"
                      y2="145"
                      stroke="#26272B"
                      strokeWidth="1.2"
                      initial={{ pathLength: 0 }}
                      animate={
                        isReferralSectionInView
                          ? {
                              pathLength: 1
                            }
                          : undefined
                      }
                      transition={{ duration: 0.8, delay: 0.3, ease: "easeInOut" }}
                    />
                    <motion.line
                      x1="60"
                      y1="140"
                      x2="40"
                      y2="180"
                      stroke="#26272B"
                      strokeWidth="1.2"
                      initial={{ pathLength: 0 }}
                      animate={
                        isReferralSectionInView
                          ? {
                              pathLength: 1
                            }
                          : undefined
                      }
                      transition={{ duration: 0.8, delay: 0.4, ease: "easeInOut" }}
                    />
                    <motion.line
                      x1="200"
                      y1="145"
                      x2="230"
                      y2="185"
                      stroke="#26272B"
                      strokeWidth="1.2"
                      initial={{ pathLength: 0 }}
                      animate={
                        isReferralSectionInView
                          ? {
                              pathLength: 1
                            }
                          : undefined
                      }
                      transition={{ duration: 0.8, delay: 0.5, ease: "easeInOut" }}
                    />

                    <motion.circle
                      cx="130"
                      cy="90"
                      r="16"
                      fill="#17181A"
                      stroke="#C6A15B"
                      strokeWidth="1.5"
                    />
                    <motion.circle
                      cx="130"
                      cy="90"
                      r={26}
                      fill="url(#nodeGlow)"
                      opacity={0.6}
                      animate={
                        isReferralSectionInView
                          ? {
                              r: [22, 28, 22],
                              opacity: [0.3, 0.6, 0.3]
                            }
                          : {
                              r: 26,
                              opacity: 0.35
                            }
                      }
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <text
                      x="130"
                      y="93"
                      textAnchor="middle"
                      className="fill-[#F5F5F7] text-[8px] font-semibold"
                    >
                      YOU
                    </text>

                    {[
                      { cx: 70, cy: 50, avatarIndex: 0, delay: 0.1 },
                      { cx: 190, cy: 50, avatarIndex: 1, delay: 0.15 },
                      { cx: 60, cy: 140, avatarIndex: 2, delay: 0.2 },
                      { cx: 200, cy: 145, avatarIndex: 3, delay: 0.25 },
                      { cx: 40, cy: 180, avatarIndex: 4, delay: 0.3 },
                      { cx: 230, cy: 185, avatarIndex: 5, delay: 0.35 }
                    ].map((node) => (
                      <motion.g
                        key={node.avatarIndex}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={
                          isReferralSectionInView
                            ? {
                                opacity: 1,
                                scale: 1
                              }
                            : undefined
                        }
                        transition={{
                          duration: 0.35,
                          delay: 0.2 + node.delay
                        }}
                      >
                        <circle cx={node.cx} cy={node.cy} r="14" fill="url(#nodeGlow)" opacity="0.4" />
                        <foreignObject x={node.cx - 10} y={node.cy - 10} width="20" height="20">
                          <img
                            alt="user avatar"
                            className="h-5 w-5 rounded-full border border-[#111827] bg-[#17181A]"
                            src={`data:image/svg+xml;utf8,${encodeURIComponent(
                              `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' rx='20' ry='20' fill='${
                                TESTIMONIALS[node.avatarIndex % TESTIMONIALS.length].avatarColor
                              }'/><text x='50%' y='56%' text-anchor='middle' dominant-baseline='middle' font-size='14' font-family='Inter, Arial, sans-serif' fill='#F5F5F7'>${
                                TESTIMONIALS[node.avatarIndex % TESTIMONIALS.length].username
                                  .split(' ')
                                  .map((p) => p[0])
                                  .join('')
                              }</text></svg>`
                            )}`}
                          />
                        </foreignObject>
                      </motion.g>
                    ))}
                  </motion.svg>
                </div>

                <div className="grid gap-3 text-[11px] text-[#9CA3AF]">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                      <Users className="h-3.5 w-3.5 text-[#C6A15B]" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        Instant referral rewards
                      </p>
                      <p>
                        Users receive referral bonuses when new members join and participate on
                        the platform.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                      <TrendingUp className="h-3.5 w-3.5 text-[#16C784]" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        Multiplier boost
                      </p>
                      <p>
                        Growing your referral network contributes to your overall growth
                        potential and multiplier opportunities.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#0F0F10] border border-[#26272B]">
                      <Sparkles className="h-3.5 w-3.5 text-[#C6A15B]" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        Community expansion
                      </p>
                      <p>
                        A larger network strengthens the community and creates more activity
                        across the platform.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl bg-[#17181A]/60 px-4 py-5 sm:px-6 sm:py-6 backdrop-blur-sm">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                        Referral link preview
                      </p>
                      <p className="text-sm font-medium text-[#F5F5F7]">
                        Share your personal invite link in a couple of taps.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[#F5F5F7]">Your referral link</p>
                      <div className="rounded-2xl bg-[#0F0F10]/95 px-3 py-3 space-y-1">
                        <p className="text-[11px] text-[#9CA3AF]">
                          nexacrypto.app/ref/your-code
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(referralLink);
                              } catch {
                                // noop – best-effort copy
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#17181A] px-3 py-1.5 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy link</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (navigator.share) {
                                try {
                                  await navigator.share({
                                    title: "Join NexaCrypto",
                                    text: "Start earning with intelligent crypto multipliers.",
                                    url: referralLink
                                  });
                                } catch {
                                  // user canceled or share failed – ignore
                                }
                              } else {
                                window.open(
                                  `mailto:?subject=${encodeURIComponent(
                                    "Join NexaCrypto"
                                  )}&body=${encodeURIComponent(referralLink)}`,
                                  "_blank",
                                  "noopener,noreferrer"
                                );
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[#17181A] px-3 py-1.5 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs font-medium text-[#F5F5F7]">Share via</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            const url = `https://t.me/share/url?url=${encodeURIComponent(
                              referralLink
                            )}`;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#17181A] px-3 py-1.5 text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
                        >
                          <Send className="h-3.5 w-3.5 text-[#28A8E9]" />
                          <span>Telegram</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const url = `https://wa.me/?text=${encodeURIComponent(
                              `Join me on NexaCrypto: ${referralLink}`
                            )}`;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#17181A] px-3 py-1.5 text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
                        >
                          <FaWhatsapp className="h-3.5 w-3.5 text-[#25D366]" />
                          <span>WhatsApp</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                              `Start growing your crypto with NexaCrypto ${referralLink}`
                            )}`;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#17181A] px-3 py-1.5 text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
                        >
                          <FaTwitter className="h-3.5 w-3.5 text-[#F5F5F7]" />
                          <span>X</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const url = `mailto:?subject=${encodeURIComponent(
                              "Join NexaCrypto"
                            )}&body=${encodeURIComponent(referralLink)}`;
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#17181A] px-3 py-1.5 text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5 text-[#F97316]" />
                          <span>Email</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl bg-[#0F0F10] border border-[#26272B] px-3 py-3 flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                          Community members
                        </p>
                        <p className="text-xl font-semibold text-[#F5F5F7]">
                          {safeCommunityMembers.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          Users growing the network with live referrals.
                        </p>
                      </div>
                      <div className="flex items-center justify-center rounded-full bg-[#17181A] border border-[#26272B] px-3 py-2">
                        <Users className="h-4 w-4 text-[#C6A15B]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="buttons-row sm:flex sm:flex-wrap sm:gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/referrals")}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-5 py-2.5 text-xs font-semibold text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_24px_rgba(198,161,91,0.5)] transition-all hover:scale-105"
                  >
                    <span>Start building your network</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/referrals")}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#26272B] bg-[#17181A] px-5 py-2.5 text-xs font-semibold text-[#F5F5F7] hover:bg-[#1F2023] hover:border-[#C6A15B]/40 transition-all"
                  >
                    <span>View referral rewards</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={marketSectionRef}
          className="w-full bg-[#0B0B0D] px-4 py-16 border-t border-[#26272B] sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                Live markets
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                Connected to the global crypto market
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF] max-w-xl">
                Track major crypto assets and monitor market movement while growing your portfolio
                on the platform.
              </p>
            </div>

            <div className="grid min-w-0 gap-10 lg:grid-cols-2 items-start">
              <div className="min-w-0 space-y-6">
                <div className="rounded-3xl bg-[#17181A]/60 px-4 py-4 sm:px-5 sm:py-5 backdrop-blur-sm">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                        Live market ticker
                      </p>
                      <p className="text-xs text-[#9CA3AF]">
                        Prices mirror live market data from our backend market engine.
                      </p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">
                      12s auto refresh
                    </span>
                  </div>
                  <div className="relative h-14 overflow-hidden rounded-2xl bg-[#0F0F10] border border-[#26272B]">
                    <motion.div
                      className="absolute inset-y-0 left-0 inline-flex w-max items-center"
                      animate={{
                        x: ["0%", "-50%"]
                      }}
                      transition={{
                        duration: 40,
                        ease: "linear",
                        repeat: Infinity
                      }}
                    >
                      {[...MARKET_TICKER_SYMBOLS, ...MARKET_TICKER_SYMBOLS].map((symbol, idx) => {
                        const item = marketData[symbol];
                        const change = item?.change24h ?? 0;
                        const isUp = change >= 0;
                        const priceLabel = item?.price
                          ? `$${item.price.toLocaleString(undefined, {
                              maximumFractionDigits: 2
                            })}`
                          : "--";
                        const changeLabel = item
                          ? `${isUp ? "+" : ""}${change.toFixed(2)}%`
                          : "--";
                        return (
                          <div
                            key={`${symbol}-${idx}`}
                            className="flex items-center gap-2 px-4 text-[11px] text-[#F5F5F7] border-r border-[#26272B]/60 hover:bg-[#17181A] hover:shadow-[0_0_18px_rgba(0,0,0,0.75)] transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{symbol}</span>
                            </div>
                            <span className="text-xs text-[#E5E7EB]">
                              {marketLoading && !item ? "Loading..." : priceLabel}
                            </span>
                            <span
                              className={
                                isUp
                                  ? "text-[11px] text-[#16C784]"
                                  : "text-[11px] text-[#EA3943]"
                              }
                            >
                              {changeLabel}
                            </span>
                          </div>
                        );
                      })}
                    </motion.div>
                  </div>

                  <div className="mt-5 space-y-2 rounded-2xl bg-[#0F0F10] border border-[#26272B] px-3 py-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                          Market sentiment
                        </p>
                        <p className="text-xs font-medium text-[#F5F5F7]">
                          Crypto market trend
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-28 rounded-2xl bg-[#0F0F10] relative overflow-hidden">
                      <svg
                        className="absolute inset-0 h-full w-full"
                        viewBox="0 0 200 100"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="sentiment-line" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#16C784" stopOpacity="0.4" />
                            <stop offset="60%" stopColor="#C6A15B" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#F97316" stopOpacity="0.8" />
                          </linearGradient>
                          <linearGradient id="sentiment-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#16C784" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#0F0F10" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <motion.polyline
                          key={marketTrendSeries.join("-")}
                          points={marketTrendSeries
                            .map((value, index) => {
                              const x =
                                (index / Math.max(1, marketTrendSeries.length - 1)) * 200;
                              const clamped = Math.min(1.2, Math.max(0.8, value));
                              const normalized = (clamped - 0.8) / 0.4;
                              const y = 90 - normalized * 70;
                              return `${x},${y}`;
                            })
                            .join(" ")}
                          fill="none"
                          stroke="url(#sentiment-line)"
                          strokeWidth="2"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.5, ease: "easeInOut" }}
                        />
                        <motion.polygon
                          key={`fill-${marketTrendSeries.join("-")}`}
                          points={`${marketTrendSeries
                            .map((value, index) => {
                              const x =
                                (index / Math.max(1, marketTrendSeries.length - 1)) * 200;
                              const clamped = Math.min(1.2, Math.max(0.8, value));
                              const normalized = (clamped - 0.8) / 0.4;
                              const y = 90 - normalized * 70;
                              return `${x},${y}`;
                            })
                            .join(" ")} 200,100 0,100`}
                          fill="url(#sentiment-fill)"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 1.2, ease: "easeInOut" }}
                        />
                      </svg>
                      <div className="pointer-events-none absolute inset-0">
                        <div className="absolute inset-x-0 bottom-2 flex justify-between px-3 text-[10px] text-[#6B7280]">
                          <span>Calmer</span>
                          <span>Momentum building</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-5 py-2.5 text-xs font-semibold text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_24px_rgba(198,161,91,0.5)] transition-all hover:scale-105 sm:w-auto"
                    >
                      <span>Start Growing Your Portfolio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#26272B] bg-[#17181A] px-5 py-2.5 text-xs font-semibold text-[#F5F5F7] hover:bg-[#1F2023] hover:border-[#C6A15B]/40 transition-all sm:w-auto"
                    >
                      <span>Open Your Dashboard</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Supported assets
                  </p>
                  <p className="text-sm font-medium text-[#F5F5F7]">
                    Major crypto assets supported for deposits.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SUPPORTED_ASSETS.map((asset) => (
                    <motion.div
                      key={asset.id}
                      whileHover={{ y: -2 }}
                      className="group flex items-center justify-between rounded-2xl bg-[#17181A]/60 px-3 py-3 backdrop-blur-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9">
                          <div className="absolute inset-0 rounded-full bg-[#0F0F10] border border-[#26272B] shadow-[0_0_0_1px_rgba(15,15,16,1)] group-hover:shadow-[0_0_0_1px_rgba(198,161,91,0.9)] transition-shadow" />
                          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                            {asset.logo ? (
                              <motion.img
                                src={asset.logo}
                                alt={asset.name}
                                className="h-5 w-5"
                                loading="lazy"
                                whileHover={{ scale: 1.08 }}
                              />
                            ) : (
                              <motion.span
                                whileHover={{ scale: 1.05 }}
                                className="text-[10px] font-semibold text-[#F5F5F7]"
                              >
                                {asset.symbol}
                              </motion.span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-[#F5F5F7]">
                            {asset.name}
                          </span>
                          <span className="text-[11px] text-[#9CA3AF]">
                            {asset.symbol} · Supported for deposits
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={testimonialsSectionRef}
          className="w-full bg-[#0F0F10] px-4 py-16 border-t border-[#26272B] sm:px-6 lg:px-8"
        >
          <div className="mx-auto w-full max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                Social proof
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                Hear from our community
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF] max-w-xl">
                See how depositors are progressing, leveling up, and earning rewards with our
                platform.
              </p>
            </div>

            <div className="grid min-w-0 gap-10 lg:grid-cols-2 items-start">
              <div className="min-w-0 space-y-6">
                <div className="relative overflow-hidden rounded-3xl bg-[#17181A]/60 px-4 py-5 sm:px-6 sm:py-6 backdrop-blur-sm">
                  <div className="pointer-events-none absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C6A15B]/10 via-transparent to-[#16C784]/10" />
                  </div>
                  <div className="relative space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                          Testimonials
                        </p>
                        <p className="text-sm font-medium text-[#F5F5F7]">
                          Real progression stories from depositors.
                        </p>
                      </div>
                    </div>

                    {TESTIMONIALS.length > 0 && (
                      <motion.div
                        key={TESTIMONIALS[activeTestimonialIndex].id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="space-y-4 rounded-2xl bg-[#0F0F10]/80 border border-[#26272B] px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-[#F5F5F7] shadow-[0_0_0_1px_rgba(15,15,16,1)]"
                              style={{
                                backgroundColor:
                                  TESTIMONIALS[activeTestimonialIndex].avatarColor
                              }}
                            >
                              {TESTIMONIALS[activeTestimonialIndex].username
                                .split(" ")
                                .map((part) => part.charAt(0).toUpperCase())
                                .join("")}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-[#F5F5F7]">
                                {TESTIMONIALS[activeTestimonialIndex].username}
                              </span>
                              <span className="text-[11px] text-[#9CA3AF]">
                                Level {TESTIMONIALS[activeTestimonialIndex].level} depositor
                              </span>
                            </div>
                          </div>
                          <motion.span
                            className="text-xs font-semibold text-[#16C784]"
                            animate={
                              isTestimonialsSectionInView
                                ? { scale: [1, 1.06, 1] }
                                : undefined
                            }
                            transition={{ duration: 0.8, ease: "easeInOut", repeat: Infinity }}
                          >
                            x{TESTIMONIALS[activeTestimonialIndex].multiplier.toFixed(2)}
                          </motion.span>
                        </div>

                        <p className="text-[11px] text-[#D1D5DB]">
                          “{TESTIMONIALS[activeTestimonialIndex].quote}”
                        </p>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                            <span>
                              Level {TESTIMONIALS[activeTestimonialIndex].level} progress
                            </span>
                            <span>
                              {TESTIMONIALS[activeTestimonialIndex].levelProgress.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#111827] overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-[#16C784] via-[#C6A15B] to-[#F97316]"
                              initial={{ width: 0 }}
                              animate={{
                                width: `${TESTIMONIALS[activeTestimonialIndex].levelProgress}%`
                              }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                            <span>Approved deposits</span>
                            <span className="text-xs font-semibold text-[#F5F5F7]">
                              $
                              {TESTIMONIALS[
                                activeTestimonialIndex
                              ].approvedDeposits.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-1 pt-2">
                          {TESTIMONIALS.map((testimonial, index) => (
                            <button
                              key={testimonial.id}
                              type="button"
                              onClick={() => setActiveTestimonialIndex(index)}
                              className="h-1.5 w-4 rounded-full"
                              style={{
                                backgroundColor:
                                  index === activeTestimonialIndex
                                    ? "#C6A15B"
                                    : "rgba(75,85,99,1)"
                              }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("/register")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#C6A15B] px-5 py-2.5 text-xs font-semibold text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_24px_rgba(198,161,91,0.5)] transition-all hover:scale-105 sm:w-auto"
                  >
                    <span>Join the Growing Community</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#26272B] bg-[#17181A] px-5 py-2.5 text-xs font-semibold text-[#F5F5F7] hover:bg-[#1F2023] hover:border-[#C6A15B]/40 transition-all sm:w-auto"
                  >
                    <span>View Dashboard</span>
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl bg-[#17181A]/60 px-4 py-5 sm:px-6 sm:py-6 backdrop-blur-sm">
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                      Community stats
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1 rounded-2xl bg-[#0F0F10]/90 px-3 py-3 transition-colors">
                        <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                          <span>Total depositors</span>
                          <Users className="h-3.5 w-3.5 text-[#C6A15B]" />
                        </div>
                        <p className="text-lg font-semibold text-[#F5F5F7]">
                          {safeCommunityMembers.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-1 rounded-2xl bg-[#0F0F10]/90 px-3 py-3 transition-colors">
                        <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                          <span>Total deposits processed</span>
                          <Wallet className="h-3.5 w-3.5 text-[#16C784]" />
                        </div>
                        <p className="text-lg font-semibold text-[#F5F5F7]">
                          $
                          {safeStatTotalDeposits.toLocaleString(undefined, {
                            maximumFractionDigits: 0
                          })}
                        </p>
                      </div>
                      <div className="space-y-1 rounded-2xl bg-[#0F0F10]/90 px-3 py-3 transition-colors">
                        <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                          <span>Top level reached</span>
                          <Trophy className="h-3.5 w-3.5 text-[#FACC15]" />
                        </div>
                        <p className="text-lg font-semibold text-[#F5F5F7]">Level 10</p>
                      </div>
                      <div className="space-y-1 rounded-2xl bg-[#0F0F10]/90 px-3 py-3 transition-colors">
                        <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                          <span>Active today</span>
                          <Sparkles className="h-3.5 w-3.5 text-[#C6A15B]" />
                        </div>
                        <p className="text-lg font-semibold text-[#F5F5F7]">
                          {safeActiveToday.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="w-full bg-[#0B0B0D] px-4 py-16 border-t border-[#26272B] sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-6xl space-y-10">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                Frequently Asked Questions
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                Everything you need to know, explained transparently.
              </h2>
              <p className="text-sm sm:text-base text-[#9CA3AF]">
                Understand how deposits, withdrawals, levels, and multipliers work before you
                commit capital, with clear answers to the most common questions.
              </p>
            </div>

            <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
              <div className="min-w-0 space-y-3">
                {FAQ_ITEMS.map((item) => {
                  const isOpen = openFaqId === item.id;
                  const iconNode =
                    item.icon === "deposits" ? (
                      <Wallet className="h-4 w-4 text-[#C6A15B]" />
                    ) : item.icon === "withdrawals" ? (
                      <Timer className="h-4 w-4 text-[#C6A15B]" />
                    ) : item.icon === "levels" ? (
                      <LineChart className="h-4 w-4 text-[#C6A15B]" />
                    ) : item.icon === "safety" ? (
                      <ShieldCheck className="h-4 w-4 text-[#C6A15B]" />
                    ) : (
                      <HelpCircle className="h-4 w-4 text-[#C6A15B]" />
                    );

                  return (
                    <motion.div
                      key={item.id}
                      initial={false}
                      animate={{
                        boxShadow: isOpen
                          ? "0 18px 40px rgba(0,0,0,0.7)"
                          : "0 0 0 rgba(0,0,0,0)"
                      }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden rounded-2xl bg-[#17181A]/70 px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-sm"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaqId((current) => (current === item.id ? null : item.id))
                        }
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <div className="flex flex-1 items-center gap-3">
                          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#0F0F10]">
                            <motion.span
                              className="absolute inset-0 rounded-full bg-[#C6A15B]/25 blur-md"
                              initial={false}
                              animate={{ opacity: isOpen ? 1 : 0 }}
                              transition={{ duration: 0.2 }}
                            />
                            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[#111214]">
                              {iconNode}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#F5F5F7]">{item.question}</p>
                            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">{item.summary}</p>
                          </div>
                        </div>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111214] text-[11px] text-[#9CA3AF]">
                          <ArrowRightCircle
                            className={`h-3.5 w-3.5 transition-transform duration-200 ${
                              isOpen ? "rotate-90 text-[#C6A15B]" : ""
                            }`}
                          />
                        </span>
                      </button>
                      <motion.div
                        initial={false}
                        animate={{
                          height: isOpen ? "auto" : 0,
                          opacity: isOpen ? 1 : 0,
                          marginTop: isOpen ? 12 : 0
                        }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="overflow-hidden text-xs leading-relaxed text-[#9CA3AF]"
                      >
                        <p>{item.answer}</p>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-3xl bg-[#17181A]/60 px-5 py-5 backdrop-blur-sm">
                  <div className="pointer-events-none absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C6A15B]/15 via-transparent to-[#16C784]/15" />
                  </div>
                  <div className="relative space-y-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                      Risk & clarity
                    </p>
                    <p className="text-sm font-medium text-[#F5F5F7]">
                      The platform is designed to make every step of your crypto journey explicit —
                      from deposit to withdrawal.
                    </p>
                    <ul className="space-y-2.5 text-[11px] text-[#9CA3AF]">
                      <li className="relative pl-3">
                        <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-[#C6A15B]" />
                        On-chain verification, admin review, and clear level thresholds work together
                        to keep behavior predictable.
                      </li>
                      <li className="relative pl-3">
                        <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-[#9CA3AF]" />
                        Custodial wallets and internal controls focus on security, while the multiplier
                        engine remains fully transparent.
                      </li>
                      <li className="relative pl-3">
                        <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-[#16C784]" />
                        Blockchain data, progression rules, and reward logic are aligned so your XP and
                        levels always match reality.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="rounded-3xl bg-[#0F0F10]/80 px-5 py-5 backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                    Transparency promise
                  </p>
                  <p className="mt-2 text-xs text-[#D1D5DB]">
                    Before you deposit, you can see how every mechanic works — verification, levels,
                    multipliers, and withdrawals — with no dark corners or hidden rules.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-stretch justify-between gap-4 rounded-3xl bg-[#0F0F10]/80 px-5 py-5 sm:items-center sm:px-7 sm:py-6 backdrop-blur-sm">
              <div className="space-y-1 max-w-xl">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                  Ready when you are
                </p>
                <p className="text-sm font-medium text-[#F5F5F7]">
                  Move from questions to action with a platform built for transparent crypto growth.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#C6A15B] to-[#FACC15] px-5 py-2.5 text-center text-xs font-semibold text-[#0F0F10] shadow-[0_0_24px_rgba(198,161,91,0.6)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(198,161,91,0.8)] sm:w-auto"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#17181A] px-5 py-2.5 text-center text-xs font-semibold text-[#F5F5F7] shadow-[0_0_18px_rgba(0,0,0,0.7)] transition-colors hover:bg-[#1F2023] sm:w-auto"
                >
                  <span>View Full Dashboard</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
