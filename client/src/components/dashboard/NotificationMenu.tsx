import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNotificationContext, getNotificationTitle } from "../NotificationProvider";
import { formatRelativeTime } from "../../utils/format";

export function NotificationMenu() {
  const { panelNotifications, unreadCount, markAllRead } = useNotificationContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonId = "dashboard-notification-button";

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
          className="card absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden"
          role="menu"
        >
          <div className="hairline-b px-4 py-3">
            <p className="text-xs font-medium text-[#F5F5F7]">Notifications</p>
            <p className="mt-0.5 text-[11px] text-[#6B7280]">
              {sorted.length > 0 ? `${sorted.length} recent updates` : "No new updates"}
            </p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
            {sorted.length === 0 ? (
              <p className="px-4 py-6 text-xs leading-relaxed text-[#9CA3AF]">
                You are all caught up. Account activity and status changes will appear here.
              </p>
            ) : (
              sorted.map((item) => (
                <div
                  key={item.notification_id}
                  className="list-row flex-col items-stretch gap-1 px-4 py-3 transition-colors hover:bg-[#17181A]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-xs font-medium text-[#F5F5F7]">
                      {getNotificationTitle(item.type)}
                    </p>
                    <span className="shrink-0 text-[10px] text-[#6B7280]">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{item.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
