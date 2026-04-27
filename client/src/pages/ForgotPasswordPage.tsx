import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-responsive borderless-ui auth-background flex min-h-screen w-full">
      <Seo
        title="Request password reset"
        description="Request a secure password reset link for your NexaCrypto custodial account to restore access to your deposits and rewards."
        path="/forgot-password"
        robots="noindex,nofollow"
      />
      <div className="flex min-h-screen w-full items-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <section className="hidden max-w-md space-y-5 lg:block">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Account Recovery</p>
            <h1 className="text-4xl font-semibold tracking-tight text-[#F5F5F7]">
              Restore secure access without exposing account status
            </h1>
            <p className="text-sm leading-6 text-[#A1A1AA]">
              Recovery requests are privacy-preserving and follow strict account protection controls.
            </p>
          </section>
          <section className="w-full max-w-2xl space-y-6">
          <div className="mb-6">
            <h2 className="text-3xl font-semibold text-white tracking-tight">
              Reset access
            </h2>
            <p className="mt-2 text-sm text-slate-200/80">
              Enter the email linked to your account and we&apos;ll send a secure reset
              link.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-200/80" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-[#2D2F35] bg-gradient-to-br from-[#0F1115] to-[#0B0C0F] px-3.5 py-3 text-sm text-slate-50 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30"
                autoComplete="email"
              />
            </div>
            {error && (
              <p className="text-xs text-red-300 bg-red-900/40 px-3 py-2">
                {error}
              </p>
            )}
            {submitted && !error && (
              <p className="text-xs text-emerald-300 bg-emerald-900/20 px-3 py-2">
                If this email is registered, a reset link will arrive in the next few
                minutes. For security, we never confirm whether an email exists.
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-yellow-400 text-slate-950 text-sm font-semibold tracking-wide transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Sending link..." : "Send secure reset link"}
            </button>
          </form>
          <div className="mt-5 flex flex-col gap-3 text-center">
            <p className="text-xs text-slate-300/90">
              Remembered your password?{" "}
              <Link
                to="/login"
                className="font-medium text-yellow-300 hover:text-yellow-200 transition-colors"
              >
                Back to login
              </Link>
            </p>
            <p className="text-[0.7rem] text-slate-400/80">
              For account security, reset links expire after a short window and can only
              be used once.
            </p>
          </div>
          </section>
        </div>
      </div>
    </div>
  );
}

