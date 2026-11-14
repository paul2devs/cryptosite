import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { PanelLeft } from "lucide-react";
import type { RootState } from "../../store";
import { getPageTitle } from "../../config/navigation";
import { getFirstName, getGreeting } from "../../utils/format";
import { NotificationMenu } from "./NotificationMenu";
import { UserProfileMenu } from "./UserProfileMenu";

export function DashboardHeader({
  showSidebarToggle,
  sidebarCollapsed,
  onToggleSidebar
}: {
  showSidebarToggle?: boolean;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  const user = useSelector((state: RootState) => state.auth.user);
  const { pathname } = useLocation();
  const title = getPageTitle(pathname);

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-[#0F0F10]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {showSidebarToggle ? (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#17181A] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] lg:inline-flex"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[11px] text-[#6B7280]">
              {user ? `${getGreeting()}, ${getFirstName(user.name, user.email)}` : getGreeting()}
            </p>
            <h1 className="display-font truncate text-base font-medium tracking-tight text-[#F5F5F7] sm:text-lg">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NotificationMenu />
          <UserProfileMenu />
        </div>
      </div>
      <div className="hairline-b" />
    </header>
  );
}
