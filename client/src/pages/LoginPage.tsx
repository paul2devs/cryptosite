import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store";
import { AppDispatch } from "../store";
import { loginUser } from "../store/authSlice";
import { Eye, EyeOff } from "lucide-react";
import { Seo } from "../components/Seo";
import { AuthShell } from "../components/auth/AuthShell";

export function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const result = await dispatch(loginUser({ email: email.trim().toLowerCase(), password }));
    if (loginUser.fulfilled.match(result)) {
      navigate("/");
    }
  };

  return (
    <>
      <Seo
        title="Secure login"
        description="Log in to NexaCrypto to manage your custodial crypto deposits, track XP, levels and multipliers, and request secure withdrawals."
        path="/login"
        robots="noindex,nofollow"
      />
      <AuthShell
        eyebrow="Account access"
        headline={
          <>
            Your portfolio, <span className="text-gradient-gold">behind one secure door.</span>
          </>
        }
        support="Sign in to manage deposits, follow your membership progression and review every verified transaction in one account."
        title="Sign in"
        description="Use the email and password linked to your NexaCrypto account."
        footer={
          <>
            <p>
              Don&apos;t have an account?{" "}
              <Link to="/register" className="auth-link">
                Create one
              </Link>
            </p>
            <p className="text-[11px] leading-relaxed text-[#6B7280]">
              Sessions use short-lived tokens with rotating refresh, and passwords are
              stored as salted hashes.
            </p>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label className="auth-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <label className="auth-label" htmlFor="password">
                Password
              </label>
              <Link to="/forgot-password" className="auth-link text-[11px]">
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
                className="auth-input pr-11"
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && (
            <p className="auth-notice auth-notice-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={loading} className="auth-submit mt-1">
            {loading ? "Signing in..." : "Log in securely"}
          </button>
        </form>
      </AuthShell>
    </>
  );
}
