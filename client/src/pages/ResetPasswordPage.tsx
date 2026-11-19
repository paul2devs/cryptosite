import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import { AuthShell } from "../components/auth/AuthShell";

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    <>
      <Seo
        title="Set new password"
        description="Securely set a new password for your NexaCrypto account using your one-time reset link."
        path="/reset-password"
        robots="noindex,nofollow"
      />
      <AuthShell
        eyebrow="Credential update"
        headline={
          <>
            Set a new password with <span className="text-gradient-gold">hardened protection.</span>
          </>
        }
        support="Your reset link is validated once and expires quickly. Choose a strong password to keep your account secure."
        title="Set a new password"
        description="Choose a strong password. You'll be returned to sign in once it's updated."
        footer={
          <p>
            Link expired?{" "}
            <Link to="/forgot-password" className="auth-link">
              Request a new reset
            </Link>
          </p>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label className="auth-label" htmlFor="password">
              New password
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
                placeholder="Enter a new password"
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
          <div className="space-y-1.5">
            <label className="auth-label" htmlFor="confirmPassword">
              Confirm new password
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
                placeholder="Re-enter your new password"
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
          {error && (
            <p className="auth-notice auth-notice-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="auth-notice auth-notice-success flex items-start gap-2" role="status">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Password updated. Redirecting you to secure login.</span>
            </p>
          )}
          <button type="submit" disabled={submitting || success} className="auth-submit mt-1">
            {submitting ? "Updating password..." : "Update password"}
          </button>
        </form>
      </AuthShell>
    </>
  );
}
