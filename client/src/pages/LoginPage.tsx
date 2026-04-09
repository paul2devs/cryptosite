import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store";
import { AppDispatch } from "../store";
import { loginUser } from "../store/authSlice";
import { Eye, EyeOff } from "lucide-react";
import { Seo } from "../components/Seo";

export function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await dispatch(loginUser({ email, password }));
    if (loginUser.fulfilled.match(result)) {
      navigate("/");
    }
  };

  return (
    <div className="page-responsive borderless-ui auth-background flex min-h-screen w-full">
      <Seo
        title="Secure login"
        description="Log in to Crypto Levels to manage your custodial crypto deposits, track XP, levels and multipliers, and request secure withdrawals."
        path="/login"
        robots="noindex,nofollow"
      />
      <div className="flex min-h-screen w-full items-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <section className="hidden max-w-md space-y-5 lg:block">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Crypto Levels</p>
            <h1 className="text-4xl font-semibold tracking-tight text-[#F5F5F7]">
              Secure account access built for serious portfolios
            </h1>
            <p className="text-sm leading-6 text-[#A1A1AA]">
              Continue with encrypted session authentication, protected deposit controls, and real-time reward tracking.
            </p>
          </section>
          <section className="w-full max-w-2xl space-y-6">
            <div className="mb-6">
              <h2 className="text-3xl font-semibold tracking-tight text-white">Sign in</h2>
              <p className="mt-2 text-sm text-slate-200/80">
                Log in to your account and continue managing your deposits.
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className="text-xs font-medium text-slate-200/80"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-emerald-300 hover:text-emerald-200 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-[#2D2F35] bg-gradient-to-br from-[#0F1115] to-[#0B0C0F] px-3.5 py-3 pr-11 text-sm text-slate-50 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-300/80 hover:text-slate-100 transition"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              {error && (
                <p className="text-xs text-red-300 bg-red-900/40 px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-yellow-400 text-slate-950 text-sm font-semibold tracking-wide transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Signing in..." : "Log in securely"}
              </button>
            </form>
            <div className="mt-5 flex flex-col gap-3 text-center">
              <p className="text-xs text-slate-300/90">
                Don&apos;t have an account?{" "}
                <Link
                  to="/register"
                  className="font-medium text-yellow-300 hover:text-yellow-200 transition-colors"
                >
                  Register
                </Link>
              </p>
              <p className="text-[0.7rem] text-slate-400/80">
                Secure platform — blockchain-verified deposits &amp; withdrawals. All
                sessions are protected with encrypted transport.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

