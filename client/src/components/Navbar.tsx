import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Bell, CircleUser, LogOut, Menu, X } from "lucide-react";
import type { RootState } from "../store";
import { AppDispatch } from "../store";
import { logout } from "../store/authSlice";
import { useNotificationContext, getNotificationTitle } from "./NotificationProvider";

interface NavbarProps {
  showSidebarToggle?: boolean;
  onToggleSidebar?: () => void;
}

export function Navbar({ showSidebarToggle, onToggleSidebar }: NavbarProps) {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { panelNotifications, unreadCount, markAllRead } = useNotificationContext();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const avatarId = "navbar-avatar-button";
  const notificationId = "navbar-notification-button";
  const avatarMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);

  const isLanding = location.pathname === "/landing";

  const landingSections = useMemo(
    () => [
      { id: "home", label: "Home" },
      { id: "how-it-works", label: "How It Works" },
      { id: "multiplier-engine", label: "Multiplier Engine" },
      { id: "leaderboard", label: "Leaderboard" },
      { id: "security", label: "Security" },
      { id: "faq", label: "FAQ" }
    ],
    []
  );

  const [activeLandingSection, setActiveLandingSection] = useState<string>("home");

  useEffect(() => {
    if (!isLanding) {
      return;
    }

    const ratioById = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (!id) continue;
          ratioById.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }

        let bestId = activeLandingSection;
        let bestRatio = 0;
        for (const section of landingSections) {
          const ratio = ratioById.get(section.id) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = section.id;
          }
        }

        if (bestId && bestId !== activeLandingSection) {
          setActiveLandingSection(bestId);
        }
      },
      {
        root: null,
        rootMargin: "-72px 0px -55% 0px",
        threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75]
      }
    );

    landingSections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [isLanding, activeLandingSection, landingSections]);

  const handleLandingNavClick = (sectionId: string) => {
    if (location.pathname !== "/landing") {
      setMobileMenuOpen(false);
      navigate(`/landing#${sectionId}`);
      return;
    }
    const element = document.getElementById(sectionId);
    if (!element) {
      return;
    }
    const headerOffset = 72;
    const rect = element.getBoundingClientRect();
    const targetScrollTop = window.scrollY + rect.top - headerOffset;
    window.scrollTo({
      top: targetScrollTop,
      behavior: "smooth"
    });
    setActiveLandingSection(sectionId);
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/landing", { replace: true });
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const avatarButton = document.getElementById(avatarId);
      const notificationButton = document.getElementById(notificationId);
      const avatarMenu = avatarMenuRef.current;
      const notificationsMenu = notificationsMenuRef.current;
      const clickedInsideAvatar =
        (avatarButton?.contains(target) ?? false) || (avatarMenu?.contains(target) ?? false);
      const clickedInsideNotifications =
        (notificationButton?.contains(target) ?? false) ||
        (notificationsMenu?.contains(target) ?? false);

      if (!clickedInsideAvatar && !clickedInsideNotifications) {
        setAvatarOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [avatarId, notificationId]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-[#050509]/80 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.7)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {showSidebarToggle && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#26272B] bg-[#17181A] text-[#9CA3AF]"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          {!user && (
            <Link to="/landing" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17181A] text-xs font-bold text-[#C6A15B] ring-2 ring-[#C6A15B]">
                CL
              </span>
              <span className="text-sm font-semibold tracking-tight text-[#F5F5F7] sm:text-base">
                Crypto Levels
              </span>
            </Link>
          )}
        </div>
        {isLanding && !user && (
          <div className="hidden items-center gap-5 text-[11px] text-[#9CA3AF] md:flex">
            {landingSections.map((item) => {
              const isActive = activeLandingSection === item.id;
              return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleLandingNavClick(item.id)}
                className={`group relative text-[11px] font-medium transition-colors ${
                  isActive ? "text-[#F5F5F7]" : "text-[#9CA3AF] hover:text-[#F5F5F7]"
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`pointer-events-none absolute -bottom-1 left-0 h-px w-full origin-left bg-[#C6A15B] transition-transform duration-200 ${
                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </button>
              );
            })}
          </div>
        )}
        <nav className="flex items-center gap-3 text-[11px] sm:text-xs">
          {user && user.is_admin && (
            <>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `hidden rounded-full px-2 py-1 border text-[11px] md:inline-flex ${
                    isActive
                      ? "border-[#C6A15B] text-[#C6A15B]"
                      : "border-[#26272B] text-[#9CA3AF]"
                  }`
                }
              >
                Admin
              </NavLink>
              <NavLink
                to="/admin/analytics"
                className={({ isActive }) =>
                  `hidden rounded-full px-2 py-1 border text-[11px] md:inline-flex ${
                    isActive
                      ? "border-[#C6A15B] text-[#C6A15B]"
                      : "border-[#26272B] text-[#9CA3AF]"
                  }`
                }
              >
                Intelligence
              </NavLink>
            </>
          )}
          {!user && (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1 text-xs ${
                      isActive
                        ? "bg-[#C6A15B] text-[#0F0F10]"
                        : "bg-[#17181A] text-[#F5F5F7]"
                    }`
                  }
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) =>
                    `rounded-full bg-gradient-to-r from-[#C6A15B] to-[#FACC15] px-3 py-1 text-xs font-semibold text-[#0F0F10] shadow-[0_0_24px_rgba(198,161,91,0.5)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(198,161,91,0.7)] ${
                      isActive ? "" : ""
                    }`
                  }
                >
                  Register
                </NavLink>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] shadow-[0_0_18px_rgba(0,0,0,0.6)] sm:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
            </>
          )}
          {user && (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative">
                <button
                  id={notificationId}
                  type="button"
                  onClick={() => {
                    markAllRead();
                    setNotificationsOpen((open) => !open);
                    setAvatarOpen(false);
                  }}
                  className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#9CA3AF] hover:text-[#F5F5F7]"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#EA3943] px-1 text-[10px] font-semibold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <div
                    ref={notificationsMenuRef}
                    className="absolute right-0 z-[9999] mt-3 w-72 rounded-2xl border border-[#26272B] bg-[#17181A] text-[#F5F5F7] backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                  >
                    <div className="border-b border-[#26272B] px-4 py-2.5">
                      <p className="text-xs font-semibold text-[#F5F5F7]">
                        Notifications
                      </p>
                    </div>
                    <div className="max-h-80 space-y-1 overflow-y-auto px-2 py-2 text-xs">
                      {panelNotifications.length === 0 && (
                        <p className="px-2 py-2 text-[11px] text-[#9CA3AF]">
                          You are all caught up. New activity will appear here in
                          real time.
                        </p>
                      )}
                      {panelNotifications.length > 0 &&
                        panelNotifications
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(b.timestamp).getTime() -
                              new Date(a.timestamp).getTime()
                          )
                          .map((item) => (
                            <div
                              key={item.notification_id}
                              className="px-3 py-2 text-[11px] hover:bg-[#0F0F10] rounded-xl"
                            >
                              <p className="font-medium text-[#F5F5F7]">
                                {getNotificationTitle(item.type)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                                {item.message}
                              </p>
                              <p className="mt-0.5 text-[10px] text-[#6B7280]">
                                {new Date(item.timestamp).toLocaleString()}
                              </p>
                            </div>
                          ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  id={avatarId}
                  type="button"
                  onClick={() => {
                    setAvatarOpen((open) => !open);
                    setNotificationsOpen(false);
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] ring-2 ring-[#C6A15B]"
                >
                  <CircleUser className="h-4 w-4" />
                </button>
                {avatarOpen && (
                  <div
                    ref={avatarMenuRef}
                    className="absolute right-0 z-40 mt-3 w-48 rounded-2xl border border-[#26272B] bg-[#0F0F10] py-2 text-xs shadow-xl"
                  >
                    <div className="px-3 pb-2 text-[11px] text-[#9CA3AF]">
                      <p className="truncate">
                        {user.email ?? user.name ?? "Signed in"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[11px] text-[#F5F5F7] hover:bg-[#17181A]"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </div>
      {!user &&
        mobileMenuOpen &&
        portalReady &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-[#0F0F10] sm:hidden"
            role="dialog"
            aria-modal="true"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="absolute inset-0 flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#0F0F10] via-[#0B0B0D] to-[#050509] px-6 py-6 shadow-[0_0_80px_rgba(0,0,0,0.95)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17181A] text-xs font-bold text-[#C6A15B] ring-2 ring-[#C6A15B]">
                    CL
                  </span>
                  <span className="text-sm font-semibold tracking-tight text-[#F5F5F7]">
                    Crypto Levels
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#17181A] text-[#9CA3AF] hover:text-[#F5F5F7]"
                  aria-label="Close navigation"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain pb-10 text-[#F5F5F7]">
                {isLanding && (
                  <div className="space-y-3">
                    {landingSections.map((item) => {
                      const isActive = activeLandingSection === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleLandingNavClick(item.id)}
                          className={`block w-full rounded-2xl px-4 py-3 text-left text-[16px] font-medium tracking-tight transition-colors ${
                            isActive
                              ? "bg-[#17181A] text-[#F5F5F7]"
                              : "text-[#9CA3AF] hover:bg-[#17181A] hover:text-[#F5F5F7]"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!isLanding && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigate("/landing");
                      }}
                      className="block w-full rounded-2xl px-4 py-3 text-left text-[15px] text-[#9CA3AF] transition-colors hover:bg-[#17181A] hover:text-[#F5F5F7]"
                    >
                      Landing
                    </button>
                  </div>
                )}

                <div className="mt-10 space-y-3 border-t border-[#26272B] pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate("/login");
                    }}
                    className="flex w-full items-center justify-center rounded-full bg-[#17181A] px-4 py-3 text-[14px] font-medium text-[#F5F5F7]"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate("/register");
                    }}
                    className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#C6A15B] to-[#FACC15] px-4 py-3 text-[14px] font-semibold text-[#0F0F10] shadow-[0_0_28px_rgba(198,161,91,0.65)]"
                  >
                    Register
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}

