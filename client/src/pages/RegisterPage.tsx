import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store";
import { AppDispatch } from "../store";
import { registerUser } from "../store/authSlice";
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Seo } from "../components/Seo";

export function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const initialRef = useMemo(() => searchParams.get("ref") || "", [searchParams]);
  const [referralCode, setReferralCode] = useState(initialRef);
  const [localError, setLocalError] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isEmailValid =
    email.length === 0 ||
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email.trim());

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isEmailValid) {
      setLocalError("Please enter a valid email address.");
      return;
    }
    if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
      setLocalError(
        "Password must be at least 8 characters and include an uppercase letter, a number, and a special character."
      );
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords must match exactly.");
      return;
    }
    setLocalError(null);
    const result = await dispatch(
      registerUser({
        name,
        email,
        password,
        walletAddress,
        referralCode: referralCode.trim() ? referralCode.trim() : undefined
      })
    );
    if (registerUser.fulfilled.match(result)) {
      navigate("/");
    }
  };

  const effectiveError = localError || error || null;

  return (
    <div className="auth-background flex min-h-screen w-full items-center justify-center">
      <Seo
        title="Create account"
        description="Open a Crypto Levels account to start depositing BTC, ETH, SOL and stablecoins into a custodial wallet that unlocks level-based multipliers and rewards."
        path="/register"
        robots="index,follow"
      />
        <div className="w-full max-w-md px-4 py-10">
        <div className="auth-card w-full rounded-3xl bg-[#17181A]/80 px-5 py-6 sm:px-7 sm:py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Create Your Account
            </h1>
            <p className="mt-2 text-sm text-slate-200/80">
              Start your journey to disciplined crypto investing with level-based rewards.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-200/80" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-2xl border border-slate-700/80 bg-[#262626] px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/70"
                autoComplete="name"
              />
            </div>
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
                className={`w-full rounded-2xl border px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:ring-2 ${
                  isEmailValid
                    ? "border-slate-700/80 bg-[#262626] focus:border-yellow-400 focus:ring-yellow-400/70"
                    : "border-red-500/70 bg-[#2b1b1b] focus:border-red-400 focus:ring-red-400/70"
                }`}
                autoComplete="email"
              />
              {!isEmailValid && (
                <p className="text-[0.7rem] text-red-300 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Please provide a valid email address.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-200/80" htmlFor="wallet">
                Primary wallet address
              </label>
              <input
                id="wallet"
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                required
                className="w-full rounded-2xl border border-slate-700/80 bg-[#262626] px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/70 font-mono tracking-tight"
                autoComplete="off"
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
                <div className="inline-flex items-center gap-1.5 text-[0.7rem] text-emerald-300/90">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-300/60 bg-emerald-400/10">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-3 w-3 text-emerald-300"
                    >
                      <path
                        fill="currentColor"
                        d="M12 2C7.03 2 3 6.03 3 11c0 5.25 4.42 9.74 8.46 10.93.36.11.72.11 1.08 0C16.58 20.74 21 16.25 21 11 21 6.03 16.97 2 12 2zm0 3c1.38 0 2.5 1.12 2.5 2.5S13.38 10 12 10s-2.5-1.12-2.5-2.5S10.62 5 12 5zm0 14.2c-2.14-.64-4.5-2.84-4.5-5.2 0-1.66 1.34-3 3-3h3c1.66 0 3 1.34 3 3 0 2.36-2.36 4.56-4.5 5.2z"
                      />
                    </svg>
                  </span>
                  <span>Your password is securely encrypted</span>
                </div>
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
                  autoComplete="new-password"
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
              <div className="mt-2 space-y-1.5 rounded-2xl bg-[#0F172A]/40 px-3 py-3">
                <p className="text-[0.7rem] font-medium text-slate-200/90">
                  Password must contain:
                </p>
                <ul className="space-y-1 text-[0.7rem]">
                  <PasswordRequirement met={hasMinLength} label="At least 8 characters" />
                  <PasswordRequirement met={hasUppercase} label="One uppercase letter" />
                  <PasswordRequirement met={hasNumber} label="One number" />
                  <PasswordRequirement met={hasSpecial} label="One special character" />
                </ul>
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-slate-200/80"
                htmlFor="confirmPassword"
              >
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-2xl border border-slate-700/80 bg-[#262626] px-3.5 py-2.5 pr-11 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/70"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-300/80 hover:text-slate-100 transition"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                className="text-xs font-medium text-slate-200/80"
                htmlFor="referralCode"
              >
                Referral code (optional)
              </label>
              <input
                id="referralCode"
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full rounded-2xl border border-slate-700/80 bg-[#262626] px-3.5 py-2.5 text-sm text-slate-50 shadow-inner outline-none ring-0 transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/70"
                autoComplete="off"
              />
              <p className="text-[0.7rem] text-slate-400/90">
                If a friend invited you, enter their code to unlock a welcome boost on
                your early deposits.
              </p>
            </div>
            {effectiveError && (
              <p className="text-xs text-red-300 bg-red-900/40 border border-red-900/80 rounded-2xl px-3 py-2">
                {effectiveError}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-12 w-full items-center justify-center rounded-full bg-yellow-400 text-slate-950 text-sm font-semibold tracking-wide shadow-lg shadow-yellow-500/20 transition-transform transition-shadow duration-150 hover:-translate-y-0.5 hover:shadow-yellow-500/40 active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
          <div className="mt-5 flex flex-col gap-3 text-center">
            <p className="text-xs text-slate-300/90">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-yellow-300 hover:text-yellow-200 transition-colors"
              >
                Log in
              </Link>
            </p>
            <p className="text-[0.7rem] text-slate-400/80">
              By registering, you agree to our{" "}
              <Link
                to="/terms"
                className="text-yellow-300 hover:text-yellow-200 underline-offset-2 hover:underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                className="text-yellow-300 hover:text-yellow-200 underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PasswordRequirementProps {
  met: boolean;
  label: string;
}

function PasswordRequirement({ met, label }: PasswordRequirementProps) {
  return (
    <li className="flex items-center gap-2">
      {met ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <div className="h-3.5 w-3.5 rounded-full border border-slate-500" />
      )}
      <span className={met ? "text-emerald-200" : "text-slate-300/80"}>{label}</span>
    </li>
  );
}
