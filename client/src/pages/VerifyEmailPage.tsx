import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail } from "lucide-react";
import { Seo } from "../components/Seo";
import { AuthShell } from "../components/auth/AuthShell";
import { api } from "../utils/api";

/**
 * Single screen for every email-verification state.
 *
 * - `/verify-email`             → waiting for the user to open the emailed link.
 * - `/verify-email/:token`      → the emailed link was opened; the token is
 *                                 validated on the server and the matching
 *                                 success / expired / invalid state is shown.
 *
 * Nothing here is trusted as proof of verification: the account only becomes
 * verified when the backend validates the token against its stored hash.
 */

const PENDING_EMAIL_KEY = "pendingVerificationEmail";
const FALLBACK_COOLDOWN_SECONDS = 60;

type VerificationStatus =
  | "waiting"
  | "verifying"
  | "verified"
  | "already_verified"
  | "expired"
  | "invalid";

interface VerifyEmailResponse {
  status?: string;
  message?: string;
  email_verified?: boolean;
  code?: string;
}

interface ResendResponse {
  ok?: boolean;
  message?: string;
  cooldownSeconds?: number;
}

function maskEmail(email: string): string {
  const raw = String(email || "").trim();
  const atIndex = raw.lastIndexOf("@");
  if (atIndex <= 0) {
    return raw.length > 0 ? "•".repeat(Math.min(raw.length, 12)) : "";
  }
  const local = raw.slice(0, atIndex);
  const domain = raw.slice(atIndex + 1);
  const visible = local.slice(0, 1);
  return `${visible}${"•".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

function readStoredEmail(): string {
  try {
    return sessionStorage.getItem(PENDING_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

export function VerifyEmailPage() {
  const { token } = useParams<{ token?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const stateEmail =
    (location.state as { email?: string; resendAvailableAt?: string | null } | null)?.email || "";
  const seededResendAt =
    (location.state as { resendAvailableAt?: string | null } | null)?.resendAvailableAt || null;

  const [email, setEmail] = useState<string>(() => stateEmail || readStoredEmail());
  const [status, setStatus] = useState<VerificationStatus>(token ? "verifying" : "waiting");
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [manualEmail, setManualEmail] = useState("");

  const attemptedTokenRef = useRef<string | null>(null);

  // Persist the address so a refresh on the waiting screen keeps the context.
  useEffect(() => {
    if (email) {
      try {
        sessionStorage.setItem(PENDING_EMAIL_KEY, email);
      } catch {
        /* storage unavailable: masking simply falls back to the typed value */
      }
    }
  }, [email]);

  // Consume the token exactly once per token value.
  useEffect(() => {
    if (!token) return;
    if (attemptedTokenRef.current === token) return;
    attemptedTokenRef.current = token;
    setStatus("verifying");

    let cancelled = false;
    void (async () => {
      try {
        const response = await api.post<VerifyEmailResponse>("/auth/verify-email", { token });
        if (cancelled) return;
        if (response.data.status === "verified") {
          setStatus("verified");
          try {
            sessionStorage.removeItem(PENDING_EMAIL_KEY);
          } catch {
            /* ignore */
          }
          return;
        }
        if (response.data.status === "already_verified") {
          setStatus("already_verified");
          return;
        }
        setStatus("invalid");
      } catch (error) {
        if (cancelled) return;
        const httpStatus = (error as { response?: { status?: number } })?.response?.status;
        const code = (error as { response?: { data?: VerifyEmailResponse } })?.response?.data?.code;
        if (httpStatus === 410 || code === "VERIFICATION_TOKEN_EXPIRED") {
          setStatus("expired");
          return;
        }
        setStatus("invalid");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Seed the resend cooldown from the login redirect, when provided.
  useEffect(() => {
    if (!seededResendAt) return;
    const remaining = Math.ceil((new Date(seededResendAt).getTime() - Date.now()) / 1000);
    if (remaining > 0) {
      setCooldown(remaining);
    }
  }, [seededResendAt]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => (value <= 1 ? 0 : value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(
    async (target: string) => {
      const normalized = target.trim().toLowerCase();
      if (!normalized) {
        setResendError("Enter the email address you registered with.");
        return;
      }
      setResending(true);
      setResendError(null);
      setResendNotice(null);
      try {
        const response = await api.post<ResendResponse>("/auth/resend-verification", {
          email: normalized
        });
        setEmail(normalized);
        setResendNotice(
          "If an account exists for that address, a fresh verification link is on its way. Check your inbox and spam folder."
        );
        const seconds =
          typeof response.data.cooldownSeconds === "number" && response.data.cooldownSeconds > 0
            ? response.data.cooldownSeconds
            : FALLBACK_COOLDOWN_SECONDS;
        setCooldown(seconds);
      } catch (error) {
        const httpStatus = (error as { response?: { status?: number } })?.response?.status;
        setResendError(
          httpStatus === 429
            ? "Too many requests. Please wait a moment before requesting another email."
            : "We couldn't send the email right now. Please try again in a moment."
        );
      } finally {
        setResending(false);
      }
    },
    []
  );

  const onSubmitResend = (event: FormEvent) => {
    event.preventDefault();
    const target = email || manualEmail;
    void handleResend(target);
  };

  const maskedEmail = useMemo(() => (email ? maskEmail(email) : ""), [email]);

  const { eyebrow, headline, support, title, description, body, footer } = useMemo(() => {
    switch (status) {
      case "verifying":
        return {
          eyebrow: "Account security",
          headline: (
            <>
              Confirming your <span className="text-gradient-gold">email address.</span>
            </>
          ),
          support: "We're validating your secure link. This only takes a moment.",
          title: "Verifying your email",
          description: "Please wait while we confirm the link.",
          body: (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#C6A15B]" aria-hidden="true" />
              <p className="text-[13px] text-[#9CA3AF]">Confirming your email address…</p>
            </div>
          ),
          footer: null
        };
      case "verified":
      case "already_verified":
        return {
          eyebrow: "Account security",
          headline: (
            <>
              You&apos;re in. <span className="text-gradient-gold">Email confirmed.</span>
            </>
          ),
          support:
            "Your email address is confirmed. Sign in to reach your NexaCrypto account and dashboard.",
          title: "Email verified successfully",
          description: "Your email address has been confirmed. You can now access your NexaCrypto account.",
          body: (
            <div className="space-y-4">
              <p className="auth-notice auth-notice-success flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                {status === "already_verified"
                  ? "This address was already confirmed. No further action is needed."
                  : "Your email address is confirmed."}
              </p>
              <button
                type="button"
                className="auth-submit"
                onClick={() => navigate("/login", { replace: true })}
              >
                Continue to NexaCrypto
              </button>
            </div>
          ),
          footer: (
            <p className="text-[11px] leading-relaxed text-[#6B7280]">
              Tip: your dashboard unlocks immediately after you sign in with your verified address.
            </p>
          )
        };
      case "expired":
        return {
          eyebrow: "Account security",
          headline: (
            <>
              That link has <span className="text-gradient-gold">expired.</span>
            </>
          ),
          support: "Verification links are short-lived for your security. Request a new one to continue.",
          title: "This verification link has expired.",
          description: "Request a new verification email and open the fresh link.",
          body: (
            <ResendBlock
              email={email}
              maskedEmail={maskedEmail}
              manualEmail={manualEmail}
              setManualEmail={setManualEmail}
              onSubmit={onSubmitResend}
              resending={resending}
              cooldown={cooldown}
              notice={resendNotice}
              error={resendError}
            />
          ),
          footer: <BackToLogin />
        };
      case "invalid":
        return {
          eyebrow: "Account security",
          headline: (
            <>
              This link is <span className="text-gradient-gold">no longer valid.</span>
            </>
          ),
          support:
            "The link may have already been used, or it may not match your account. You can request a new verification email.",
          title: "We couldn't verify this link",
          description:
            "Verification links are single-use. If you've already confirmed your address, simply sign in.",
          body: (
            <ResendBlock
              email={email}
              maskedEmail={maskedEmail}
              manualEmail={manualEmail}
              setManualEmail={setManualEmail}
              onSubmit={onSubmitResend}
              resending={resending}
              cooldown={cooldown}
              notice={resendNotice}
              error={resendError}
            />
          ),
          footer: <BackToLogin />
        };
      case "waiting":
      default:
        return {
          eyebrow: "Account security",
          headline: (
            <>
              One last step. <span className="text-gradient-gold">Verify your email.</span>
            </>
          ),
          support:
            "Your NexaCrypto account is almost ready. Confirm your email address to securely continue.",
          title: "Check your inbox",
          description:
            "We've sent a verification link to your email address. Open the link to verify your account and continue to NexaCrypto.",
          body: (
            <ResendBlock
              email={email}
              maskedEmail={maskedEmail}
              manualEmail={manualEmail}
              setManualEmail={setManualEmail}
              onSubmit={onSubmitResend}
              resending={resending}
              cooldown={cooldown}
              notice={resendNotice}
              error={resendError}
              emphasis
            />
          ),
          footer: <BackToLogin />
        };
    }
  }, [
    status,
    email,
    maskedEmail,
    manualEmail,
    onSubmitResend,
    resending,
    cooldown,
    resendNotice,
    resendError,
    navigate
  ]);

  return (
    <>
      <Seo
        title="Verify your email"
        description="Confirm your email address to activate your NexaCrypto account."
        path="/verify-email"
        robots="noindex,nofollow"
      />
      <AuthShell
        eyebrow={eyebrow}
        headline={headline}
        support={support}
        title={title}
        description={description}
        footer={footer}
      >
        {body}
      </AuthShell>
    </>
  );
}

function BackToLogin() {
  return (
    <p>
      Verified already?{" "}
      <Link to="/login" className="auth-link">
        Return to login
      </Link>
    </p>
  );
}

function ResendBlock({
  email,
  maskedEmail,
  manualEmail,
  setManualEmail,
  onSubmit,
  resending,
  cooldown,
  notice,
  error,
  emphasis = false
}: {
  email: string;
  maskedEmail: string;
  manualEmail: string;
  setManualEmail: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  resending: boolean;
  cooldown: number;
  notice: string | null;
  error: string | null;
  emphasis?: boolean;
}) {
  const hasEmail = email.trim().length > 0;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {emphasis && hasEmail ? (
        <div className="flex items-start gap-3 rounded-xl bg-[#101113] px-3 py-3">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#C6A15B]" aria-hidden="true" />
          <div className="text-[13px] leading-relaxed text-[#C9CCD3]">
            Sent to <span className="font-medium text-[#F5F5F7]">{maskedEmail}</span>
          </div>
        </div>
      ) : null}

      {!hasEmail ? (
        <div className="space-y-1.5">
          <label className="auth-label" htmlFor="verifyEmail">
            Your email address
          </label>
          <input
            id="verifyEmail"
            type="email"
            value={manualEmail}
            onChange={(event) => setManualEmail(event.target.value)}
            className="auth-input"
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
      ) : null}

      {notice ? (
        <p className="auth-notice auth-notice-success" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="auth-notice auth-notice-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="auth-submit" disabled={resending || cooldown > 0}>
        {resending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending…
          </span>
        ) : cooldown > 0 ? (
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" aria-hidden="true" /> Resend available in {cooldown}s
          </span>
        ) : (
          "Resend verification email"
        )}
      </button>

      {!hasEmail ? (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#6B7280]">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          Enter the address you registered with so we can send the link to the right inbox.
        </p>
      ) : null}
    </form>
  );
}
