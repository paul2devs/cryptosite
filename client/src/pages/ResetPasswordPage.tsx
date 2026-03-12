import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Reset link is invalid or has expired.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords must match exactly.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 1800);
    } catch {
      setError("Reset link is invalid, expired, or has already been used.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-background flex items-center justify-center py-10">
      <Seo
        title="Set new password"
        description="Securely set a new password for your Crypto Levels account using your one-time reset link."
        path="/reset-password"
        robots="noindex,nofollow"
      />
      <div className="w-full max-w-md px-4">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full border border-yellow-400/70 bg-yellow-400/10 flex items-center justify-center">
            <span className="text-xs font-semibold text-yellow-300 tracking-wide">
              CL
            </span>
          </div>
        </div>
        <div className="auth-card w-full rounded-3xl bg-[#333333]/90 border border-slate-800/80 shadow-elevated-card px-5 py-6 sm:px-7 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Set a new password
            </h1>
            <p className="mt-2 text-sm text-slate-200/80">
              Choose a strong password to keep your custodial balance secure.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-slate-200/80"
                htmlFor="password"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-2xl border border-slate-700/80 bg-[#262626] px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/70"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-slate-200/80"
                htmlFor="confirmPassword"
              >
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-2xl border border-slate-700/80 bg-[#262626] px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/70"
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p className="text-xs text-red-300 bg-red-900/40 border border-red-900/80 rounded-2xl px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-500/60 rounded-2xl px-3 py-2">
                Password updated. Redirecting you to secure login.
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-yellow-400 text-slate-950 text-sm font-semibold tracking-wide shadow-lg shadow-yellow-500/20 transition-transform transition-shadow duration-150 hover:-translate-y-0.5 hover:shadow-yellow-500/40 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Updating password..." : "Update password"}
            </button>
          </form>
          <div className="mt-5 flex flex-col gap-3 text-center">
            <p className="text-xs text-slate-300/90">
              Wrong email or link?{" "}
              <Link
                to="/forgot-password"
                className="font-medium text-yellow-300 hover:text-yellow-200 transition-colors"
              >
                Request a new reset
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

