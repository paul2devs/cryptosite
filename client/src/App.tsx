import { Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "./store";
import { fetchMe, loadStoredTokens } from "./store/authSlice";
import { AppDispatch } from "./store";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
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
const LeaderboardPage = lazy(() =>
  import("./pages/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage }))
);
const ReferralPage = lazy(() =>
  import("./pages/ReferralPage").then((m) => ({ default: m.ReferralPage }))
);
const AdminAnalyticsPage = lazy(() =>
  import("./pages/AdminAnalyticsPage").then((m) => ({
    default: m.AdminAnalyticsPage
  }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  if (!user || !accessToken) {
    return <Navigate to="/landing" replace />;
  }
  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const user = useSelector((state: RootState) => state.auth.user);
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  if (!user || !accessToken || !user.is_admin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(loadStoredTokens());
    const stored = localStorage.getItem("authTokens");
    if (stored) {
      dispatch(fetchMe());
    }
  }, [dispatch]);

  useEffect(() => {
    const savedLanguage = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (savedLanguage) {
      document.documentElement.lang = savedLanguage;
    }
  }, []);

  useEffect(() => {
    primeLiveMarketCache();
  }, []);

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

