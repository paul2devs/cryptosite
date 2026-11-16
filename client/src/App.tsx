import { Suspense, useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "./store";
import { logout, restoreSession, setAccessToken } from "./store/authSlice";
import { AppDispatch } from "./store";
import {
  EMAIL_NOT_VERIFIED_EVENT,
  SESSION_EXPIRED_EVENT,
  TOKEN_REFRESHED_EVENT
} from "./utils/api";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { CookiesPage } from "./pages/CookiesPage";
import { LandingPage } from "./pages/LandingPage";
import { Layout } from "./components/Layout";
import { BalanceVisibilityProvider } from "./components/BalanceVisibilityProvider";
import { lazy } from "react";
import { primeLiveMarketCache } from "./hooks/useLiveMarket";
import { I18nProvider, UI_LANGUAGE_STORAGE_KEY } from "./i18n/I18nProvider";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const DepositPage = lazy(() =>
  import("./pages/DepositPage").then((m) => ({ default: m.DepositPage }))
);
const WithdrawPage = lazy(() =>
  import("./pages/WithdrawPage").then((m) => ({ default: m.WithdrawPage }))
);
const AdminPanelPage = lazy(() =>
  import("./pages/AdminPanelPage").then((m) => ({ default: m.AdminPanelPage }))
);
const PortfolioPage = lazy(() =>
  import("./pages/PortfolioPage").then((m) => ({ default: m.PortfolioPage }))
);
const MembershipPage = lazy(() =>
  import("./pages/MembershipPage").then((m) => ({ default: m.MembershipPage }))
);
const InvestmentLevelsPage = lazy(() =>
  import("./pages/InvestmentLevelsPage").then((m) => ({ default: m.InvestmentLevelsPage }))
);
const LeaderboardPage = lazy(() =>
  import("./pages/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage }))
);
const ReferralPage = lazy(() =>
  import("./pages/ReferralPage").then((m) => ({ default: m.ReferralPage }))
);
const RewardsPage = lazy(() =>
  import("./pages/RewardsPage").then((m) => ({ default: m.RewardsPage }))
);
const AdminOperationsPage = lazy(() =>
  import("./pages/AdminOperationsPage").then((m) => ({ default: m.AdminOperationsPage }))
);
const AdminAnalyticsPage = lazy(() =>
  import("./pages/AdminAnalyticsPage").then((m) => ({
    default: m.AdminAnalyticsPage
  }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);
const TransactionsPage = lazy(() =>
  import("./pages/TransactionsPage").then((m) => ({
    default: m.TransactionsPage
  }))
);
const PerformancePage = lazy(() =>
  import("./pages/PerformancePage").then((m) => ({
    default: m.PerformancePage
  }))
);

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const initialized = useSelector((state: RootState) => state.auth.initialized);
  const sessionUnreachable = useSelector(
    (state: RootState) => state.auth.sessionUnreachable
  );

  // Never redirect while the stored session is still being restored.
  if (!initialized) {
    return <SessionRestorePlaceholder />;
  }
  // The API was unreachable during the session check. The stored session may
  // still be valid, so offer a retry instead of treating the user as logged out.
  if (!user && sessionUnreachable) {
    return <SessionUnreachable />;
  }
  if (!user || !accessToken) {
    return <Navigate to="/landing" replace />;
  }
  // A stored session can outlive an account whose verification was revoked.
  // The server refuses every protected call in that case; mirror it here so the
  // user lands on the verification screen instead of a broken dashboard.
  if (user.email_verified === false && !user.is_admin) {
    return <Navigate to="/verify-email" replace />;
  }
  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const initialized = useSelector((state: RootState) => state.auth.initialized);
  const sessionUnreachable = useSelector(
    (state: RootState) => state.auth.sessionUnreachable
  );

  if (!initialized) {
    return <SessionRestorePlaceholder />;
  }
  if (!user && sessionUnreachable) {
    return <SessionUnreachable />;
  }
  if (!user || !accessToken || !user.is_admin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function SessionUnreachable() {
  const dispatch = useDispatch<AppDispatch>();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-sm text-[#F5F5F7]">
        We couldn&apos;t reach NexaCrypto to verify your session.
      </p>
      <p className="max-w-sm text-xs text-[#9CA3AF]">
        Your session is still saved. This is usually temporary. Check your connection
        and try again.
      </p>
      <button
        type="button"
        onClick={() => void dispatch(restoreSession({ force: true }))}
        className="btn btn-md btn-primary"
      >
        Retry
      </button>
    </div>
  );
}

function SessionRestorePlaceholder() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-[#9CA3AF]">
      Restoring your session…
    </div>
  );
}

function AuthBootSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F0F10] text-[#F5F5F7]">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo.svg"
          alt="NexaCrypto"
          className="h-11 w-11 rounded-full object-cover"
        />
        <div className="h-1 w-28 overflow-hidden rounded-full bg-[#26272B]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#C6A15B]" />
        </div>
        <p className="text-xs text-[#9CA3AF]">Restoring your session…</p>
      </div>
    </div>
  );
}

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const initialized = useSelector((state: RootState) => state.auth.initialized);
  const userEmail = useSelector((state: RootState) => state.auth.user?.email ?? null);
  // Read inside the event listener without re-registering it on every render.
  const userEmailRef = useRef<string | null>(null);

  useEffect(() => {
    userEmailRef.current = userEmail;
  }, [userEmail]);

  useEffect(() => {
    void dispatch(restoreSession());
  }, [dispatch]);

  useEffect(() => {
    const handleSessionExpired = () => {
      dispatch(logout());
      navigate("/login", { replace: true });
    };
    const handleTokenRefreshed = (event: Event) => {
      const token = (event as CustomEvent<{ accessToken?: string }>).detail?.accessToken;
      if (typeof token === "string" && token.length > 0) {
        dispatch(setAccessToken(token));
      }
    };
    // A protected API call rejected the request because the account's email is
    // not verified. The session is unusable, so it is dropped and the user is
    // sent to the verification screen to request a fresh link.
    const handleEmailNotVerified = () => {
      dispatch(logout());
      navigate("/verify-email", {
        replace: true,
        state: { email: userEmailRef.current || "" }
      });
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener(TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, handleEmailNotVerified);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener(TOKEN_REFRESHED_EVENT, handleTokenRefreshed);
      window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, handleEmailNotVerified);
    };
  }, [dispatch, navigate]);

  useEffect(() => {
    const savedLanguage = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (savedLanguage) {
      document.documentElement.lang = savedLanguage;
    }
  }, []);

  useEffect(() => {
    primeLiveMarketCache();
  }, []);

  // Hold the whole shell until we know whether a session exists, so neither the
  // public landing page nor a protected dashboard renders prematurely.
  if (!initialized) {
    return <AuthBootSplash />;
  }

  return (
    <I18nProvider>
      <BalanceVisibilityProvider>
        <Layout>
          <ScrollToTopOnRouteChange />
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-10 text-sm text-slate-400">
                Loading experience...
              </div>
            }
          >
            <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deposit"
            element={
              <ProtectedRoute>
                <DepositPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/withdraw"
            element={
              <ProtectedRoute>
                <WithdrawPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio"
            element={
              <ProtectedRoute>
                <PortfolioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/membership"
            element={
              <ProtectedRoute>
                <MembershipPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investment-levels"
            element={
              <ProtectedRoute>
                <InvestmentLevelsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <ProtectedRoute>
                <RewardsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/performance"
            element={
              <ProtectedRoute>
                <PerformancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <TransactionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/leaderboards"
            element={
              <ProtectedRoute>
                <LeaderboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPanelPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/operations"
            element={
              <AdminRoute>
                <AdminOperationsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <AdminRoute>
                <AdminAnalyticsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/referrals"
            element={
              <ProtectedRoute>
                <ReferralPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </BalanceVisibilityProvider>
    </I18nProvider>
  );
}

function ScrollToTopOnRouteChange() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname, location.hash]);

  return null;
}

export default App;

