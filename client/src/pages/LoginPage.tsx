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
    <div className="auth-background flex min-h-screen w-full items-center justify-center">
      <Seo
        title="Secure login"
        description="Log in to Crypto Levels to manage your custodial crypto deposits, track XP, levels and multipliers, and request secure withdrawals."
        path="/login"
        robots="noindex,nofollow"
      />
      <div className="w-full max-w-md px-4 py-10">
        <div className="auth-card w-full rounded-3xl bg-[#17181A]/80 px-5 py-6 sm:px-7 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Welcome Back
            </h1>
            <p className="mt-2 text-sm text-slate-200/80">
              Log in to your account and start your crypto journey.
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
                  className="w-full rounded-2xl border border-slate-700/80 bg-[#262626] px-3.5 py-2.5 pr-11 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/70"
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
              <p className="text-xs text-red-300 bg-red-900/40 border border-red-900/80 rounded-2xl px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-yellow-400 text-slate-950 text-sm font-semibold tracking-wide shadow-lg shadow-yellow-500/20 transition-transform transition-shadow duration-150 hover:-translate-y-0.5 hover:shadow-yellow-500/40 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
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
        </div>
      </div>
    </div>
  );
}

