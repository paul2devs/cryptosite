import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import btcLogo from "../assets/crypto/btc.svg";
import ethLogo from "../assets/crypto/eth.svg";
import solLogo from "../assets/crypto/sol.svg";
import usdtLogo from "../assets/crypto/usdt.svg";

type CryptoType = "BTC" | "ETH" | "SOL" | "ERC20" | "TRC20";

interface Deposit {
  deposit_id: string;
  crypto_type: CryptoType;
  amount: number;
  status: string;
  multiplier: number;
  pending_earning: number;
  tx_hash?: string | null;
  timestamp: string;
}

interface ActiveBonus {
  bonus_id: string;
  label: string;
  multiplier: number;
  start_time: string;
  end_time: string;
}

interface DepositAddress {
  asset: "BTC" | "ETH" | "SOL" | "USDT_TRC20" | "USDT_ERC20";
  name: string;
  address: string;
  network: string;
  networkType: string;
  qrCodeData: string;
}

export function DepositPage() {
  const [searchParams] = useSearchParams();
  const initialAsset = searchParams.get("asset") as CryptoType | null;
  const [cryptoType, setCryptoType] = useState<CryptoType>(
    initialAsset || "BTC"
  );
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [baseMultiplier, setBaseMultiplier] = useState(1);
  const [streakBonus, setStreakBonus] = useState(0);
  const [bonuses, setBonuses] = useState<ActiveBonus[]>([]);
  const [addresses, setAddresses] = useState<DepositAddress[]>([]);
  const [txHash, setTxHash] = useState("");
  const [depositLevel, setDepositLevel] = useState(0);
  const [totalDepositedUsd, setTotalDepositedUsd] = useState(0);
  const [depositNextLevel, setDepositNextLevel] = useState<number | null>(null);
  const [depositNextRequiredTotal, setDepositNextRequiredTotal] = useState<number | null>(null);
  const [depositCurrentRequiredTotal, setDepositCurrentRequiredTotal] = useState(0);
  const [depositRemainingToNext, setDepositRemainingToNext] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUsdtModal, setShowUsdtModal] = useState(false);

  const loadDeposits = async () => {
    try {
      const response = await api.get<Deposit[]>("/deposits/me");
      setDeposits(response.data);
    } catch {
      setError("Failed to load deposits");
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await loadDeposits();
        const [progRes, bonusRes, addressRes] = await Promise.all([
          api.get<{
            multiplierPreview: {
              baseMultiplier: number;
              streakBonus: number;
            };
            depositLevel: number;
            totalDepositedUsd: number;
            depositCurrentLevelRequiredTotal: number;
            depositNextLevel: number | null;
            depositNextLevelRequiredTotal: number | null;
            depositRemainingToNext: number | null;
          }>("/user/current_xp_level"),
          api.get<ActiveBonus[]>("/bonuses/active"),
          api.get<DepositAddress[]>("/deposits/addresses")
        ]);
        setBaseMultiplier(progRes.data.multiplierPreview.baseMultiplier);
        setStreakBonus(progRes.data.multiplierPreview.streakBonus);
        setDepositLevel(progRes.data.depositLevel);
        setTotalDepositedUsd(progRes.data.totalDepositedUsd);
        setDepositCurrentRequiredTotal(
          progRes.data.depositCurrentLevelRequiredTotal
        );
        setDepositNextLevel(progRes.data.depositNextLevel);
        setDepositNextRequiredTotal(
          progRes.data.depositNextLevelRequiredTotal
        );
        setDepositRemainingToNext(progRes.data.depositRemainingToNext);
        setBonuses(bonusRes.data);
        setAddresses(addressRes.data);
      } catch {
        setBaseMultiplier(1);
        setStreakBonus(0);
        setBonuses([]);
        setAddresses([]);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!message && !error) {
      return;
    }
    const timeout = setTimeout(() => {
      setMessage(null);
      setError(null);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [message, error]);

  const bestBonus = useMemo(() => {
    if (bonuses.length === 0) {
      return null;
    }
    return [...bonuses].sort(
      (a, b) =>
        new Date(a.end_time).getTime() - new Date(b.end_time).getTime()
    )[0];
  }, [bonuses]);

  const bonusMultiplier = useMemo(
    () =>
      bonuses.reduce((acc, b) => acc * b.multiplier, 1),
    [bonuses]
  );

  const numericAmount = Number(amount) || 0;
  const referralBonus = 0;
  const timeBonus = 0.1;
  const baseComponent =
    baseMultiplier * (1 + streakBonus + timeBonus + referralBonus);
  const totalMultiplier = baseComponent * bonusMultiplier;
  const projectedEarnings = numericAmount * totalMultiplier;

  const levelProgressPercent = useMemo(() => {
    const currentMin = depositCurrentRequiredTotal || 0;
    const nextMax = depositNextRequiredTotal ?? currentMin;
    if (nextMax <= currentMin) {
      return 100;
    }
    const clampedTotal = Math.min(
      Math.max(totalDepositedUsd, currentMin),
      nextMax
    );
    const ratio = (clampedTotal - currentMin) / (nextMax - currentMin);
    return Math.round(ratio * 100);
  }, [
    depositCurrentRequiredTotal,
    depositNextRequiredTotal,
    totalDepositedUsd
  ]);

  const bonusCountdown = useMemo(() => {
    if (!bestBonus) {
      return null;
    }
    const end = new Date(bestBonus.end_time).getTime();
    const diff = Math.max(0, Math.floor((end - now) / 1000));
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return { hours, minutes, seconds };
  }, [bestBonus, now]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      await api.post("/deposits", {
        crypto_type: cryptoType,
        amount: Number(amount),
        tx_hash: txHash || null
      });
      setMessage("Deposit request submitted");
      setAmount("");
      setTxHash("");
      await loadDeposits();
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (Array.isArray(err.response?.data?.errors)) {
        const first = err.response.data.errors[0];
        setError(
          first?.msg || "Failed to submit deposit. Please check your details."
        );
      } else {
        setError("Failed to submit deposit");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const assetMeta = useMemo(
    () =>
      ({
        BTC: {
          label: "BTC",
          name: "Bitcoin",
          network: "Bitcoin Mainnet",
          logo: btcLogo
        },
        ETH: {
          label: "ETH",
          name: "Ethereum",
          network: "Ethereum Mainnet",
          logo: ethLogo
        },
        SOL: {
          label: "SOL",
          name: "Solana",
          network: "Solana Mainnet",
          logo: solLogo
        },
        ERC20: {
          label: "USDT",
          name: "Tether (ERC20)",
          network: "Ethereum (ERC20)",
          logo: usdtLogo
        },
        TRC20: {
          label: "USDT",
          name: "Tether (TRC20)",
          network: "Tron (TRC20)",
          logo: usdtLogo
        }
      } as const),
    []
  );

  const currentAddress = useMemo(() => {
    if (addresses.length === 0) {
      return null;
    }
    const match =
      addresses.find((a) => {
        if (cryptoType === "BTC" || cryptoType === "ETH" || cryptoType === "SOL") {
          return a.asset === cryptoType;
        }
        if (cryptoType === "ERC20") {
          return a.asset === "USDT_ERC20";
        }
        if (cryptoType === "TRC20") {
          return a.asset === "USDT_TRC20";
        }
        return false;
      }) || null;
    return match;
  }, [addresses, cryptoType]);

  const handleCopyAddress = async () => {
    if (!currentAddress) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentAddress.address);
      setMessage("Address copied to clipboard");
    } catch {
      setError("Failed to copy address");
    }
  };

  return (
    <div className="page-responsive borderless-ui min-w-0 space-y-8 overflow-x-hidden">
      <Seo
        title="Deposit crypto"
        description="Submit a blockchain-verified deposit to unlock XP, levels, deposit tiers and multiplier rewards inside NexaCrypto."
        path="/deposit"
      />
      <section className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
          Deposit
        </h1>
        <p className="text-sm text-[#9CA3AF]">
          Move crypto into your earning balance with verified on-chain deposits.
        </p>
      </section>

      <section className="min-w-0 rounded-2xl bg-[#17181A]/40 px-4 py-3 sm:px-6 sm:py-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
            <span>Deposit Level</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFD700]/5 px-2 py-0.5 text-[10px] font-medium text-[#FFD700]">
              <span>⭐</span>
              <span>Level System</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-[#F5F5F7]">
              Level {depositLevel}
            </span>
            <span className="text-xs text-[#9CA3AF]">
              {depositNextLevel ? `Progress to Level ${depositNextLevel}` : "Max level reached"}
            </span>
          </div>
        </div>
        <div className="w-full max-w-md space-y-0.5">
          <div className="h-2 rounded-full bg-[#26272B] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                backgroundImage: "linear-gradient(90deg,#FFD700,#FFB800)"
              }}
              initial={{ width: 0 }}
              animate={{ width: `${levelProgressPercent}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
            <span>
              ${totalDepositedUsd.toFixed(2)} / $
              {(depositNextRequiredTotal ?? depositCurrentRequiredTotal ?? 0).toFixed(2)}
            </span>
            {depositRemainingToNext !== null && depositNextLevel && (
              <span>
                Remaining $
                {depositRemainingToNext.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="min-w-0 grid grid-cols-1 gap-6 lg:grid-cols-2 items-start">
        <div className="order-1 w-full min-w-0 space-y-5 lg:order-1">
          <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Asset
                </p>
                <p className="text-sm font-medium text-[#F5F5F7]">
                  Choose what you want to deposit
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2 overflow-x-visible pb-2">
              {(["BTC", "ETH", "SOL"] as CryptoType[]).map((asset) => {
                const isActive = cryptoType === asset;
                const meta = assetMeta[asset];
                return (
                  <motion.button
                    key={asset}
                    type="button"
                    onClick={() => setCryptoType(asset)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border transition-all ${
                      isActive
                        ? "border-[#FFD700] bg-[#1E1F22] shadow-[0_0_18px_rgba(255,215,0,0.28)]"
                        : "border-[#26272B] bg-[#17181A]/80 hover:border-[#4B5563]"
                    }`}
                  >
                    <div className="h-6 w-6 rounded-full bg-[#0F0F10] flex items-center justify-center overflow-hidden">
                      <img
                        src={meta.logo}
                        alt={meta.name}
                        className="h-4 w-4"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex flex-col items-start leading-tight">
                      <span className="text-[11px] font-medium text-[#F5F5F7]">
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-[#9CA3AF]">
                        {meta.name}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
              <motion.button
                type="button"
                onClick={() => setShowUsdtModal(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs border transition-all ${
                  cryptoType === "TRC20" || cryptoType === "ERC20"
                    ? "border-[#FFD700] bg-[#1E1F22] shadow-[0_0_18px_rgba(255,215,0,0.28)]"
                    : "border-[#26272B] bg-[#17181A]/80 hover:border-[#4B5563]"
                }`}
              >
                <div className="h-6 w-6 rounded-full bg-[#0F0F10] flex items-center justify-center overflow-hidden">
                  <img
                    src={usdtLogo}
                    alt="USDT"
                    className="h-4 w-4"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[11px] font-medium text-[#F5F5F7]">
                    USDT
                  </span>
                  <span className="text-[10px] text-[#9CA3AF]">
                    {cryptoType === "TRC20" ? "Tether (TRC20)" : cryptoType === "ERC20" ? "Tether (ERC20)" : "Tether"}
                  </span>
                </div>
              </motion.button>
            </div>
            {showUsdtModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowUsdtModal(false)}>
                <div className="rounded-2xl bg-[#17181A] p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-sm font-medium text-[#F5F5F7] mb-4">Select USDT Network</h3>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCryptoType("TRC20");
                        setShowUsdtModal(false);
                      }}
                      className="w-full flex items-center gap-3 rounded-xl bg-[#0F0F10] px-4 py-3 hover:bg-[#17181A] transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-[#0F0F10] flex items-center justify-center overflow-hidden">
                        <img src={usdtLogo} alt="USDT TRC20" className="h-6 w-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-[#F5F5F7]">Tether (TRC20)</p>
                        <p className="text-xs text-[#9CA3AF]">Tron Network</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCryptoType("ERC20");
                        setShowUsdtModal(false);
                      }}
                      className="w-full flex items-center gap-3 rounded-xl bg-[#0F0F10] px-4 py-3 hover:bg-[#17181A] transition-colors"
                    >
                      <div className="h-10 w-10 rounded-full bg-[#0F0F10] flex items-center justify-center overflow-hidden">
                        <img src={usdtLogo} alt="USDT ERC20" className="h-6 w-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-[#F5F5F7]">Tether (ERC20)</p>
                        <p className="text-xs text-[#9CA3AF]">Ethereum Network</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#9CA3AF]">
                Deposit Address
              </p>
              <p className="text-sm font-medium text-[#F5F5F7]">
                {assetMeta[cryptoType].name}
              </p>
              <p className="text-[11px] text-[#9CA3AF]">
                Network: {assetMeta[cryptoType].network}
              </p>
            </div>

            {loading && (
              <div className="space-y-3">
                <div className="h-4 w-40 rounded-full bg-[#26272B] animate-pulse" />
                <div className="h-10 w-full rounded-xl bg-[#26272B] animate-pulse" />
                <div className="mx-auto h-40 w-40 rounded-2xl bg-[#26272B] animate-pulse" />
              </div>
            )}

            {!loading && !currentAddress && (
              <p className="text-xs text-[#FFD700]">
                Deposit addresses are not configured yet for this asset. Please contact
                support.
              </p>
            )}

            {!loading && currentAddress && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="rounded-xl bg-[#0F0F10] px-3 py-2.5 text-[11px] break-all">
                    {currentAddress.address}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#17181A] px-3 py-2 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
                  >
                    <span>Copy address</span>
                  </button>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Send only {assetMeta[cryptoType].label} to this address. Network must
                    match exactly to avoid loss of funds.
                  </p>
                </div>

                <div className="flex justify-center">
                  <div className="relative inline-flex items-center justify-center rounded-2xl bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
                    <QRCodeSVG
                      value={currentAddress.address}
                      size={152}
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      level="M"
                      includeMargin={false}
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-8 w-8 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden">
                        <img
                          src={assetMeta[cryptoType].logo}
                          alt={assetMeta[cryptoType].name}
                          className="h-6 w-6"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="order-3 w-full min-w-0 space-y-5 lg:order-2">
          <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm">
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-[#9CA3AF]" htmlFor="amount">
                  <span>Amount</span>
                  <span className="text-[11px] text-[#F5F5F7]">
                    {assetMeta[cryptoType].label}
                  </span>
                </label>
                <div className="relative">
                  <input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.0001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full rounded-xl bg-[#0F0F10] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]/60 focus:border-transparent pr-16"
                    placeholder="0.00"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <span className="rounded-full bg-[#17181A] px-2 py-1 text-[11px] text-[#F5F5F7]">
                      {assetMeta[cryptoType].label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-[#9CA3AF]" htmlFor="txHash">
                  Transaction hash (TXID)
                </label>
                <input
                  id="txHash"
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Paste blockchain transaction hash"
                  required
                  className="w-full rounded-xl bg-[#0F0F10] px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#4DB5FF]/60 focus:border-transparent"
                />
                <p className="text-[11px] text-[#9CA3AF]">
                  After sending your crypto, paste the TX hash to verify your deposit.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl bg-[#FFD700]/6 px-3 py-3 text-[11px] text-[#F5F5F7] flex gap-2">
                <div className="mt-0.5 text-base">🎁</div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#FFD700]">
                    Referral Boost Active
                  </p>
                  <p className="text-[11px] text-[#F5F5F7]">
                    If this is your first approved deposit and you were invited, both you
                    and your referrer receive multiplier rewards.
                  </p>
                </div>
              </div>

              {bonuses.length > 0 && (
                <div className="rounded-xl bg-[#C6A15B]/8 px-3 py-3 text-[11px] space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[#F5F5F7] font-medium">
                      Limited-time bonus
                    </span>
                    {bonusCountdown && (
                      <span className="text-[10px] text-[#F5F5F7]">
                        Ends in {bonusCountdown.hours.toString().padStart(2, "0")}:
                        {bonusCountdown.minutes.toString().padStart(2, "0")}:
                        {bonusCountdown.seconds.toString().padStart(2, "0")}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#F5F5F7]">
                    {bestBonus ? bestBonus.label : "Time-limited deposit boost active."}
                  </p>
                  <p className="text-[11px] text-[#F5F5F7]">
                    Bonus multiplier on top: x{bonusMultiplier.toFixed(2)}
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-[#0B1F18] px-3 py-3 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF]">Projected multiplier</span>
                  <span className="text-sm font-semibold text-[#16C784]">
                    x{totalMultiplier.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                  <span>Projected pending earnings</span>
                  <span className="text-[#F5F5F7]">
                    {projectedEarnings ? projectedEarnings.toFixed(4) : "0.0000"}{" "}
                    {assetMeta[cryptoType].label}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FFD700] text-[#0F0F10] py-3 text-sm font-medium shadow-[0_0_0_1px_rgba(0,0,0,0.85)] hover:shadow-[0_0_24px_rgba(255,215,0,0.55)] transition-shadow disabled:opacity-60 disabled:hover:shadow-none"
            >
              {submitting && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0F0F10]/40 border-t-[#0F0F10]" />
              )}
              <span>{submitting ? "Confirming deposit..." : "Confirm Deposit"}</span>
            </button>
          </div>
        </form>

        <div className="order-4 w-full min-w-0 space-y-5 lg:order-3 lg:col-span-2">
          <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-3 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#F5F5F7]">
                  Recent Deposits
                </p>
                <p className="text-[11px] text-[#9CA3AF]">
                  Latest on-chain deposits and status.
                </p>
              </div>
            </div>
            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
              {deposits.length === 0 && (
                <p className="text-[11px] text-[#9CA3AF]">
                  Your verified deposits will appear here after you start depositing.
                </p>
              )}
              {deposits.length > 0 && (
                <div className="space-y-1 text-[11px]">
                  <div className="w-full overflow-x-auto">
                    <div className="min-w-[520px]">
                      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 px-2 py-1 text-[#9CA3AF]">
                        <span>Asset</span>
                        <span>Amount</span>
                        <span>TX Hash</span>
                        <span>Status</span>
                        <span>Date</span>
                      </div>
                      {deposits.map((d) => {
                        const statusClass =
                          d.status === "Approved"
                            ? "text-[#16C784] bg-[#16C784]/10 border-[#16C784]/40"
                            : d.status === "Rejected"
                            ? "text-[#EA3943] bg-[#EA3943]/10 border-[#EA3943]/40"
                            : "text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/40";
                        const hash = d.tx_hash || "";
                        const shortHash =
                          hash && hash.length > 12
                            ? `${hash.slice(0, 6)}...${hash.slice(-4)}`
                            : hash || "—";
                        return (
                          <div
                            key={d.deposit_id}
                            className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 items-center rounded-xl bg-[#0F0F10] px-2 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-[#17181A] px-2 py-1 text-[10px] text-[#F5F5F7]">
                                {d.crypto_type}
                              </span>
                            </div>
                            <span className="text-[#F5F5F7]">
                              {d.amount} {d.crypto_type}
                            </span>
                            <span className="font-mono text-[10px] text-[#9CA3AF]">
                              {shortHash}
                            </span>
                            <span
                              className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] ${statusClass}`}
                            >
                              {d.status}
                            </span>
                            <span className="text-[#9CA3AF]">
                              {new Date(d.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {(message || error) && (
          <motion.div
            className="fixed bottom-24 left-4 right-4 z-40 max-w-xs border px-3 py-2 text-xs shadow-lg bg-[#0F0F10] sm:left-auto"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
          >
            <div
              className={
                error
                  ? "border-[#EA3943]/60 bg-[#1F1214] text-[#FCA5A5]"
                  : "border-[#16C784]/60 bg-[#071A14] text-[#A7F3D0]"
              }
            >
              <div className="px-2 py-1.5">
                <p>{error || message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

