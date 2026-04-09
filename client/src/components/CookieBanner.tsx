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
    <div className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6">
      <div className="mx-auto max-w-5xl rounded-3xl bg-[#17181A]/95 backdrop-blur shadow-[0_25px_80px_rgba(0,0,0,0.65)]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#F5F5F7] tracking-tight">
              Cookies & session security
            </p>
            <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
              We use cookies and local storage to improve your experience, support core
              platform functionality, and maintain session security.{" "}
              <Link
                to="/cookies"
                className="text-[#C6A15B] hover:text-[#FACC15] transition-colors"
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
              className="inline-flex items-center justify-center rounded-full border border-[#2D2F34] bg-[#101114] px-4 py-2 text-xs font-semibold text-[#D1D5DB] transition-colors hover:border-[#4B5563] hover:text-[#F5F5F7]"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => {
                writeConsent("accepted");
                setVisible(false);
              }}
              className="inline-flex items-center justify-center rounded-full bg-[#C6A15B] px-4 py-2 text-xs font-semibold text-[#0F0F10] shadow-[0_0_0_1px_rgba(0,0,0,0.9)] hover:shadow-[0_0_25px_rgba(198,161,91,0.45)] transition-shadow"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

