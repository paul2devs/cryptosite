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
    <div className="auth-background flex min-h-screen w-full items-center justify-center py-10">
      <Seo
        title="Request password reset"
        description="Request a secure password reset link for your Crypto Levels custodial account to restore access to your deposits and rewards."
        path="/forgot-password"
        robots="noindex,nofollow"
      />
      <div className="w-full max-w-md px-4">
        <div className="auth-card w-full rounded-3xl border border-[#26272B] bg-[#17181A]/85 px-5 py-6 sm:px-7 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Reset access
            </h1>
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
                className="w-full rounded-2xl border border-slate-700/80 bg-[#262626] px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/70"
                autoComplete="email"
              />
            </div>
            {error && (
              <p className="text-xs text-red-300 bg-red-900/40 border border-red-900/80 rounded-2xl px-3 py-2">
                {error}
              </p>
            )}
            {submitted && !error && (
              <p className="text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-500/60 rounded-2xl px-3 py-2">
                If this email is registered, a reset link will arrive in the next few
                minutes. For security, we never confirm whether an email exists.
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-yellow-400 text-slate-950 text-sm font-semibold tracking-wide shadow-lg shadow-yellow-500/20 transition-transform transition-shadow duration-150 hover:-translate-y-0.5 hover:shadow-yellow-500/40 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
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
        </div>
      </div>
    </div>
  );
}

