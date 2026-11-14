import { FormEvent, useEffect, useMemo, useState } from "react";
import { CircleUser, Copy, Trash2 } from "lucide-react";
import {
  Divider,
  ListRow,
  Panel,
  Section,
  SectionHeader,
  Stat,
  StatStrip
} from "../components/dashboard/primitives";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import { logout } from "../store/authSlice";
import type { AppDispatch } from "../store";
import { LANGUAGE_OPTIONS, UI_LANGUAGE_STORAGE_KEY, useI18n } from "../i18n/I18nProvider";
import btcLogo from "../assets/crypto/btc.svg";
import ethLogo from "../assets/crypto/eth.svg";
import usdtLogo from "../assets/crypto/usdt.svg";
import solLogo from "../assets/crypto/sol.svg";

type WalletAsset = "BTC" | "ETH" | "USDT_ERC20" | "USDT_TRC20" | "SOL";
type LanguageCode = "en" | "es" | "fr" | "de" | "pt";

interface SettingsResponse {
  account: {
    user_id: string;
    email: string;
    level: number;
    status: string;
  };
  settings: {
    notifications: {
      deposit_updates: boolean;
      withdrawal_updates: boolean;
      rewards_bonuses: boolean;
      announcements: boolean;
      daily_performance: boolean;
      significant_moves: boolean;
      distributions: boolean;
      strategy_announcements: boolean;
    };
    preferences: {
      language: LanguageCode;
    };
    withdrawal_wallets: Array<{
      wallet_id: string;
      asset: WalletAsset;
      address: string;
      network: string | null;
    }>;
  };
}

interface ProgressionLevelResponse {
  level?: number;
  depositLevel?: number;
}

const ASSETS: Array<{ value: WalletAsset; label: string; icon: string }> = [
  { value: "BTC", label: "Bitcoin (BTC)", icon: btcLogo },
  { value: "ETH", label: "Ethereum (ETH)", icon: ethLogo },
  { value: "USDT_ERC20", label: "Tether (USDT ERC20)", icon: usdtLogo },
  { value: "USDT_TRC20", label: "Tether (USDT TRC20)", icon: usdtLogo },
  { value: "SOL", label: "Solana (SOL)", icon: solLogo }
];

const NOTIFICATION_ITEMS: Array<{
  key: keyof SettingsResponse["settings"]["notifications"];
  label: string;
}> = [
  { key: "deposit_updates", label: "Deposit updates" },
  { key: "withdrawal_updates", label: "Withdrawal updates" },
  { key: "rewards_bonuses", label: "Rewards / bonuses" },
  { key: "announcements", label: "Announcements" },
  { key: "daily_performance", label: "Verified daily performance" },
  { key: "significant_moves", label: "Significant verified moves" },
  { key: "distributions", label: "Completed distributions" },
  { key: "strategy_announcements", label: "Strategy announcements" }
];

export function SettingsPage() {
  const { setLanguage: setUiLanguage, t } = useI18n();
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<SettingsResponse["account"] | null>(null);
  const [wallets, setWallets] = useState<SettingsResponse["settings"]["withdrawal_wallets"]>([]);
  const [notifications, setNotifications] =
    useState<SettingsResponse["settings"]["notifications"]>({
      deposit_updates: true,
      withdrawal_updates: true,
      rewards_bonuses: true,
      announcements: true,
      daily_performance: false,
      significant_moves: false,
      distributions: false,
      strategy_announcements: false
    });
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [resolvedLevel, setResolvedLevel] = useState<number | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletAsset, setWalletAsset] = useState<WalletAsset>("BTC");
  const [walletAddress, setWalletAddress] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadSettings = async () => {
    try {
      const [settingsResponse, progressionResponse] = await Promise.all([
        api.get<SettingsResponse>("/user/settings"),
        api.get<ProgressionLevelResponse>("/user/current_xp_level").catch(() => null)
      ]);
      const response = settingsResponse;
      setAccount(response.data.account);
      setWallets(response.data.settings.withdrawal_wallets);
      setNotifications(response.data.settings.notifications);
      setLanguage(response.data.settings.preferences.language);
      setUiLanguage(response.data.settings.preferences.language);
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, response.data.settings.preferences.language);
      localStorage.setItem(
        "withdraw_wallets",
        JSON.stringify(response.data.settings.withdrawal_wallets)
      );

      const progressionData = progressionResponse?.data;
      const preferredLevelRaw =
        progressionData && Number.isFinite(progressionData.depositLevel)
          ? progressionData.depositLevel
          : progressionData && Number.isFinite(progressionData.level)
          ? progressionData.level
          : response.data.account.level;
      const preferredLevel = Math.max(0, Number(preferredLevelRaw));
      setResolvedLevel(preferredLevel);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!success && !error) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [success, error]);

  const passwordWeak =
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword) && newPassword.length > 0;
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canChangePassword =
    currentPassword.length >= 8 &&
    newPassword.length >= 8 &&
    !passwordWeak &&
    !passwordMismatch &&
    !submitting;

  const canSaveWallet = walletAddress.trim().length > 0 && !submitting;

  const statusText = useMemo(() => {
    if (!account) {
      return "Active";
    }
    const displayLevel = resolvedLevel ?? account.level;
    return `Level ${displayLevel} - ${account.status}`;
  }, [account, resolvedLevel]);

  const persistWallets = (nextWallets: SettingsResponse["settings"]["withdrawal_wallets"]) => {
    setWallets(nextWallets);
    localStorage.setItem("withdraw_wallets", JSON.stringify(nextWallets));
  };

  const submitPasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    if (!canChangePassword) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch("/user/settings/password", {
        currentPassword,
        newPassword
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully.");
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  const submitWallet = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSaveWallet) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.post<{ wallets: SettingsResponse["settings"]["withdrawal_wallets"] }>(
        "/user/settings/wallets",
        {
          asset: walletAsset,
          address: walletAddress.trim(),
          network: walletAsset.includes("USDT")
            ? walletAsset === "USDT_TRC20"
              ? "TRC20"
              : "ERC20"
            : null
        }
      );
      persistWallets(response.data.wallets);
      setWalletAddress("");
      setSuccess("Withdrawal wallet saved.");
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "Failed to save wallet");
    } finally {
      setSubmitting(false);
    }
  };

  const removeWallet = async (walletId: string) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await api.delete<{ wallets: SettingsResponse["settings"]["withdrawal_wallets"] }>(
        `/user/settings/wallets/${walletId}`
      );
      persistWallets(response.data.wallets);
      setSuccess("Wallet removed.");
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "Failed to remove wallet");
    } finally {
      setSubmitting(false);
    }
  };

  const updateNotification = async (
    key: keyof SettingsResponse["settings"]["notifications"],
    value: boolean
  ) => {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    try {
      await api.patch("/user/settings/notifications", next);
    } catch {
      setNotifications(notifications);
      setError("Failed to update notification settings");
    }
  };

  const updateLanguageValue = async (value: LanguageCode) => {
    setLanguage(value);
    try {
      await api.patch("/user/settings/preferences/language", { language: value });
      setUiLanguage(value);
      setSuccess(t("settings_language_updated"));
    } catch {
      setError("Failed to update language.");
    }
  };

  const deleteAccount = async () => {
    if (deletePassword.length < 8) {
      setError("Enter your password to confirm deletion.");
      return;
    }
    setSubmitting(true);
    try {
      await api.delete("/user/settings/account", {
        data: { password: deletePassword }
      });
      dispatch(logout());
      navigate("/landing", { replace: true });
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "Failed to delete account");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full rounded-xl bg-[#0F0F10] px-3 py-2.5 text-sm text-[#F5F5F7] placeholder:text-[#6B7280] outline-none ring-1 ring-inset ring-[#26272B] transition focus:ring-2 focus:ring-[#C6A15B]/60";

  if (loading) {
    return <div className="py-10 text-sm text-[#9CA3AF]">Loading settings...</div>;
  }

  return (
    <div className="page-responsive space-y-8 pb-12">
      <header className="min-w-0 space-y-2">
        <h1 className="display-font text-2xl font-semibold tracking-tight text-[#F5F5F7]">
          {t("settings_title")}
        </h1>
      </header>

      <Section className="space-y-3">
        <SectionHeader title={t("settings_account")} />
        <Panel className="space-y-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1F2023] ring-2 ring-[#C6A15B]">
              <CircleUser className="h-5 w-5 text-[#F5F5F7]" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#F5F5F7]">{statusText}</p>
              <p className="truncate text-xs text-[#9CA3AF]">Account details</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (account?.user_id) {
                  navigator.clipboard.writeText(account.user_id);
                  setSuccess("User ID copied.");
                }
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-[#C6A15B] transition-colors hover:bg-[#C6A15B]/10"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy ID
            </button>
          </div>
          <Divider />
          <StatStrip>
            <Stat label="Email" value={account?.email ?? "—"} />
            <Stat label="User ID" value={account?.user_id ?? "—"} />
            <Stat
              label="Level"
              value={account ? `Level ${resolvedLevel ?? account.level}` : "—"}
            />
          </StatStrip>
        </Panel>
      </Section>

      <Section className="space-y-3">
        <SectionHeader title={t("settings_security")} />
        <Panel>
          <form onSubmit={submitPasswordChange} className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Current password"
              className={fieldClass}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className={fieldClass}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              className={fieldClass}
            />
            {passwordWeak && (
              <p className="text-xs text-[#EA3943]">
                Password needs 8+ chars with uppercase, lowercase, and number.
              </p>
            )}
            {passwordMismatch && <p className="text-xs text-[#EA3943]">Passwords do not match.</p>}
            <button
              type="submit"
              disabled={!canChangePassword}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              {t("settings_change_password")}
            </button>
          </form>
        </Panel>
      </Section>

      <Section className="space-y-3">
        <SectionHeader title={t("settings_wallet")} />
        <Panel className="space-y-5">
          <form onSubmit={submitWallet} className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ASSETS.map((asset) => {
                const selected = walletAsset === asset.value;
                return (
                  <button
                    key={asset.value}
                    type="button"
                    onClick={() => setWalletAsset(asset.value)}
                    className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                      selected
                        ? "border-[#C6A15B] bg-[#1D1A12] text-[#F5F5F7]"
                        : "border-[#26272B] bg-[#0F0F10] text-[#D1D5DB] hover:border-[#3A3C43]"
                    }`}
                    aria-pressed={selected}
                  >
                    <img
                      src={asset.icon}
                      alt=""
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 object-contain"
                    />
                    <span className="min-w-0 flex-1 truncate">{asset.label}</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={walletAddress}
              onChange={(event) => setWalletAddress(event.target.value)}
              placeholder="Withdrawal wallet address"
              className={fieldClass}
            />
            <button
              type="submit"
              disabled={!canSaveWallet}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              {t("settings_save_address")}
            </button>
          </form>

          <div className="hairline-t space-y-1 pt-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">Saved wallets</p>
            {wallets.length === 0 ? (
              <p className="py-2 text-xs text-[#9CA3AF]">
                No withdrawal wallets saved yet.
              </p>
            ) : (
              wallets.map((wallet) => {
                const assetInfo = ASSETS.find((entry) => entry.value === wallet.asset);
                return (
                  <ListRow key={wallet.wallet_id}>
                    {assetInfo ? (
                      <img
                        src={assetInfo.icon}
                        alt=""
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 object-contain"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#F5F5F7]">{wallet.asset}</p>
                      <p className="break-all font-mono text-[11px] text-[#9CA3AF]">
                        {wallet.address}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWallet(wallet.wallet_id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#EA3943] transition-colors hover:bg-[#EA3943]/10"
                      aria-label={`Remove ${wallet.asset} wallet`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </ListRow>
                );
              })
            )}
          </div>
        </Panel>
      </Section>

      <Section className="space-y-3">
        <SectionHeader title={t("settings_notifications")} />
        <Panel>
          {NOTIFICATION_ITEMS.map((item) => (
            <label key={item.key} className="list-row justify-between">
              <span className="min-w-0 flex-1 text-sm text-[#F5F5F7]">{item.label}</span>
              <input
                type="checkbox"
                checked={notifications[item.key]}
                onChange={(event) => updateNotification(item.key, event.target.checked)}
                className="h-4 w-4 shrink-0 cursor-pointer accent-[#C6A15B]"
              />
            </label>
          ))}
        </Panel>
      </Section>

      <Section className="space-y-3">
        <SectionHeader title={t("settings_preferences")} />
        <Panel>
          <select
            value={language}
            onChange={(event) => updateLanguageValue(event.target.value as LanguageCode)}
            className={fieldClass}
          >
            {LANGUAGE_OPTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.flag} {entry.label}
              </option>
            ))}
          </select>
        </Panel>
      </Section>

      <Section className="space-y-3">
        <SectionHeader title={t("settings_support")} />
        <Panel>
          <a
            href="https://t.me"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-md"
          >
            {t("settings_contact_support")}
          </a>
        </Panel>
      </Section>

      <Section className="space-y-3 pt-2">
        <h2 className="display-font text-[15px] font-medium tracking-tight text-[#EA3943] sm:text-base">
          {t("settings_danger_zone")}
        </h2>
        <Panel className="space-y-3">
          <p className="text-xs leading-relaxed text-[#9CA3AF]">
            This action will permanently delete your account and cannot be undone.
          </p>
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            className="btn btn-md w-full bg-[#2A1316] text-[#EA3943] hover:bg-[#341519] sm:w-auto"
          >
            {t("settings_delete_account")}
          </button>
        </Panel>
      </Section>

      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-sm max-h-[calc(100dvh-2rem)] space-y-3 overflow-y-auto p-4 sm:p-5">
            <h3 className="display-font text-sm font-semibold text-[#F5F5F7]">
              Confirm account deletion
            </h3>
            <p className="text-xs leading-relaxed text-[#9CA3AF]">
              This action will permanently delete your account and cannot be undone.
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder="Enter password to confirm"
              className={fieldClass}
            />
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeletePassword("");
                }}
                className="btn btn-secondary btn-md w-full sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                className="btn btn-md w-full bg-[#2A1316] text-[#EA3943] hover:bg-[#341519] sm:w-auto"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-[#2A1316] px-3 py-2.5 text-xs text-[#FCA5A5]">{error}</div>
      )}
      {success && (
        <div className="rounded-xl bg-[#0D2018] px-3 py-2.5 text-xs text-[#A7F3D0]">{success}</div>
      )}
    </div>
  );
}
