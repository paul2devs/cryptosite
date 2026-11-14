import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import { Navbar } from "./Navbar";
import { DashboardHeader } from "./dashboard/DashboardHeader";
import { NotificationProvider, NotificationToasts } from "./NotificationProvider";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { SupportChatWidget } from "./SupportChatWidget";
import type { RootState, AppDispatch } from "../store";
import { logout } from "../store/authSlice";
import { useI18n } from "../i18n/I18nProvider";
import {
  ALL_NAV_ITEMS,
  FOOTER_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_IDS,
  NAV_GROUPS,
  getNavItemTarget,
  getNavLabel,
  isNavItemActive,
  type NavItem
} from "../config/navigation";
import { getInitials } from "../utils/format";

interface LayoutProps {
  children: ReactNode;
}

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
  const showSupportChat = location.pathname === "/landing" || !!user;
  const isAppShell = !!user;

  useEffect(() => {
    if (!location.hash) {
      return;
    }
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!id) {
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;
    const tryScroll = () => {
      if (cancelled) {
        return;
      }
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < 12) {
        timer = window.setTimeout(tryScroll, 80);
      }
    };
    timer = window.setTimeout(tryScroll, 0);
    return () => {
      cancelled = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [location.hash, location.pathname]);

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-[#0F0F10] text-[#F5F5F7]">
        <div className="flex min-h-screen">
          {isAppShell ? (
            <DesktopSidebar
              collapsed={isSidebarCollapsed}
              onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
            />
          ) : null}
          <div className="flex min-h-screen flex-1 flex-col transition-all duration-300">
            {isAppShell ? (
              <DashboardHeader
                showSidebarToggle
                sidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
              />
            ) : (
              <Navbar />
            )}
            <NotificationToasts />
            <CookieBanner />
            <SupportChatWidget enabled={showSupportChat} />
            <main
              className={`flex-1 transition-all duration-300 ${
                isPublicMarketingOrAuthPage ? "pt-16" : "px-4 pb-28 pt-16 sm:px-6 lg:px-8 lg:pb-10"
              }`}
            >
              {isPublicMarketingOrAuthPage ? (
                children
              ) : (
                <div className="mx-auto w-full max-w-[1240px]">{children}</div>
              )}
            </main>
            {isPublicMarketingOrAuthPage ? <Footer /> : null}
            {isAppShell ? <MobileBottomNav /> : null}
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}

function resolveLabel(t: (key: string) => string, item: NavItem): string {
  return getNavLabel(t, item);
}

function DesktopSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);

  const handleItemClick = (item: NavItem) => {
    if (item.hash && pathname === item.path) {
      const id = item.hash.replace(/^#/, "");
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/landing", { replace: true });
  };

  return (
    <aside
      className={`hidden shrink-0 border-r border-[#26272B] bg-[#0B0B0D] lg:flex lg:flex-col lg:transition-[width] lg:duration-300 ${
        collapsed ? "lg:w-[76px]" : "lg:w-[248px]"
      }`}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <img src="/logo.svg" alt="NexaCrypto" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          {!collapsed && (
            <span className="display-font truncate text-sm font-semibold tracking-tight text-[#F5F5F7]">
              NexaCrypto
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#17181A] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#17181A] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <nav className="no-scrollbar mt-2 flex-1 space-y-5 overflow-y-auto px-2 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-[10px] uppercase tracking-[0.18em] text-[#4B4D52]">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = isNavItemActive(item, pathname, hash);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  to={getNavItemTarget(item)}
                  onClick={() => handleItemClick(item)}
                  title={collapsed ? resolveLabel(t, item) : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-[#C6A15B]/10 text-[#C6A15B]"
                      : "text-[#9CA3AF] hover:bg-[#17181A] hover:text-[#F5F5F7]"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${active ? "text-[#C6A15B]" : "text-[#6B7280] group-hover:text-[#F5F5F7]"}`}
                  />
                  {!collapsed && <span className="truncate">{resolveLabel(t, item)}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t border-[#26272B] px-2 py-3">
        {FOOTER_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              to={getNavItemTarget(item)}
              title={collapsed ? resolveLabel(t, item) : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-[#9CA3AF] transition-colors hover:bg-[#17181A] hover:text-[#F5F5F7] ${
                collapsed ? "justify-center" : ""
              }`}
            >
              <Icon className="h-4 w-4 shrink-0 text-[#6B7280]" />
              {!collapsed && <span className="truncate">{resolveLabel(t, item)}</span>}
            </Link>
          );
        })}
      </div>

      {user && (
        <div className="border-t border-[#26272B] px-2 py-3">
          <div
            className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F2023] text-xs font-semibold text-[#C6A15B] ring-1 ring-inset ring-[#C6A15B]/40">
              {getInitials(user.name, user.email)}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[#F5F5F7]">
                  {user.name || user.email}
                </p>
                <p className="truncate text-[10px] text-[#6B7280]">{user.email}</p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#9CA3AF] transition-colors hover:bg-[#17181A] hover:text-[#EA3943]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function MobileBottomNav() {
  const { t } = useI18n();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = MOBILE_PRIMARY_NAV_IDS.map((id) =>
    ALL_NAV_ITEMS.find((item) => item.id === id)
  ).filter((item): item is NavItem => Boolean(item));

  const handleLogout = () => {
    setMoreOpen(false);
    dispatch(logout());
    navigate("/landing", { replace: true });
  };

  const closeAnd = (action: () => void) => {
    setMoreOpen(false);
    action();
  };

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#26272B] bg-[#0F0F10]/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[max(env(safe-area-inset-bottom),0px)] pt-1.5">
          {primaryItems.map((item) => {
            const active = isNavItemActive(item, pathname, hash);
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={getNavItemTarget(item)}
                className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition-colors ${
                  active ? "text-[#C6A15B]" : "text-[#6B7280]"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{resolveLabel(t, item)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-medium text-[#6B7280] transition-colors"
          >
            <span className="flex h-5 items-center justify-center text-base leading-none">•••</span>
            <span>More</span>
          </button>
        </div>
      </nav>
      {moreOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] bg-[#0F0F10] lg:hidden"
              role="dialog"
              aria-modal="true"
              onClick={() => setMoreOpen(false)}
            >
              <div
                className="flex h-full flex-col bg-[#0F0F10] px-5 pb-8 pt-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="display-font text-sm font-semibold tracking-tight text-[#F5F5F7]">
                    Menu
                  </span>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    aria-label="Close menu"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#17181A] text-[#9CA3AF]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.id} className="space-y-1">
                      <p className="px-3 text-[10px] uppercase tracking-[0.18em] text-[#4B4D52]">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        const active = isNavItemActive(item, pathname, hash);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.id}
                            to={getNavItemTarget(item)}
                            onClick={() => setMoreOpen(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ${
                              active
                                ? "bg-[#C6A15B]/10 text-[#C6A15B]"
                                : "text-[#9CA3AF] hover:bg-[#17181A] hover:text-[#F5F5F7]"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{resolveLabel(t, item)}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                  <div className="space-y-1 border-t border-[#26272B] pt-4">
                    {FOOTER_NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={getNavItemTarget(item)}
                          onClick={() => setMoreOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#9CA3AF] transition-colors hover:bg-[#17181A] hover:text-[#F5F5F7]"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{resolveLabel(t, item)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => closeAnd(handleLogout)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#17181A] px-4 py-3 text-sm font-medium text-[#F5F5F7]"
                >
                  <LogOut className="h-4 w-4 text-[#EA3943]" />
                  <span>Log out</span>
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
