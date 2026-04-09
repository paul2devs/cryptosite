import { ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Navbar } from "./Navbar";
import { NotificationProvider, NotificationToasts } from "./NotificationProvider";
import { LiveActivityPopups } from "./LiveActivityPopups";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import type { RootState } from "../store";
import btcIcon from "../assets/crypto/compressed/icons8-home.svg";
import ethIcon from "../assets/crypto/compressed/portfolio.svg";
import usdtIcon from "../assets/crypto/compressed/deposit.svg";
import solIcon from "../assets/crypto/compressed/withdrawl.svg";
import bnbIcon from "../assets/crypto/compressed/leaderboard.svg";
import xrpIcon from "../assets/crypto/compressed/referral.svg";

interface LayoutProps {
  children: ReactNode;
}

type NavItem = {
  to: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: btcIcon },
  { to: "/portfolio", label: "Portfolio", icon: ethIcon },
  { to: "/deposit", label: "Deposit", icon: usdtIcon },
  { to: "/withdraw", label: "Withdraw", icon: solIcon },
  { to: "/leaderboards", label: "Leaderboard", icon: bnbIcon },
  { to: "/referrals", label: "Referrals", icon: xrpIcon }
];

export function Layout({ children }: LayoutProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  const isPublicMarketingOrAuthPage =
    location.pathname === "/landing" ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password" ||
    location.pathname.startsWith("/reset-password");

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-[#0F0F10] text-[#F5F5F7]">
        <div className="flex min-h-screen">
          {user && (
            <DesktopSidebar
              collapsed={isSidebarCollapsed}
              onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
            />
          )}
          <div className="flex min-h-screen flex-1 flex-col transition-all duration-300">
            <Navbar
              showSidebarToggle={!!user}
              onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
            />
            <NotificationToasts />
            <LiveActivityPopups />
            <CookieBanner />
            <main
              className={`flex-1 pt-16 transition-all duration-300 ${
                isPublicMarketingOrAuthPage
                  ? ""
                  : "px-4 pb-24 sm:px-6 lg:px-8 lg:pb-8"
              } ${isSidebarCollapsed ? "lg:pl-8 xl:pl-10" : "lg:pl-8 xl:pl-10"}`}
            >
              {isPublicMarketingOrAuthPage ? (
                children
              ) : (
                <div className="mx-auto w-full max-w-5xl">{children}</div>
              )}
            </main>
            {isPublicMarketingOrAuthPage ? <Footer /> : null}
            {user && <MobileBottomNav />}
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}

function DesktopSidebar({
  collapsed,
  onToggle
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`hidden border-r border-[#26272B] bg-[#0B0B0D]/95 backdrop-blur lg:flex lg:flex-col lg:transition-[width] lg:duration-300 ${
        collapsed ? "lg:w-20" : "lg:w-[260px]"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-xs font-bold text-[#C6A15B] ring-2 ring-[#C6A15B]">
            CL
          </span>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-[#F5F5F7]">
              Crypto Levels
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="hidden h-7 w-7 items-center justify-center rounded-full border border-[#26272B] bg-[#17181A] text-[#9CA3AF] hover:text-[#F5F5F7] transition-colors lg:inline-flex"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <nav className="mt-2 flex-1 space-y-1 px-2 pb-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-xs ${
                isActive
                  ? "bg-[#17181A] text-[#F5F5F7]"
                  : "text-[#9CA3AF] hover:bg-[#111214]"
              }`
            }
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111214]">
              <img src={item.icon} alt="" className="h-4 w-4" loading="lazy" aria-hidden="true" />
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#26272B] bg-[#17181A]/95 backdrop-blur-sm lg:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-3 py-2.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 text-[11px] ${
                isActive ? "text-[#C6A15B]" : "text-[#9CA3AF]"
              }`
            }
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-transparent"
              aria-hidden="true"
            >
              <img src={item.icon} alt="" className="h-5 w-5" loading="lazy" />
            </div>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
