import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "cookieConsent.v1";
const CONSENT_EVENT = "cookie-consent-updated";

type ConsentValue = "accepted" | "declined";

function readConsent(): ConsentValue | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "accepted" || raw === "declined" ? raw : null;
  } catch {
    return null;
  }
}

function writeConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, {
        detail: { value }
      })
    );
  } catch {
    // ignore
  }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const canRender = useMemo(() => typeof window !== "undefined", []);

  useEffect(() => {
    if (!canRender) return;
    const consent = readConsent();
    setVisible(consent === null);
  }, [canRender]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[60] px-4 sm:px-6 lg:bottom-6">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-[#17181A]/95 backdrop-blur shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-[#F5F5F7] tracking-tight">
              Cookies & session security
            </p>
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              We use cookies and local storage to improve your experience, support core
              platform functionality, and maintain session security.{" "}
              <Link
                to="/cookies"
                className="text-[#C6A15B] hover:text-[#D4B070] transition-colors"
              >
                Learn more
              </Link>
              .
            </p>
          </div>
          <div className="flex items-center gap-2 sm:flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                writeConsent("declined");
                setVisible(false);
              }}
              className="btn btn-md btn-secondary flex-1 sm:flex-none"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => {
                writeConsent("accepted");
                setVisible(false);
              }}
              className="btn btn-md btn-primary flex-1 sm:flex-none"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

