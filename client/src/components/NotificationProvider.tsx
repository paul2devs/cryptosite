import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import type { RootState } from "../store";
import { api } from "../utils/api";
import { getRealtimeSocket, SocialProofEvent } from "../utils/realtime";
import type { ActivityEvent } from "../data/activityFeed";

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
  pushActivityNotification: (title: string, body: string) => void;
  activityEvents: ActivityEvent[];
  pushActivityEvent: (event: ActivityEvent) => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const [toastQueue, setToastQueue] = useState<NotificationItem[]>([]);
  const [socialEvent, setSocialEvent] = useState<SocialProofEvent | null>(null);
  const [panelNotifications, setPanelNotifications] = useState<NotificationItem[]>(
    []
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    if (!accessToken) {
      setToastQueue([]);
      setSocialEvent(null);
      setPanelNotifications([]);
      setUnreadCount(0);
      setActivityEvents([]);
      return;
    }

    let cancelled = false;
    let socket = getRealtimeSocket();

    const loadUnseen = async () => {
      try {
        const res = await api.get<NotificationItem[]>("/notifications/unseen");
        if (!cancelled && res.data.length > 0) {
          setToastQueue((prev) => [...prev, ...res.data]);
          setPanelNotifications((prev) => [...res.data, ...prev]);
          setUnreadCount((prev) => prev + res.data.length);
        }
      } catch {
        if (!cancelled) {
          setToastQueue([]);
        }
      }
    };

    loadUnseen();
    const interval = setInterval(loadUnseen, 7000);

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
  }, [accessToken]);

  const popToast = () => {
    setToastQueue((prev) => prev.slice(1));
  };

  const markAllRead = () => {
    setUnreadCount(0);
  };

  const pushActivityNotification = (title: string, body: string) => {
    const now = new Date().toISOString();
    const id = `activity-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const item: NotificationItem = {
      notification_id: id,
      type: title,
      message: body,
      timestamp: now
    };
    setPanelNotifications((prev) => [item, ...prev]);
    setUnreadCount((prev) => prev + 1);
  };

  const pushActivityEvent = (event: ActivityEvent) => {
    setActivityEvents((prev) => {
      const exists = prev.some((e) => e.id === event.id);
      if (exists) {
        return prev;
      }
      return [...prev, event];
    });
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
      pushActivityNotification,
      activityEvents,
      pushActivityEvent
    }),
    [
      toastQueue,
      socialEvent,
      panelNotifications,
      unreadCount,
      activityEvents
    ]
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
  const [active, ...rest] = toastQueue;

  useEffect(() => {
    if (!active) {
      return;
    }
    const timeout = setTimeout(() => {
      popToast();
    }, 4000);
    return () => clearTimeout(timeout);
  }, [active, rest, popToast]);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center">
        <AnimatePresence>
          {active && (
            <motion.div
              key={active.notification_id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="pointer-events-auto mx-4 w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-xs shadow-xl"
            >
              <div className="mb-1 font-medium text-slate-100">
                {getNotificationTitle(active.type)}
              </div>
              <div className="text-slate-300">{active.message}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center">
        <AnimatePresence>
          {socialEvent && (
            <motion.div
              key={socialEvent.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-none mx-4 w-full max-w-md rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-center text-xs text-emerald-200 shadow-lg"
            >
              {socialEvent.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export function getNotificationTitle(type: string): string {
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

