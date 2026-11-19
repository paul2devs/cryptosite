import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api } from "../utils/api";
import { Seo } from "../components/Seo";
import { AuthShell } from "../components/auth/AuthShell";

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
    <>
      <Seo
        title="Request password reset"
        description="Request a secure password reset link for your NexaCrypto account to restore access to your digital asset portfolio and account activity."
        path="/forgot-password"
        robots="noindex,nofollow"
      />
      <AuthShell
        eyebrow="Account recovery"
        headline={
          <>
            Restore access <span className="text-gradient-gold">without exposing your account.</span>
          </>
        }
        support="Recovery requests are privacy-preserving: we never confirm whether an email is registered, and reset links are single-use."
        title="Reset access"
        description="Enter the email linked to your account and we'll send a secure reset link if it matches."
        footer={
          <p>
            Remembered your password?{" "}
            <Link to="/login" className="auth-link">
              Back to login
            </Link>
          </p>
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
          {error && (
            <p className="auth-notice auth-notice-error" role="alert">
              {error}
            </p>
          )}
          {submitted && !error && (
            <p className="auth-notice auth-notice-success flex items-start gap-2" role="status">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                If this email is registered, a reset link will arrive in the next few
                minutes. For security, we never confirm whether an email exists.
              </span>
            </p>
          )}
          <button type="submit" disabled={submitting} className="auth-submit mt-1">
            {submitting ? "Sending link..." : "Send secure reset link"}
          </button>
        </form>
      </AuthShell>
    </>
  );
}
