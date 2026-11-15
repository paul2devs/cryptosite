import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { X } from "lucide-react";
import type { RootState } from "../store";
import { api } from "../utils/api";
import { getRealtimeSocket, SocialProofEvent } from "../utils/realtime";
import {
  DEMO_ACTIVITY,
  loadSeenDemoActivity,
  markDemoActivitySeen
} from "../data/demoActivity";

export interface NotificationItem {
  notification_id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface NotificationContextValue {
  toastQueue: NotificationItem[];
  popToast: () => void;
  socialEvent: SocialProofEvent | null;
  setSocialEvent: (event: SocialProofEvent | null) => void;
  panelNotifications: NotificationItem[];
  unreadCount: number;
  markAllRead: () => void;
  dismissPanelNotification: (notificationId: string) => void;
  clearPanelNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const [toastQueue, setToastQueue] = useState<NotificationItem[]>([]);
  const [socialEvent, setSocialEvent] = useState<SocialProofEvent | null>(null);
  const [panelNotifications, setPanelNotifications] = useState<NotificationItem[]>(
    []
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const generatedCycleKeysRef = useRef<Set<string>>(new Set());
  const lastVariantByTypeRef = useRef<Map<string, string>>(new Map());
  const visibleLimit = 2;

  const storagePrefix = user?.user_id ? `notificationState.${user.user_id}` : "";

  const persistNotificationState = useCallback(() => {
    if (!storagePrefix || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(
        storagePrefix,
        JSON.stringify({
          seen: Array.from(seenIdsRef.current),
          dismissed: Array.from(dismissedIdsRef.current),
          generated: Array.from(generatedCycleKeysRef.current)
        })
      );
    } catch {
      return;
    }
  }, [storagePrefix]);

  const hydrateNotificationState = useCallback(() => {
    if (!storagePrefix || typeof window === "undefined") {
      return;
    }
    try {
      const raw = window.localStorage.getItem(storagePrefix);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        seen?: string[];
        dismissed?: string[];
        generated?: string[];
      };
      seenIdsRef.current = new Set(parsed.seen ?? []);
      dismissedIdsRef.current = new Set(parsed.dismissed ?? []);
      generatedCycleKeysRef.current = new Set(parsed.generated ?? []);
    } catch {
      return;
    }
  }, [storagePrefix]);

  const queueNotification = useCallback(
    (item: NotificationItem, cycleKey?: string) => {
      if (dismissedIdsRef.current.has(item.notification_id)) {
        return;
      }
      if (seenIdsRef.current.has(item.notification_id)) {
        return;
      }
      if (cycleKey && generatedCycleKeysRef.current.has(cycleKey)) {
        return;
      }
      seenIdsRef.current.add(item.notification_id);
      if (cycleKey) {
        generatedCycleKeysRef.current.add(cycleKey);
      }
      setPanelNotifications((prev) => {
        if (prev.some((existing) => existing.notification_id === item.notification_id)) {
          return prev;
        }
        return [item, ...prev];
      });
      setToastQueue((prev) => {
        if (prev.some((existing) => existing.notification_id === item.notification_id)) {
          return prev;
        }
        const visible = prev.filter((entry) => !dismissedIdsRef.current.has(entry.notification_id));
        if (visible.length >= visibleLimit) {
          return [...visible.slice(0, visibleLimit - 1), item, ...visible.slice(visibleLimit - 1)];
        }
        return [...visible, item];
      });
      setUnreadCount((count) => count + 1);
      persistNotificationState();
    },
    [persistNotificationState]
  );

  useEffect(() => {
    if (!accessToken) {
      setToastQueue([]);
      setSocialEvent(null);
      setPanelNotifications([]);
      setUnreadCount(0);
      seenIdsRef.current = new Set();
      dismissedIdsRef.current = new Set();
      generatedCycleKeysRef.current = new Set();
      return;
    }

    hydrateNotificationState();
    let cancelled = false;
    let socket = getRealtimeSocket();

    const loadUnseen = async () => {
      try {
        const res = await api.get<NotificationItem[]>("/notifications/unseen");
        if (!cancelled && res.data.length > 0) {
          const freshnessCutoff = Date.now() - 12 * 60 * 60 * 1000;
          res.data.forEach((item) => {
            const isFresh = new Date(item.timestamp).getTime() >= freshnessCutoff;
            const cycleKey = `${item.type}:${new Date(item.timestamp).toDateString()}`;
            if (isFresh) {
              queueNotification(item, cycleKey);
            } else {
              seenIdsRef.current.add(item.notification_id);
            }
          });
          persistNotificationState();
        }
      } catch {
        if (!cancelled) {
          setToastQueue([]);
        }
      }
    };

    loadUnseen();
    const interval = setInterval(loadUnseen, 10000);

    if (socket) {
      socket.on("social_proof_event", (event: SocialProofEvent) => {
        if (!cancelled) {
          setSocialEvent(event);
        }
      });
    } else {
      socket = getRealtimeSocket();
      if (socket) {
        socket.on("social_proof_event", (event: SocialProofEvent) => {
          if (!cancelled) {
            setSocialEvent(event);
          }
        });
      }
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (socket) {
        socket.off("social_proof_event");
      }
    };
  }, [accessToken, hydrateNotificationState, persistNotificationState, queueNotification]);

  /**
   * Demonstration activity for the live activity banner.
   *
   * There is no base of real accounts generating genuine level advancements
   * yet, so the banner surfaces clearly identified example activity instead of
   * fabricating real user transactions. Each entry is labelled as an example,
   * shown at most once per device, and recorded in localStorage so a refresh
   * never replays one that has already been seen.
   */
  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let cancelled = false;

    const surfaceNextExample = () => {
      if (cancelled) {
        return;
      }
      const seen = loadSeenDemoActivity();
      const next = DEMO_ACTIVITY.find((entry) => !seen.has(entry.id));
      if (!next) {
        return;
      }
      markDemoActivitySeen(next.id);
      setSocialEvent({
        id: next.id,
        type: "level_up",
        message: next.message.charAt(0).toUpperCase() + next.message.slice(1),
        createdAt: new Date().toISOString()
      });
    };

    const initialDelay = window.setTimeout(surfaceNextExample, 6000);
    const interval = window.setInterval(surfaceNextExample, 18000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialDelay);
      window.clearInterval(interval);
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !user) {
      return;
    }
    let cancelled = false;
    const buildMessage = (
      type: string,
      variants: string[],
      values: Record<string, string | number>
    ) => {
      const lastUsed = lastVariantByTypeRef.current.get(type);
      const available = variants.filter((variant) => variant !== lastUsed);
      const picked =
        available[Math.floor(Math.random() * Math.max(1, available.length))] || variants[0];
      lastVariantByTypeRef.current.set(type, picked);
      return Object.entries(values).reduce(
        (acc, [key, value]) => acc.replace(new RegExp(`\\[${key}\\]`, "g"), String(value)),
        picked
      );
    };

    const runBehaviorTriggers = async () => {
      try {
        const [progressionRes, bonusRes] = await Promise.all([
          api.get<{
            level: number;
            streak: number;
            depositNextLevel: number | null;
            depositRemainingToNext: number | null;
            totalDepositedUsd: number;
          }>("/user/current_xp_level"),
          api.get<{ bonus_id: string; label: string; multiplier: number; end_time: string }[]>(
            "/bonuses/active"
          )
        ]);
        if (cancelled) {
          return;
        }
        const progression = progressionRes.data;
        const bonuses = bonusRes.data;
        const now = Date.now();
        const hasDeposits = progression.totalDepositedUsd > 0;
        const remaining = Math.max(0, Math.round(progression.depositRemainingToNext ?? 0));
        const nextLevel = progression.depositNextLevel ?? progression.level + 1;
        const activeBonus = bonuses[0];
        const daysSinceTokenIssued = getDaysSinceLogin();
        const variantsByType: Record<string, string[]> = {
          comeback: [
            "Welcome back. Your account progress is still active - one deposit can restart momentum.",
            "Great to see you again. Your level progress is waiting to continue.",
            "You are back at the right time. Continue your growth before momentum slows."
          ],
          deposit_prompt: [
            "You are just $[remaining] away from Level [nextLevel]. One deposit gets you there.",
            "A new deposit can close the $[remaining] gap to Level [nextLevel].",
            "Ready to grow your rewards? Deposit now to move toward Level [nextLevel]."
          ],
          multiplier_urgency: [
            "Your [label] multiplier boost ends soon. Lock in gains before it expires.",
            "Time is running out on [label]. Deposit while the boost is active.",
            "[label] is near expiry. Use the multiplier window now."
          ],
          level_progress: [
            "You are [remaining] USD from Level [nextLevel]. Keep your progression moving.",
            "Level [nextLevel] is within reach. Only $[remaining] remaining.",
            "Your account is progressing. Close the $[remaining] gap to the next level."
          ],
          empty_state: [
            "Start your first deposit to activate levels, rewards, and progression tracking.",
            "No deposits yet. Your first deposit unlocks your growth journey.",
            "Begin now: your first approved deposit activates account progression."
          ],
          streak: [
            "You are on a [streak] day streak. Keep consistency to protect multipliers.",
            "Consistency wins - [streak] day streak active.",
            "Your [streak] day streak is active. Keep depositing to maintain momentum."
          ]
        };

        if (daysSinceTokenIssued >= 3) {
          queueNotification(
            {
              notification_id: `comeback-${user.user_id}-${new Date().toDateString()}`,
              type: "comeback",
              message: buildMessage("comeback", variantsByType.comeback, {}),
              timestamp: new Date(now).toISOString()
            },
            `comeback:${new Date(now).toDateString()}`
          );
        }
        if (!hasDeposits) {
          queueNotification(
            {
              notification_id: `empty-state-${user.user_id}`,
              type: "empty_state",
              message: buildMessage("empty_state", variantsByType.empty_state, {}),
              timestamp: new Date(now).toISOString()
            },
            "empty_state:account"
          );
        } else if (remaining > 0) {
          queueNotification(
            {
              notification_id: `deposit-prompt-${user.user_id}-${nextLevel}`,
              type: "deposit_prompt",
              message: buildMessage("deposit_prompt", variantsByType.deposit_prompt, {
                remaining,
                nextLevel
              }),
              timestamp: new Date(now).toISOString()
            },
            `deposit_prompt:level-${nextLevel}:remaining-${Math.ceil(remaining / 100)}`
          );
          queueNotification(
            {
              notification_id: `level-progress-${user.user_id}-${nextLevel}`,
              type: "level_progress",
              message: buildMessage("level_progress", variantsByType.level_progress, {
                remaining,
                nextLevel
              }),
              timestamp: new Date(now).toISOString()
            },
            `level_progress:${nextLevel}:${Math.ceil(remaining / 50)}`
          );
        }
        if (progression.streak >= 2) {
          queueNotification(
            {
              notification_id: `streak-${user.user_id}-${progression.streak}`,
              type: "streak_consistency",
              message: buildMessage("streak", variantsByType.streak, {
                streak: progression.streak
              }),
              timestamp: new Date(now).toISOString()
            },
            `streak:${progression.streak}`
          );
        }
        if (activeBonus) {
          const minutesLeft = Math.max(
            0,
            Math.round((new Date(activeBonus.end_time).getTime() - now) / 60_000)
          );
          if (minutesLeft > 0 && minutesLeft <= 120) {
            queueNotification(
              {
                notification_id: `multiplier-urgency-${activeBonus.bonus_id}`,
                type: "multiplier_urgency",
                message: buildMessage("multiplier_urgency", variantsByType.multiplier_urgency, {
                  label: activeBonus.label
                }),
                timestamp: new Date(now).toISOString()
              },
              `multiplier_urgency:${activeBonus.bonus_id}`
            );
          }
        }
      } catch {
        return;
      }
    };

    void runBehaviorTriggers();
    const interval = window.setInterval(runBehaviorTriggers, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [accessToken, queueNotification, user]);

  const popToast = () => {
    setToastQueue((prev) => prev.slice(1));
  };

  const markAllRead = () => {
    setUnreadCount(0);
  };

  const dismissPanelNotification = (notificationId: string) => {
    dismissedIdsRef.current.add(notificationId);
    setPanelNotifications((prev) =>
      prev.filter((item) => item.notification_id !== notificationId)
    );
    setToastQueue((prev) =>
      prev.filter((item) => item.notification_id !== notificationId)
    );
    persistNotificationState();
  };

  const clearPanelNotifications = () => {
    setPanelNotifications((prev) => {
      prev.forEach((item) => dismissedIdsRef.current.add(item.notification_id));
      return [];
    });
    setToastQueue([]);
    persistNotificationState();
  };

  const value: NotificationContextValue = useMemo(
    () => ({
      toastQueue,
      popToast,
      socialEvent,
      setSocialEvent,
      panelNotifications,
      unreadCount,
      markAllRead,
      dismissPanelNotification,
      clearPanelNotifications
    }),
    [toastQueue, socialEvent, panelNotifications, unreadCount]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotificationContext must be used within NotificationProvider");
  }
  return ctx;
}

export function NotificationToasts() {
  const { toastQueue, popToast, socialEvent, setSocialEvent } =
    useNotificationContext();
  const active = toastQueue[0];
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!active || isPaused) {
      return;
    }
    const timeout = window.setTimeout(() => {
      popToast();
    }, 6200);
    return () => window.clearTimeout(timeout);
  }, [active, isPaused, popToast]);

  useEffect(() => {
    if (!socialEvent) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setSocialEvent(null);
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [setSocialEvent, socialEvent]);

  const dismiss = () => {
    popToast();
  };

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 70) {
      dismiss();
    }
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-40 flex justify-center px-4">
        <AnimatePresence>
          {active && (
            <motion.div
              key={active.notification_id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={onDragEnd}
              onHoverStart={() => setIsPaused(true)}
              onHoverEnd={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
              className="card pointer-events-auto w-full max-w-sm px-4 py-3 text-xs shadow-xl"
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <div className="font-medium text-[#F5F5F7]">{getNotificationTitle(active.type)}</div>
                <button
                  type="button"
                  onClick={dismiss}
                  className="-mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#1F2023] hover:text-[#F5F5F7]"
                  aria-label="Dismiss notification"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-[#9CA3AF]">{active.message}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-40 flex justify-center px-4 lg:bottom-4">
        <AnimatePresence>
          {socialEvent && (
            <motion.div
              key={socialEvent.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-full bg-[#141517] px-4 py-2 text-xs text-[#16C784] shadow-lg ring-1 ring-inset ring-[#16C784]/30"
            >
              <span className="min-w-0 flex-1 text-center">{socialEvent.message}</span>
              <button
                type="button"
                onClick={() => setSocialEvent(null)}
                className="-mr-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#16C784] transition-colors hover:bg-[#16C784]/15"
                aria-label="Dismiss activity notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export function getNotificationTitle(type: string): string {
  if (type === "comeback") return "Welcome back";
  if (type === "deposit_prompt") return "Deposit opportunity";
  if (type === "level_progress") return "Level progress";
  if (type === "multiplier_urgency") return "Multiplier ending soon";
  if (type === "streak_consistency") return "Streak active";
  if (type === "empty_state") return "Start your growth";
  if (type === "level_up") return "Level up";
  if (type === "streak_bonus") return "Streak bonus";
  if (type === "deposit_created") return "Deposit submitted";
  if (type === "deposit_status") return "Deposit updated";
  if (type === "withdrawal_created") return "Withdrawal submitted";
  if (type === "withdrawal_status") return "Withdrawal updated";
  if (type === "streak_reset") return "Streak reset";
  if (type === "market_alert") return "Market alert";
  if (type === "bonus_expiring") return "Bonus ending soon";
  if (type === "portfolio_milestone") return "Portfolio milestone";
  if (type === "multiplier_expiring") return "Multiplier ending soon";
  if (type === "retention_bonus") return "Come-back bonus";
  if (type === "retention_nudge") return "Progress nudge";
  if (type === "risk_flag") return "Security review";
  if (type === "churn_risk_high") return "Retention boost";
  if (type === "churn_risk_medium") return "Progress reminder";
  if (type === "ai_loyalty") return "Loyalty unlocked";
  if (type === "ai_retention") return "Come-back boost";
  if (type === "ai_tip") return "Smart tip";
  if (type === "ai_timed_nudge") return "Timing insight";
  if (type === "ai_trust") return "Trust & safety";
  if (type === "referral_reward") return "Referral reward";
  if (type === "referral_welcome_boost") return "Welcome boost";
  if (type === "referral_blocked") return "Referral review";
  if (type === "fraud_flag") return "Fraud monitoring";
  if (type === "fraud_wallet_duplicate") return "Wallet duplication";
  if (type === "fraud_referral_abuse") return "Referral abuse alert";
  if (type === "admin_announcement") return "Platform update";
  return "Notification";
}

function getDaysSinceLogin(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem("authTokens");
    if (!raw) {
      return 0;
    }
    const parsed = JSON.parse(raw) as { issuedAt?: number };
    if (!parsed.issuedAt) {
      return 0;
    }
    return Math.floor((Date.now() - parsed.issuedAt) / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}

