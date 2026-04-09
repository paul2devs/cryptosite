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
    <div className="page-responsive borderless-ui auth-background flex min-h-screen w-full">
      <Seo
        title="Set new password"
        description="Securely set a new password for your Crypto Levels account using your one-time reset link."
        path="/reset-password"
        robots="noindex,nofollow"
      />
      <div className="flex min-h-screen w-full items-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <section className="hidden max-w-md space-y-5 lg:block">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Credential Update</p>
            <h1 className="text-4xl font-semibold tracking-tight text-[#F5F5F7]">
              Set a new password with hardened account protection
            </h1>
            <p className="text-sm leading-6 text-[#A1A1AA]">
              One-time reset token validation and password policy checks protect account integrity.
            </p>
          </section>
          <section className="w-full max-w-2xl space-y-6">
            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center border border-yellow-400/70 bg-yellow-400/10">
                <span className="text-xs font-semibold tracking-wide text-yellow-300">
                  CL
                </span>
              </div>
            </div>
            <div className="w-full bg-[#17181A]/85 px-5 py-6 sm:px-7 sm:py-8 md:px-8 md:py-10">
              <div className="mb-6">
                <h2 className="text-3xl font-semibold tracking-tight text-white">
                  Set a new password
                </h2>
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
                    className="w-full rounded-xl border border-[#2D2F35] bg-gradient-to-br from-[#0F1115] to-[#0B0C0F] px-3.5 py-3 text-sm text-slate-50 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30"
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
                    className="w-full rounded-xl border border-[#2D2F35] bg-gradient-to-br from-[#0F1115] to-[#0B0C0F] px-3.5 py-3 text-sm text-slate-50 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30"
                    autoComplete="new-password"
                  />
                </div>
                {error && (
                  <p className="bg-red-900/40 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300">
                    Password updated. Redirecting you to secure login.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-yellow-400 text-sm font-semibold tracking-wide text-slate-950 transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Updating password..." : "Update password"}
                </button>
              </form>
              <div className="mt-5 flex flex-col gap-3 text-center">
                <p className="text-xs text-slate-300/90">
                  Wrong email or link?{" "}
                  <Link
                    to="/forgot-password"
                    className="font-medium text-yellow-300 transition-colors hover:text-yellow-200"
                  >
                    Request a new reset
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

