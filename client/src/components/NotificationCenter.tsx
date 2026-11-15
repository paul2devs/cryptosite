import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { getNotificationTitle, useNotificationContext } from "./NotificationProvider";
import { formatRelativeTime } from "../utils/format";

export function NotificationCenter() {
  const {
    panelNotifications,
    unreadCount,
    markAllRead,
    dismissPanelNotification,
    clearPanelNotifications
  } = useNotificationContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonId = "notification-center-button";

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const button = document.getElementById(buttonId);
      if ((button?.contains(target) ?? false) || (containerRef.current?.contains(target) ?? false)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const sorted = panelNotifications
    .slice()
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  return (
    <div className="relative">
      <button
        id={buttonId}
        type="button"
        onClick={() => {
          markAllRead();
          setOpen((value) => !value);
        }}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#17181A] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#EA3943] px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          ref={containerRef}
          role="menu"
          className="card absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden"
        >
          <div className="hairline-b flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#F5F5F7]">Notifications</p>
              <p className="mt-0.5 text-[11px] text-[#6B7280]">
                {sorted.length > 0 ? `${sorted.length} recent updates` : "No new updates"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close notifications"
              className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#1F2023] hover:text-[#F5F5F7]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
            {sorted.length === 0 ? (
              <p className="px-4 py-6 text-xs leading-relaxed text-[#9CA3AF]">
                You are all caught up. Account activity and status changes will appear here.
              </p>
            ) : (
              <>
                {sorted.map((item) => (
                  <article
                    key={item.notification_id}
                    className="list-row flex-col items-stretch gap-1 px-4 py-3 transition-colors hover:bg-[#17181A]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-xs font-medium text-[#F5F5F7]">
                        {getNotificationTitle(item.type)}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[10px] text-[#6B7280]">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                        <button
                          type="button"
                          onClick={() => dismissPanelNotification(item.notification_id)}
                          aria-label="Dismiss this notification"
                          className="-mr-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[#6B7280] transition-colors hover:bg-[#1F2023] hover:text-[#F5F5F7]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{item.message}</p>
                  </article>
                ))}
                <div className="hairline-t flex justify-end px-4 py-2.5">
                  <button
                    type="button"
                    onClick={clearPanelNotifications}
                    className="text-[11px] font-medium text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
                  >
                    Clear all
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
