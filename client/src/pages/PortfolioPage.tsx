import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from "recharts";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import { BalanceToggle, useBalanceVisibility } from "../components/BalanceVisibilityProvider";
import btcLogo from "../assets/crypto/btc.svg";
import ethLogo from "../assets/crypto/eth.svg";
import solLogo from "../assets/crypto/sol.svg";
import usdtLogo from "../assets/crypto/usdt.svg";

type SupportedSymbol = "BTC" | "ETH" | "SOL" | "USDT";

interface AssetSummary {
  symbol: SupportedSymbol;
  totalDeposited: number;
  currentValue: number;
}

interface GrowthPoint {
  date: string;
  deposited: number;
  value: number;
}

interface PortfolioResponse {
  assets: AssetSummary[];
  totalCurrentValue: number;
  pendingEarnings: number;
  totalPlatformBalance: number;
  growthSeries: GrowthPoint[];
  projectedEarnings: {
    currentMultiplier: number;
    projectedValue: number;
  };
}

interface MultiplierPreview {
  baseMultiplier: number;
  streakBonus: number;
  timeBonus: number;
  referralBonus: number;
  totalMultiplier: number;
}

interface DepositLevelInfo {
  level: number;
  totalDepositedUsd: number;
  currentLevelRequiredTotal: number;
  nextLevel: number | null;
  nextLevelRequiredTotal: number | null;
  remainingToNext: number | null;
}

interface ProgressionResponse {
  multiplierPreview: MultiplierPreview;
  pendingEarningsTotal: number;
  depositLevel: number;
  totalDepositedUsd: number;
  depositCurrentLevelRequiredTotal: number;
  depositNextLevel: number | null;
  depositNextLevelRequiredTotal: number | null;
  depositRemainingToNext: number | null;
}

interface MarketDataPoint {
  symbol: SupportedSymbol;
  price: number;
  change24h: number;
  marketCap: number;
  lastUpdated: string;
}

type MarketResponse = Record<string, MarketDataPoint>;

const pieColors: Record<SupportedSymbol, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#16C784",
  USDT: "#26A17B"
};

const assetLogos: Record<SupportedSymbol, string> = {
  BTC: btcLogo,
  ETH: ethLogo,
  SOL: solLogo,
  USDT: usdtLogo
};

const assetNames: Record<SupportedSymbol, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  USDT: "Tether (USDT)"
};

function useAnimatedNumber(target: number, durationMs: number): number {
  const [value, setValue] = useState<number>(target);

  useEffect(() => {
    let frame: number | null = null;
    const start = performance.now();
    const initial = value;
    const delta = target - initial;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(initial + delta * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [target, durationMs]);

  return value;
}

export function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [progression, setProgression] = useState<ProgressionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [market, setMarket] = useState<MarketResponse>({});
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [portfolioRes, progressionRes] = await Promise.all([
          api.get<PortfolioResponse>("/portfolio/summary"),
          api.get<ProgressionResponse>("/user/current_xp_level")
        ]);
        if (!isMounted) {
          return;
        }
        setPortfolio(portfolioRes.data);
        setProgression(progressionRes.data);
      } catch {
        if (isMounted) {
          setError("Failed to load portfolio");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadMarket = async () => {
      try {
        const res = await api.get<MarketResponse>("/market/prices");
        if (!isMounted) {
          return;
        }
        setMarket(res.data);
      } catch {
        if (isMounted) {
          setMarket({});
        }
      }
    };

    loadMarket();
    const interval = setInterval(loadMarket, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const safeAssets: AssetSummary[] = useMemo(() => {
    const existing = portfolio?.assets ?? [];
    const map: Partial<Record<SupportedSymbol, AssetSummary>> = {};
    existing.forEach((asset) => {
      map[asset.symbol] = asset;
    });
    const symbols: SupportedSymbol[] = ["BTC", "ETH", "SOL", "USDT"];
    return symbols.map((symbol) => {
      const current = map[symbol];
      return {
        symbol,
        totalDeposited: current?.totalDeposited ?? 0,
        currentValue: current?.currentValue ?? 0
      };
    });
  }, [portfolio]);

  const liveAssets: AssetSummary[] = useMemo(() => {
    return safeAssets.map((asset) => {
      const entry = market[asset.symbol];
      const liveValue =
        entry && typeof entry.price === "number"
          ? asset.totalDeposited * entry.price
          : asset.currentValue;
      return {
        ...asset,
        currentValue: liveValue
      };
    });
  }, [safeAssets, market]);

  const allocationData = useMemo(
    () =>
      liveAssets.map((asset) => ({
        name: asset.symbol,
        value: asset.currentValue
      })),
    [liveAssets]
  );

  const hasAnyDeposits = useMemo(
    () => liveAssets.some((asset) => asset.totalDeposited > 0),
    [liveAssets]
  );

  const growthSeries = useMemo(() => {
    if (portfolio && portfolio.growthSeries.length > 0) {
      return portfolio.growthSeries;
    }
    return [
      { date: "Start", deposited: 0, value: 0 },
      { date: "Now", deposited: 0, value: 0 }
    ];
  }, [portfolio]);

  const liveTotalCurrentValue = useMemo(
    () =>
      liveAssets.reduce((sum, asset) => {
        return sum + asset.currentValue;
      }, 0),
    [liveAssets]
  );

  const animatedTotalValue = useAnimatedNumber(liveTotalCurrentValue, 600);
  const animatedProjectedValue = useAnimatedNumber(
    portfolio?.projectedEarnings.projectedValue ?? 0,
    600
  );
  const animatedPendingEarnings = useAnimatedNumber(
    portfolio?.pendingEarnings ?? 0,
    600
  );

  const totalMultiplier = portfolio?.projectedEarnings.currentMultiplier ?? 1;
  const baseMultiplier = progression?.multiplierPreview.baseMultiplier ?? 1;
  const boostMultiplier = Math.max(totalMultiplier - baseMultiplier, 0);

  const depositInfo: DepositLevelInfo | null = useMemo(() => {
    if (!progression) {
      return null;
    }
    return {
      level: progression.depositLevel,
      totalDepositedUsd: progression.totalDepositedUsd,
      currentLevelRequiredTotal: progression.depositCurrentLevelRequiredTotal,
      nextLevel: progression.depositNextLevel,
      nextLevelRequiredTotal: progression.depositNextLevelRequiredTotal,
      remainingToNext: progression.depositRemainingToNext
    };
  }, [progression]);

  const progressToNextBoost = useMemo(() => {
    if (!depositInfo || depositInfo.nextLevelRequiredTotal === null) {
      return 1;
    }
    if (depositInfo.nextLevelRequiredTotal === 0) {
      return 1;
    }
    const clamped = Math.min(
      depositInfo.totalDepositedUsd / depositInfo.nextLevelRequiredTotal,
      1
    );
    return clamped;
  }, [depositInfo]);

  const handleQuickDeposit = (symbol: SupportedSymbol) => {
    const assetParam = symbol === "USDT" ? "ERC20" : symbol;
    navigate(`/deposit?asset=${assetParam}`);
  };

  const totalCurrentValue = liveTotalCurrentValue;

  const { hidden, mask } = useBalanceVisibility();
  return (
    <div className="page-responsive borderless-ui space-y-12">
      <Seo
        title="Portfolio – live valuation and projections"
        description="Track your custodial portfolio value, pending earnings, growth series and multiplier projections powered by live market data."
        path="/portfolio"
      />
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
          Portfolio
        </h1>
        <p className="text-sm text-[#9CA3AF] max-w-xl">
          Track your total portfolio value, multiplier-powered projections, and
          how your crypto is allocated across assets.
        </p>
      </section>

      {error && (
        <p className="text-xs text-[#EA3943] bg-[#17181A] rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-[#17181A]/60 px-6 py-6 sm:px-8 sm:py-8 backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <svg
            aria-hidden="true"
            className="h-full w-full"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="hero-grid" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#26272B" />
                <stop offset="1" stopColor="#17181A" />
              </linearGradient>
            </defs>
            <path
              d="M0 160 C 80 140, 120 120, 200 100 C 260 85, 320 60, 400 40"
              fill="none"
              stroke="url(#hero-grid)"
              strokeWidth="2"
            />
            <path
              d="M0 190 C 70 170, 150 150, 220 130 C 300 105, 340 90, 400 70"
              fill="none"
              stroke="url(#hero-grid)"
              strokeWidth="1"
            />
          </svg>
        </div>

        <div className="relative grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
            <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
                Portfolio value
              </p>
              <div className="flex items-center gap-2">
                <p className="text-4xl sm:text-[42px] font-semibold tracking-tight text-[#F5F5F7]">
                  {loading
                    ? "$0.00"
                    : hidden
                    ? mask("$******")
                    : `$${animatedTotalValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`}
                </p>
                <BalanceToggle />
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Pending earnings
                </p>
                <p className="text-lg font-medium text-[#16C784]">
                  {loading ? "0.0000" : hidden ? mask("******") : animatedPendingEarnings.toFixed(4)}
                </p>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Projected value with multipliers
                </p>
                <p className="text-lg font-medium text-[#F5F5F7]">
                  {loading
                    ? "$0.00"
                    : hidden
                    ? mask("$******")
                    : `$${animatedProjectedValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`}
                </p>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Current multiplier
                </p>
                <p className="inline-flex items-baseline gap-1 text-xl font-semibold text-[#C6A15B]">
                  <span className="relative">
                    <span className="absolute -inset-1 rounded-full bg-[#C6A15B]/20 blur-[10px]" />
                    <span className="relative drop-shadow-[0_0_12px_rgba(198,161,91,0.45)]">
                      x{totalMultiplier.toFixed(2)}
                    </span>
                  </span>
                </p>
              </div>
            </div>

            <div className="pt-2 space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                Total platform deposits
              </p>
              <p className="text-sm font-medium text-[#F5F5F7]">
                {portfolio
                  ? hidden
                    ? mask("$******")
                    : `$${portfolio.totalPlatformBalance.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`
                  : "--"}
              </p>
              <p className="text-xs text-[#9CA3AF]">
                You are part of a live, growing community of depositors.
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-[#0F0F10]/70 px-4 py-4 sm:px-5 sm:py-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Multiplier engine
                </p>
                <p className="mt-1 text-sm text-[#F5F5F7]">
                  Your deposits unlock higher multipliers as you level up.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="space-y-1 rounded-xl bg-[#17181A] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Base multiplier
                </p>
                <p className="text-sm font-semibold text-[#F5F5F7]">
                  x{baseMultiplier.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1 rounded-xl bg-[#17181A] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Your boost
                </p>
                <p className="text-sm font-semibold text-[#16C784]">
                  +{boostMultiplier.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1 rounded-xl bg-[#17181A] px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#C6A15B]">
                  Total multiplier
                </p>
                <p className="text-sm font-semibold text-[#C6A15B]">
                  x{totalMultiplier.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                Progress to next boost
              </p>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-[#2A2B2E]">
                <div
                  className="h-full rounded-full bg-[#C6A15B] transition-[width] duration-600 ease-out"
                  style={{ width: `${progressToNextBoost * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                <span>
                  {depositInfo && depositInfo.nextLevel !== null && depositInfo.remainingToNext !== null
                    ? `Next multiplier boost unlock · $${depositInfo.remainingToNext.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} deposits required`
                    : "You have unlocked the highest multiplier tier available."}
                </span>
                {depositInfo && (
                  <span>
                    Level {depositInfo.level}
                    {depositInfo.nextLevel !== null ? ` → ${depositInfo.nextLevel}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-10 lg:flex-row">
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[#F5F5F7]">Asset allocation</p>
              <p className="text-xs text-[#9CA3AF]">
                How your portfolio is distributed across supported assets.
              </p>
            </div>
          </div>
          <div className="relative h-72 rounded-2xl bg-[#17181A]/60 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur-sm">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  dataKey="value"
                  data={allocationData}
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="#0F0F10"
                  strokeWidth={1}
                  isAnimationActive
                  animationDuration={600}
                >
                  {allocationData.map((entry, index) => (
                    <Cell
                      // eslint-disable-next-line react/no-array-index-key
                      key={`${entry.name}-${index}`}
                      fill={pieColors[entry.name as SupportedSymbol]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#17181A",
                    borderRadius: 12,
                    border: "1px solid #26272B",
                    padding: "8px 10px"
                  }}
                  labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                  formatter={(value: number, _name, payload) => {
                    const total = allocationData.reduce(
                      (acc, item) => acc + item.value,
                      0
                    );
                    const percentage =
                      total > 0 ? (value / total) * 100 : 0;
                    return [
                      `$${value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })} · ${percentage.toFixed(1)}%`,
                      payload?.name as string
                    ];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconSize={10}
                  wrapperStyle={{
                    fontSize: 11,
                    color: "#9CA3AF"
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {!hasAnyDeposits && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-xs font-medium text-[#9CA3AF]">
                  No deposits yet
                </p>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                  Start depositing to see your portfolio allocation.
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-2 text-[11px] sm:text-xs">
            {liveAssets.map((asset) => {
              const allocation =
                totalCurrentValue > 0
                  ? (asset.currentValue / totalCurrentValue) * 100
                  : 0;
              return (
                <div
                  key={asset.symbol}
                  className="flex items-center justify-between rounded-xl bg-[#17181A] px-3 py-2.5 transition-colors hover:border-[#C6A15B]/70"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={assetLogos[asset.symbol]}
                      alt={assetNames[asset.symbol]}
                      className="h-6 w-6 rounded-full"
                      loading="lazy"
                    />
                    <div>
                      <p className="text-xs font-medium text-[#F5F5F7]">
                        {assetNames[asset.symbol]}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        {allocation.toFixed(1)}% allocation
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-[#F5F5F7]">
                      {hidden ? mask("******") : `${asset.totalDeposited.toFixed(4)} ${asset.symbol}`}
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      {hidden ? mask("$******") : `$${asset.currentValue.toFixed(2)}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-[#F5F5F7]">
                Growth over time
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Your portfolio value and deposits visualized across time.
              </p>
            </div>
          </div>
          <div className="relative h-72 rounded-2xl bg-[#17181A]/60 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur-sm">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthSeries}>
                <defs>
                  <linearGradient id="colorDeposited" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16C784" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#16C784" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#26272B" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickLine={{ stroke: "#26272B" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickLine={{ stroke: "#26272B" }}
                  tickFormatter={(v) =>
                    `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#17181A",
                    borderRadius: 12,
                    border: "1px solid #26272B",
                    padding: "8px 10px"
                  }}
                  labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
                  formatter={(value: number) =>
                    `$${value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}`
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }}
                  iconType="circle"
                  iconSize={10}
                />
                <Area
                  type="monotone"
                  dataKey="deposited"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDeposited)"
                  name="Deposited"
                  isAnimationActive
                  animationDuration={700}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#16C784"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                  name="Value"
                  isAnimationActive
                  animationDuration={700}
                />
              </AreaChart>
            </ResponsiveContainer>
            {(!portfolio || portfolio.growthSeries.length === 0) && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-xs font-medium text-[#9CA3AF]">
                  Your portfolio growth will appear here
                </p>
                <p className="mt-1 text-[11px] text-[#9CA3AF] max-w-xs">
                  As deposits and earnings accumulate, this line will chart your
                  journey over time.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-[#F5F5F7]">Asset holdings</p>
            <p className="text-xs text-[#9CA3AF]">
              Detailed view of your positions, live valuation, and multiplier
              impact.
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl bg-[#17181A]">
          <div className="min-w-full divide-y divide-[#26272B]/50">
            <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1.6fr)] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.3fr)] gap-3 px-4 py-3 text-[10px] md:text-[11px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]">
              <span>Asset</span>
              <span>Deposited</span>
              <span>Current value</span>
              <span className="hidden md:inline">Allocation</span>
              <span className="hidden md:inline">Multiplier impact</span>
            </div>
            {liveAssets.map((asset) => {
              const allocationPct =
                totalCurrentValue > 0
                  ? (asset.currentValue / totalCurrentValue) * 100
                  : 0;
              const multiplierImpact =
                totalMultiplier > 1
                  ? (totalMultiplier - 1) * (allocationPct / 100)
                  : 0;
              return (
                <button
                  key={asset.symbol}
                  type="button"
                  onClick={() => handleQuickDeposit(asset.symbol)}
                  className="grid w-full grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1.6fr)] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.3fr)] gap-3 px-4 py-3 text-left text-[11px] md:text-xs text-[#F5F5F7] transition-colors hover:bg-[#0F0F10]"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={assetLogos[asset.symbol]}
                      alt={assetNames[asset.symbol]}
                      className="h-6 w-6 rounded-full"
                      loading="lazy"
                    />
                    <div>
                      <p className="font-medium">{assetNames[asset.symbol]}</p>
                      <p className="text-[11px] text-[#9CA3AF]">
                        {asset.symbol}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {hidden ? mask("******") : `${asset.totalDeposited.toFixed(4)} ${asset.symbol}`}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {hidden ? mask("$******") : `$${asset.currentValue.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="hidden flex-col md:flex">
                    <span className="font-medium">
                      {allocationPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="hidden flex-col md:flex">
                    <span className="font-medium text-[#16C784]">
                      +{multiplierImpact.toFixed(2)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {!hasAnyDeposits && (
        <section className="mt-4 rounded-2xl bg-[#17181A]/40 px-6 py-6 sm:px-8 sm:py-7 backdrop-blur-sm">
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#F5F5F7]">
              Your portfolio is waiting to grow.
            </p>
            <p className="text-xs text-[#9CA3AF] max-w-xl">
              Start depositing assets to activate your multiplier engine and track
              your earnings and growth over time in real time.
            </p>
            <button
              type="button"
              onClick={() => navigate("/deposit")}
              className="inline-flex items-center justify-center rounded-full bg-[#C6A15B] px-4 py-2 text-xs font-medium text-[#0F0F10] shadow-[0_12px_40px_rgba(0,0,0,0.65)] transition-transform transition-shadow hover:-translate-y-[1px] hover:shadow-[0_18px_50px_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A15B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F10]"
            >
              Make your first deposit
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

