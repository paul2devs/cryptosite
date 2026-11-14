import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, RotateCcw, Save, Settings2 } from "lucide-react";
import { EmptyState, ErrorRow, LoadingRow, Panel } from "../dashboard/primitives";
import { formatDateTime } from "../../utils/format";
import {
  fetchPlatformFinancialSettings,
  resetPlatformSettings,
  savePlatformSetting,
  type BonusSettings,
  type NotificationTemplates,
  type PerformanceSettings,
  type PlatformSettingsResponse,
  type ReconciliationSettings
} from "../../utils/bonus";

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

const inputClass =
  "w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none placeholder:text-[#6B7280] focus:border-[#C6A15B]/60";
const labelClass = "text-[10px] uppercase tracking-[0.14em] text-[#6B7280]";

const TEMPLATE_FIELDS: Array<{ key: keyof NotificationTemplates; label: string }> = [
  { key: "depositConfirmation", label: "Deposit confirmation" },
  { key: "promotionalBonusCredited", label: "Promotional bonus credited" },
  { key: "investmentAllocation", label: "Investment allocation" },
  { key: "verifiedTradingActivity", label: "Verified trading activity" },
  { key: "dailyPerformance", label: "Daily performance" },
  { key: "profitRealised", label: "Profit / loss realised" },
  { key: "withdrawalProcessing", label: "Withdrawal processing" },
  { key: "withdrawalCompleted", label: "Withdrawal completed" },
  { key: "rewardGranted", label: "Reward granted" },
  { key: "rewardRedeemed", label: "Reward redeemed" }
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function AdminFinancialSettingsPanel() {
  const [response, setResponse] = useState<PlatformSettingsResponse | null>(null);
  const [bonus, setBonus] = useState<BonusSettings | null>(null);
  const [performance, setPerformance] = useState<PerformanceSettings | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationSettings | null>(null);
  const [templates, setTemplates] = useState<NotificationTemplates | null>(null);
  const [assetsInput, setAssetsInput] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback((next: PlatformSettingsResponse) => {
    setResponse(next);
    setBonus(next.settings.bonus);
    setPerformance(next.settings.performance);
    setReconciliation(next.settings.reconciliation);
    setTemplates(next.settings.notifications);
    setAssetsInput(next.settings.bonus.eligibleAssets ? next.settings.bonus.eligibleAssets.join(", ") : "");
  }, []);

  const load = useCallback(async () => {
    setBusy("load");
    setError(null);
    try {
      apply(await fetchPlatformFinancialSettings());
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to load financial settings"));
    } finally {
      setBusy(null);
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const requireReason = (): string | null => {
    if (reason.trim().length < 3) {
      setError("Enter an audit reason (at least 3 characters) before saving.");
      return null;
    }
    return reason.trim();
  };

  const persist = async (
    tag: string,
    category: "bonus" | "performance" | "reconciliation" | "notifications",
    key: string,
    value: unknown,
    description: string
  ) => {
    const auditReason = requireReason();
    if (!auditReason) return;
    setBusy(tag);
    setError(null);
    setNotice(null);
    try {
      await savePlatformSetting(category, key, value, auditReason, description);
      setNotice(`${category} settings saved.`);
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to save settings"));
    } finally {
      setBusy(null);
    }
  };

  const saveBonus = () => {
    if (!bonus) return;
    const eligibleAssets =
      assetsInput
        .split(",")
        .map((entry) => entry.trim().toUpperCase())
        .filter((entry) => entry.length > 0) || [];
    void persist(
      "bonus",
      "bonus",
      "defaults",
      {
        active: bonus.active,
        percentage: bonus.percentage,
        minDeposit: bonus.minDeposit,
        maxBonus: bonus.maxBonus && bonus.maxBonus.trim() !== "" ? bonus.maxBonus : null,
        eligibleAssets: eligibleAssets.length > 0 ? eligibleAssets : null,
        campaignDescription: bonus.campaignDescription
      },
      "Default promotional bonus configuration."
    );
  };

  const savePerformance = () => {
    if (!performance) return;
    void persist("performance", "performance", "settings", performance, "Daily investment performance engine configuration.");
  };

  const saveReconciliation = () => {
    if (!reconciliation) return;
    void persist(
      "reconciliation",
      "reconciliation",
      "settings",
      reconciliation,
      "Financial reconciliation configuration."
    );
  };

  const saveTemplates = () => {
    if (!templates) return;
    void persist("notifications", "notifications", "templates", templates, "Notification message templates for financial events.");
  };

  const reset = async () => {
    const auditReason = requireReason();
    if (!auditReason) return;
    if (!window.confirm("Reset all financial settings to platform defaults?")) return;
    setBusy("reset");
    setError(null);
    try {
      apply({ settings: await resetPlatformSettings(auditReason), entries: response?.entries ?? [] });
      setNotice("Financial settings reset to defaults.");
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to reset settings"));
    } finally {
      setBusy(null);
    }
  };

  if (!bonus || !performance || !reconciliation || !templates) {
    return (
      <div className="space-y-4">
        {error ? <ErrorRow message={error} onRetry={load} /> : null}
        <Panel>{busy ? <LoadingRow label="Loading financial settings…" /> : <EmptyState title="No settings loaded" description="Reload the platform configuration to continue." />}</Panel>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorRow message={error} onRetry={load} /> : null}
      {notice ? <p className="text-[11px] text-[#16C784]">{notice}</p> : null}

      <Panel>
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
          <p className="text-xs font-medium text-[#F5F5F7]">Audit reason</p>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
          Every financial configuration change is written to the immutable admin audit log with the acting
          administrator, reason, and timestamp.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for the change (required)" className={`${inputClass} min-w-0 sm:flex-1`} />
          <button
            type="button"
            onClick={reset}
            disabled={busy !== null}
            className="btn btn-sm btn-secondary w-full sm:w-auto"
          >
            {busy === "reset" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3 w-3" aria-hidden="true" />}
            Reset to defaults
          </button>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <p className="text-xs font-medium text-[#F5F5F7]">Promotional bonus defaults</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
            Used when no campaign is configured. Campaigns always take precedence over these defaults.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="Bonus percentage">
              <input value={bonus.percentage} onChange={(event) => setBonus({ ...bonus, percentage: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Minimum deposit">
              <input value={bonus.minDeposit} onChange={(event) => setBonus({ ...bonus, minDeposit: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Maximum bonus (blank = none)">
              <input value={bonus.maxBonus ?? ""} onChange={(event) => setBonus({ ...bonus, maxBonus: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Eligible assets (comma separated)">
              <input value={assetsInput} onChange={(event) => setAssetsInput(event.target.value)} placeholder="BTC, ETH, USDT" className={inputClass} />
            </Field>
          </div>
          <div className="mt-2">
            <Field label="Campaign description">
              <textarea value={bonus.campaignDescription} onChange={(event) => setBonus({ ...bonus, campaignDescription: event.target.value })} rows={2} className={inputClass} />
            </Field>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-[11px] text-[#9CA3AF]">
            <input type="checkbox" checked={bonus.active} onChange={(event) => setBonus({ ...bonus, active: event.target.checked })} />
            Bonus engine active by default
          </label>
          <button
            type="button"
            onClick={saveBonus}
            disabled={busy !== null}
            className="btn btn-sm btn-primary mt-3"
          >
            {busy === "bonus" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Save className="h-3 w-3" aria-hidden="true" />}
            Save bonus defaults
          </button>
        </Panel>

        <Panel>
          <p className="text-xs font-medium text-[#F5F5F7]">Daily performance engine</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
            Controls the scheduled daily calculation. The illustrative daily rate is displayed to users as a
            projection only — it is never credited and is not a guaranteed return.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Field label="Illustrative daily rate %">
              <input value={performance.illustrativeDailyRatePercent} onChange={(event) => setPerformance({ ...performance, illustrativeDailyRatePercent: event.target.value })} className={inputClass} />
            </Field>
            <Field label="Require verified valuation">
              <label className="inline-flex items-center gap-2 py-1.5 text-[11px] text-[#9CA3AF]">
                <input type="checkbox" checked={performance.requireVerifiedValuation} onChange={(event) => setPerformance({ ...performance, requireVerifiedValuation: event.target.checked })} />
                Only verified valuations produce performance
              </label>
            </Field>
          </div>
          <div className="mt-2">
            <Field label="Illustrative disclaimer">
              <textarea value={performance.illustrativeDisclaimer} onChange={(event) => setPerformance({ ...performance, illustrativeDisclaimer: event.target.value })} rows={3} className={inputClass} />
            </Field>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-[11px] text-[#9CA3AF]">
            <input type="checkbox" checked={performance.automaticDailyCalculation} onChange={(event) => setPerformance({ ...performance, automaticDailyCalculation: event.target.checked })} />
            Run the daily performance cycle automatically
          </label>
          <button
            type="button"
            onClick={savePerformance}
            disabled={busy !== null}
            className="btn btn-sm btn-primary mt-3"
          >
            {busy === "performance" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Save className="h-3 w-3" aria-hidden="true" />}
            Save performance settings
          </button>
        </Panel>

        <Panel>
          <p className="text-xs font-medium text-[#F5F5F7]">Reconciliation</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
            Controls the scheduled daily bonus and performance reconciliation against the authoritative ledger.
          </p>
          <div className="mt-3 space-y-2">
            <label className="inline-flex items-center gap-2 text-[11px] text-[#9CA3AF]">
              <input type="checkbox" checked={reconciliation.reconcileBonusesDaily} onChange={(event) => setReconciliation({ ...reconciliation, reconcileBonusesDaily: event.target.checked })} />
              Reconcile bonuses daily
            </label>
            <label className="inline-flex items-center gap-2 text-[11px] text-[#9CA3AF]">
              <input type="checkbox" checked={reconciliation.reconcilePerformanceDaily} onChange={(event) => setReconciliation({ ...reconciliation, reconcilePerformanceDaily: event.target.checked })} />
              Reconcile performance daily
            </label>
            <Field label="Tolerance amount">
              <input value={reconciliation.toleranceAmount} onChange={(event) => setReconciliation({ ...reconciliation, toleranceAmount: event.target.value })} className={inputClass} />
            </Field>
          </div>
          <button
            type="button"
            onClick={saveReconciliation}
            disabled={busy !== null}
            className="btn btn-sm btn-primary mt-3"
          >
            {busy === "reconciliation" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Save className="h-3 w-3" aria-hidden="true" />}
            Save reconciliation settings
          </button>
        </Panel>

        <Panel>
          <p className="text-xs font-medium text-[#F5F5F7]">Notification templates</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
            Placeholders: {"{amount}"} {"{asset}"} {"{reference}"} {"{campaign}"} {"{position}"} {"{date}"} {"{detail}"} {"{source}"}.
          </p>
          <div className="mt-3 space-y-2">
            {TEMPLATE_FIELDS.map((field) => (
              <Field key={field.key} label={field.label}>
                <textarea
                  value={templates[field.key]}
                  onChange={(event) => setTemplates({ ...templates, [field.key]: event.target.value })}
                  rows={2}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
          <button
            type="button"
            onClick={saveTemplates}
            disabled={busy !== null}
            className="btn btn-sm btn-primary mt-3"
          >
            {busy === "notifications" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Save className="h-3 w-3" aria-hidden="true" />}
            Save notification templates
          </button>
        </Panel>
      </div>

      <Panel className="p-0">
        <div className="border-b border-[#26272B] px-4 py-3">
          <p className="text-xs font-medium text-[#F5F5F7]">Configuration history</p>
        </div>
        {response && response.entries.length > 0 ? (
          <ul className="divide-y divide-[#26272B]/60">
            {response.entries.map((entry) => (
              <li key={entry.settingId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[#F5F5F7]">
                    {entry.category} · {entry.key}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    {entry.updatedBy ? `${entry.updatedBy} · ` : ""}
                    {formatDateTime(entry.updatedAt)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-[#6B7280]">{entry.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-4">
            <EmptyState title="No configuration history yet" />
          </div>
        )}
      </Panel>
    </div>
  );
}
