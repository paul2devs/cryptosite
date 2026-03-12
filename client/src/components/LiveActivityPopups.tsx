import { useEffect, useState } from "react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { X } from "lucide-react";
import {
  ActivityEvent,
  getRandomUnseenActivityEvent,
  markActivityEventSeen
} from "../data/activityFeed";
import { useNotificationContext } from "./NotificationProvider";

const DISMISSED_STORAGE_KEY = "dismissedActivityPopups";

function readDismissedIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeDismissedIds(ids: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const arr = Array.from(ids);
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage errors
  }
}

export function LiveActivityPopups() {
  const [activeEvent, setActiveEvent] = useState<ActivityEvent | null>(null);
  const { pushActivityNotification, pushActivityEvent } = useNotificationContext();
  const [dismissedIds] = useState<Set<string>>(readDismissedIds());

  const handleDismiss = (eventId: string) => {
    const dismissed = readDismissedIds();
    dismissed.add(eventId);
    writeDismissedIds(dismissed);
    setActiveEvent(null);
  };

  const handleSwipe = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 50;
    if (Math.abs(info.offset.x) > swipeThreshold || Math.abs(info.offset.y) > swipeThreshold) {
      if (activeEvent) {
        handleDismiss(activeEvent.id);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    let popupTimeout: number | null = null;
    let scheduleTimeout: number | null = null;

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }
      const delaySeconds = 8 + Math.floor(Math.random() * 9);
      scheduleTimeout = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        const event = getRandomUnseenActivityEvent();
        if (!event) {
          scheduleNext();
          return;
        }
        const dismissed = readDismissedIds();
        if (dismissed.has(event.id)) {
          markActivityEventSeen(event.id);
          scheduleNext();
          return;
        }
        markActivityEventSeen(event.id);
        setActiveEvent(event);
        pushActivityEvent(event);
        const title =
          event.type === "deposit"
            ? "New Deposit"
            : event.type === "level_up"
            ? "Level Progress"
            : event.type === "multiplier"
            ? "Multiplier Activated"
            : "Reward Earned";
        const amountPart =
          typeof event.amountUsd === "number"
            ? ` $${event.amountUsd.toLocaleString()}`
            : "";
        const body = `${event.userName} ${describeEventBody(event)}${amountPart}`;
        pushActivityNotification(title, body);
        popupTimeout = window.setTimeout(() => {
          setActiveEvent(null);
          scheduleNext();
        }, 5000);
      }, delaySeconds * 1000);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (popupTimeout !== null) {
        window.clearTimeout(popupTimeout);
      }
      if (scheduleTimeout !== null) {
        window.clearTimeout(scheduleTimeout);
      }
    };
  }, [pushActivityNotification, pushActivityEvent]);

  if (!activeEvent) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-24 left-4 z-40 max-w-xs">
      <AnimatePresence>
        {activeEvent && (
          <motion.div
            key={activeEvent.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleSwipe}
            className="pointer-events-auto rounded-2xl border border-[#26272B] bg-[#17181A] px-4 py-3 text-xs text-[#F5F5F7] shadow-[0_18px_40px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-[11px] font-medium text-[#9CA3AF]">New Activity</p>
                <p className="mt-1 text-xs">
                  {activeEvent.description}
                  {typeof activeEvent.amountUsd === "number"
                    ? ` (${formatUsd(activeEvent.amountUsd)})`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDismiss(activeEvent.id)}
                className="flex-shrink-0 rounded-full p-1 text-[#9CA3AF] hover:bg-[#26272B] hover:text-[#F5F5F7] transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function describeEventBody(event: ActivityEvent): string {
  if (event.type === "deposit") {
    return "just deposited";
  }
  if (event.type === "level_up") {
    return "just reached a new level";
  }
  if (event.type === "multiplier") {
    return "activated a multiplier";
  }
  return "earned a reward";
}
