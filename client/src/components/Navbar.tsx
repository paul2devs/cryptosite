import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { LANDING_SECTIONS } from "./landing/landingContent";

export function Navbar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  const isLanding = location.pathname === "/landing";

  const landingSections = useMemo(
    () => LANDING_SECTIONS.map((section) => ({ id: section.id, label: section.label })),
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

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-[#050509]/80 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.7)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/landing" className="flex items-center gap-2">
          <img src="/logo.png" alt="NexaCrypto" className="h-7 w-7 rounded-full object-cover" />
          <span className="text-sm font-semibold tracking-tight text-[#F5F5F7] sm:text-base">
            NexaCrypto
          </span>
        </Link>
        {isLanding && (
          <div className="hidden items-center gap-5 text-[11px] text-[#9CA3AF] lg:flex">
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
          <div className="hidden items-center gap-2 sm:flex">
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `rounded-full px-3 py-1 text-xs ${
                  isActive ? "bg-[#C6A15B] text-[#0F0F10]" : "bg-[#17181A] text-[#F5F5F7]"
                }`
              }
            >
              {t("nav_login")}
            </NavLink>
            <NavLink
              to="/register"
              className="rounded-full bg-gradient-to-r from-[#C6A15B] to-[#FACC15] px-3 py-1 text-xs font-semibold text-[#0F0F10] shadow-[0_0_24px_rgba(198,161,91,0.5)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(198,161,91,0.7)]"
            >
              {t("nav_register")}
            </NavLink>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] shadow-[0_0_18px_rgba(0,0,0,0.6)] lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
        </nav>
      </div>
      {mobileMenuOpen &&
        portalReady &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-[#0F0F10] lg:hidden"
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
                  <img src="/logo.png" alt="NexaCrypto" className="h-7 w-7 rounded-full object-cover" />
                  <span className="text-sm font-semibold tracking-tight text-[#F5F5F7]">
                    NexaCrypto
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
                {isLanding ? (
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
                ) : (
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
                    {t("nav_login")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate("/register");
                    }}
                    className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#C6A15B] to-[#FACC15] px-4 py-3 text-[14px] font-semibold text-[#0F0F10] shadow-[0_0_28px_rgba(198,161,91,0.65)]"
                  >
                    {t("nav_register")}
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
