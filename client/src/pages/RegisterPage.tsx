import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store";
import { AppDispatch } from "../store";
import { registerUser } from "../store/authSlice";
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { Seo } from "../components/Seo";
import { AuthShell } from "../components/auth/AuthShell";

export function RegisterPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setLocalError("Please enter your full name.");
      return;
    }
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
        name: trimmedName,
        email: normalizedEmail,
        password,
        referralCode: referralCode.trim() ? referralCode.trim() : undefined
      })
    );
    if (registerUser.fulfilled.match(result)) {
      navigate("/");
    }
  };

  const effectiveError = localError || error || null;

  return (
    <>
      <Seo
        title="Create account"
        description="Open a NexaCrypto account to start depositing BTC, ETH, SOL and stablecoins into a custodial wallet with transparent membership progression and rewards."
        path="/register"
        robots="index,follow"
      />
      <AuthShell
        eyebrow="Create your account"
        headline={
          <>
            Start with a deposit you can <span className="text-gradient-gold">verify on-chain.</span>
          </>
        }
        support="Open an account to deposit supported assets, watch your membership progression and manage every transaction from one dashboard."
        title="Create your account"
        description="It takes a moment. Your membership tier follows the USD value of your confirmed deposits."
        footer={
          <p className="text-[11px] leading-relaxed text-[#6B7280]">
            By registering you agree to our{" "}
            <Link to="/terms" className="auth-link">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="auth-link">
              Privacy Policy
            </Link>
            .
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label className="auth-label" htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="auth-input"
              autoComplete="name"
              placeholder="Your full name"
            />
          </div>
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
              aria-invalid={!isEmailValid}
              className="auth-input"
              autoComplete="email"
              placeholder="you@example.com"
            />
            {!isEmailValid && (
              <p className="flex items-center gap-1 text-[11px] text-[#EA3943]">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                Please provide a valid email address.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="auth-label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="auth-input pr-11"
                autoComplete="new-password"
                placeholder="Create a strong password"
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
            <ul className="mt-2 space-y-1.5 rounded-xl bg-[#101113] px-3 py-3">
              <PasswordRequirement met={hasMinLength} label="At least 8 characters" />
              <PasswordRequirement met={hasUppercase} label="One uppercase letter" />
              <PasswordRequirement met={hasNumber} label="One number" />
              <PasswordRequirement met={hasSpecial} label="One special character" />
            </ul>
          </div>
          <div className="space-y-1.5">
            <label className="auth-label" htmlFor="confirmPassword">
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
                className="auth-input pr-11"
                autoComplete="new-password"
                placeholder="Re-enter your password"
              />
              <button
                type="button"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="auth-label" htmlFor="referralCode">
              Referral code <span className="text-[#6B7280]">(optional)</span>
            </label>
            <input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              className="auth-input"
              autoComplete="off"
              placeholder="e.g. NX-4821"
            />
            <p className="text-[11px] leading-relaxed text-[#6B7280]">
              If a friend invited you, enter their code to unlock a welcome boost on your
              early deposits.
            </p>
          </div>
          {effectiveError && (
            <p className="auth-notice auth-notice-error" role="alert">
              {effectiveError}
            </p>
          )}
          <button type="submit" disabled={loading} className="auth-submit mt-1">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </AuthShell>
    </>
  );
}

interface PasswordRequirementProps {
  met: boolean;
  label: string;
}

function PasswordRequirement({ met, label }: PasswordRequirementProps) {
  return (
    <li className="flex items-center gap-2 text-[11px]">
      {met ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#16C784]" aria-hidden="true" />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#3F4148]" aria-hidden="true" />
      )}
      <span className={met ? "text-[#9be7c6]" : "text-[#9CA3AF]"}>{label}</span>
    </li>
  );
}
