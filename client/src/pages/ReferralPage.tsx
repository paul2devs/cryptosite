import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  Zap,
  Award,
  Share2,
  Copy,
  Link as LinkIcon,
  Send,
  Mail,
  UserPlus,
  CreditCard,
  ArrowRight,
  Clock
} from "lucide-react";
import { FaWhatsapp, FaTwitter } from "react-icons/fa";
import type { RootState } from "../store";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";

type ReferralRewardStatus = "pending" | "earned" | "blocked";

interface ReferralReward {
  id: string;
  reward_type: string;
  reward_value: number;
  status: ReferralRewardStatus;
  created_at: string;
}

interface ReferralDashboardResponse {
  referralCode: string | null;
  totalInvited: number;
  activeReferrals: number;
  totalEarningsValue: number;
  rewards: ReferralReward[];
}

function formatMultiplier(value: number): string {
  const fraction = value;
  if (!Number.isFinite(fraction) || fraction === 0) {
    return "+0.00 multiplier";
  }
  return `+${fraction.toFixed(2)} multiplier`;
}

function getStatusPill(status: ReferralRewardStatus): {
  label: string;
  className: string;
} {
  if (status === "earned") {
    return {
      label: "Active",
      className:
        "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
    };
  }
  if (status === "pending") {
    return {
      label: "Pending",
      className: "border-[#C6A15B]/60 bg-[#C6A15B]/10 text-[#F5F5F7]"
    };
  }
  return {
    label: "Expired",
    className: "border-[#4B5563] bg-[#111827] text-[#9CA3AF]"
  };
}

export function ReferralPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const [data, setData] = useState<ReferralDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  const link = useMemo(() => {
    if (!data?.referralCode) {
      return null;
    }
    return `${window.location.origin}/register?ref=${encodeURIComponent(
      data.referralCode
    )}`;
  }, [data?.referralCode]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<ReferralDashboardResponse>(
          "/referrals/dashboard"
        );
        setData(res.data);
        setError(null);
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load referrals");
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!copyToast) {
      return;
    }
    const timeout = setTimeout(() => {
      setCopyToast(null);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [copyToast]);

  if (!user) {
    return null;
  }

  const invited = data?.totalInvited ?? 0;
  const active = data?.activeReferrals ?? 0;
  const earnings = data?.totalEarningsValue ?? 0;
  const hasRewards = (data?.rewards?.length ?? 0) > 0;

  return (
    <div className="page-responsive borderless-ui space-y-10">
      <Seo
        title="Referrals – invite and earn multiplier boosts"
        description="Invite friends to NexaCrypto and unlock referral multiplier boosts when their deposits are approved."
        path="/referrals"
      />
      <section className="relative overflow-hidden rounded-3xl bg-[#17181A] px-6 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <svg
            aria-hidden="true"
            className="h-full w-full"
            viewBox="0 0 800 400"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="referral-network" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#C6A15B" stopOpacity="0.4" />
                <stop offset="1" stopColor="#16C784" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <g fill="none" stroke="url(#referral-network)" strokeWidth="1.2">
              <circle cx="120" cy="80" r="42" />
              <circle cx="360" cy="60" r="36" />
              <circle cx="620" cy="110" r="40" />
              <circle cx="220" cy="260" r="38" />
              <circle cx="520" cy="260" r="44" />
              <line x1="120" y1="80" x2="360" y2="60" />
              <line x1="360" y1="60" x2="620" y2="110" />
              <line x1="120" y1="80" x2="220" y2="260" />
              <line x1="220" y1="260" x2="520" y2="260" />
              <line x1="520" y1="260" x2="620" y2="110" />
            </g>
          </svg>
        </div>

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)] items-start">
          <div className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]">
              Referrals
            </p>
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F7]">
                Invite Friends. Earn Multipliers Together.
              </h1>
              <p className="text-sm text-[#9CA3AF] max-w-xl">
                When your friends deposit, both of you unlock time-limited multiplier
                boosts that accelerate your earnings journey.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#9CA3AF]">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#0F0F10] px-3 py-1.5">
                <Users className="h-3.5 w-3.5 text-[#C6A15B]" />
                <span>Turn your network into a shared reward engine.</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#0F0F10] px-3 py-1.5">
                <Award className="h-3.5 w-3.5 text-[#16C784]" />
                <span>Boosts are real, on-chain verified multipliers.</span>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl bg-[#0F0F10]/80 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
              Referral momentum
            </p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                  <Users className="h-3.5 w-3.5 text-[#C6A15B]" />
                  <span>Invited</span>
                </div>
                <motion.p
                  key={invited}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg font-semibold text-[#F5F5F7]"
                >
                  {invited}
                </motion.p>
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                  <Zap className="h-3.5 w-3.5 text-[#16C784]" />
                  <span>Active</span>
                </div>
                <motion.p
                  key={active}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg font-semibold text-[#F5F5F7]"
                >
                  {active}
                </motion.p>
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] text-[#9CA3AF]">
                  <Award className="h-3.5 w-3.5 text-[#C6A15B]" />
                  <span>Earnings</span>
                </div>
                <motion.p
                  key={earnings}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg font-semibold text-[#16C784]"
                >
                  {earnings.toFixed(2)}
                </motion.p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const section = document.getElementById("invite-section");
                if (section) {
                  section.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[#C6A15B] px-4 py-2 text-xs font-medium text-[#0F0F10] shadow-[0_14px_40px_rgba(0,0,0,0.85)] transition-transform hover:-translate-y-[1px] hover:shadow-[0_18px_50px_rgba(0,0,0,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6A15B]"
            >
              <span>Invite friends now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        </div>
      </section>

      <section className="space-y-8">
        <section
          id="invite-section"
          className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)] items-start"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">
                Your invite code
              </p>
              <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[#F5F5F7]">
                      Your Referral Code
                    </p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Share this with friends you trust. Their first approved deposit
                      unlocks multipliers for both of you.
                    </p>
                  </div>
                  <div className="rounded-full bg-[#0F0F10]/80 px-3 py-1.5 text-[11px] font-mono text-[#C6A15B]">
                    {data?.referralCode ?? user.referral_code ?? "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#F5F5F7]">Invite link</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex-1 rounded-xl bg-[#0F0F10]/80 px-3 py-2.5 text-[11px] text-[#F5F5F7] font-mono break-all">
                      {link ?? "Generate your invite link by activating your account."}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!link) {
                            return;
                          }
                          await navigator.clipboard.writeText(link);
                          setCopyToast("Invite link copied");
                        }}
                        disabled={!link}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#17181A] px-3 py-2 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!link || !navigator.share) {
                            return;
                          }
                          navigator
                            .share({
                              title: "Join my crypto levels journey",
                              text: "Deposit with me and unlock multiplier boosts on this platform.",
                              url: link
                            })
                            .catch(() => {});
                        }}
                        disabled={!link || !("share" in navigator)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#17181A] px-3 py-2 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] disabled:opacity-50"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-[#F5F5F7]">Share via</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (!link) {
                      return;
                    }
                    const url = `https://t.me/share/url?url=${encodeURIComponent(
                      link
                    )}&text=${encodeURIComponent(
                      "Join this crypto levels platform with me and unlock multiplier boosts."
                    )}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  disabled={!link}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#17181A] px-3 py-2 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5 text-[#28A8E9]" />
                  <span>Telegram</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!link) {
                      return;
                    }
                    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Join this crypto levels platform with me and unlock multiplier boosts: ${link}`
                    )}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  disabled={!link}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#17181A] px-3 py-2 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] disabled:opacity-50"
                >
                  <FaWhatsapp className="h-3.5 w-3.5 text-[#25D366]" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!link) {
                      return;
                    }
                    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(
                      "I am growing my crypto with multiplier boosts on this platform. Join with my link:"
                    )}&url=${encodeURIComponent(link)}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  disabled={!link}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#17181A] px-3 py-2 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] disabled:opacity-50"
                >
                  <FaTwitter className="h-3.5 w-3.5 text-[#F5F5F7]" />
                  <span>X</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!link) {
                      return;
                    }
                    const subject = "Join me on this NexaCrypto platform";
                    const body = `I am using this custodial NexaCrypto platform to grow my deposits with multipliers.\n\nUse my invite link to unlock a shared boost: ${link}`;
                    const url = `mailto:?subject=${encodeURIComponent(
                      subject
                    )}&body=${encodeURIComponent(body)}`;
                    window.location.href = url;
                  }}
                  disabled={!link}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#17181A] px-3 py-2 text-[11px] text-[#F5F5F7] hover:bg-[#1F2023] disabled:opacity-50"
                >
                  <Mail className="h-3.5 w-3.5 text-[#F97316]" />
                  <span>Email</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[#F5F5F7]">
                    How referral rewards work
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] max-w-sm">
                    Clear steps so you always know how your network turns into
                    multiplier boosts.
                  </p>
                </div>
                <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-[#0F0F10]">
                  <LinkIcon className="h-4 w-4 text-[#C6A15B]" />
                </div>
              </div>
              <div className="space-y-3 text-xs text-[#F5F5F7]">
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10]">
                    <UserPlus className="h-4 w-4 text-[#C6A15B]" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">1. Invite friends</p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      Share your invite link with people you trust. Each friend
                      registers using your code.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10]">
                    <CreditCard className="h-4 w-4 text-[#16C784]" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">2. They make a verified deposit</p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      When their first deposit is verified and approved, the referral
                      engine records the relationship.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10]">
                    <Zap className="h-4 w-4 text-[#C6A15B]" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium">3. Both unlock multiplier boosts</p>
                    <p className="text-[11px] text-[#9CA3AF]">
                      You and your friend receive time-limited multiplier boosts that
                      amplify your earnings potential while the boost is active.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#17181A]/40 px-4 py-4 sm:px-5 sm:py-5 space-y-3 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[#F5F5F7]">
                    Recent Referral Rewards
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    Track how your invites are turning into live multiplier boosts.
                  </p>
                </div>
                <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-[#0F0F10]">
                  <Clock className="h-4 w-4 text-[#9CA3AF]" />
                </div>
              </div>

              {!hasRewards && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-[#0F0F10] px-4 py-6 text-center">
                  <p className="text-xs font-medium text-[#F5F5F7]">
                    No referral rewards yet.
                  </p>
                  <p className="text-[11px] text-[#9CA3AF] max-w-xs">
                    Invite friends to start earning multiplier boosts together. Each
                    verified deposit turns your network into shared upside.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const section = document.getElementById("invite-section");
                      if (section) {
                        section.scrollIntoView({
                          behavior: "smooth",
                          block: "start"
                        });
                      }
                    }}
                    className="mt-1 inline-flex items-center justify-center rounded-full bg-[#C6A15B] px-4 py-2 text-xs font-medium text-[#0F0F10] shadow-[0_12px_36px_rgba(0,0,0,0.85)] hover:-translate-y-[1px] hover:shadow-[0_16px_46px_rgba(0,0,0,0.9)] transition-transform"
                  >
                    Invite Your First Friend
                  </button>
                </div>
              )}

              {hasRewards && (
                <div className="overflow-hidden rounded-xl bg-[#0F0F10]">
                  <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] gap-2 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#9CA3AF]">
                    <span>User</span>
                    <span>Reward</span>
                    <span>Status</span>
                    <span>Date</span>
                  </div>
                  <div className="divide-y divide-[#26272B]">
                    {data?.rewards.map((reward) => {
                      const pill = getStatusPill(reward.status);
                      const date = new Date(reward.created_at);
                      return (
                        <div
                          key={reward.id}
                          className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] gap-2 px-3 py-2.5 text-xs text-[#F5F5F7] transition-colors hover:bg-[#111827]"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17181A] text-[11px] font-medium text-[#F5F5F7]">
                              F
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium">Invited friend</span>
                              <span className="text-[11px] text-[#9CA3AF]">
                                {reward.reward_type}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatMultiplier(reward.reward_value)}
                            </span>
                            <span className="text-[11px] text-[#9CA3AF]">
                              Multiplier boost applied on first approved deposit.
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span
                              className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] ${pill.className}`}
                            >
                              {pill.label}
                            </span>
                          </div>
                          <div className="flex flex-col text-[11px] text-[#9CA3AF]">
                            <span>
                              {date.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric"
                              })}
                            </span>
                            <span>{date.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      <AnimatePresence>
        {copyToast && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="fixed bottom-24 right-4 z-40 max-w-xs rounded-2xl bg-[#071A14] px-3 py-2 text-xs text-[#A7F3D0] shadow-lg"
          >
            <p>{copyToast}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


