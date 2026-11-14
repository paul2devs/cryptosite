import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { EmptyState, ErrorRow, LoadingRow, Panel, StatusBadge } from "../dashboard/primitives";
import { formatDateTime } from "../../utils/format";
import {
  deactivateBonusCampaign,
  deleteBonusCampaign,
  fetchBonusSummary,
  reconcileBonuses,
  saveBonusCampaign,
  type BonusAdminSummary,
  type BonusCampaignView,
  type BonusReconciliationResult
} from "../../utils/bonus";

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

function toList(value: string): string[] | null {
  const items = value
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);
  return items.length > 0 ? items : null;
}

interface CampaignFormState {
  campaignId: string;
  name: string;
  description: string;
  percentage: string;
  minDeposit: string;
  maxBonus: string;
  eligibleAssets: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  priority: string;
  minMembershipTierId: string;
  minInvestedAmount: string;
  newUsersOnly: boolean;
  requiredReferral: boolean;
  reason: string;
}

const EMPTY_FORM: CampaignFormState = {
  campaignId: "",
  name: "",
  description: "",
  percentage: "5",
  minDeposit: "0",
  maxBonus: "",
  eligibleAssets: "",
  startsAt: "",
  endsAt: "",
  active: true,
  priority: "0",
  minMembershipTierId: "",
  minInvestedAmount: "",
  newUsersOnly: false,
  requiredReferral: false,
  reason: ""
};

function formFromCampaign(campaign: BonusCampaignView): CampaignFormState {
  return {
    campaignId: campaign.campaignId,
    name: campaign.name,
    description: campaign.description,
    percentage: campaign.percentage,
    minDeposit: campaign.minDeposit,
    maxBonus: campaign.maxBonus ?? "",
    eligibleAssets: campaign.eligibleAssets ? campaign.eligibleAssets.join(", ") : "",
    startsAt: campaign.startsAt ? campaign.startsAt.slice(0, 10) : "",
    endsAt: campaign.endsAt ? campaign.endsAt.slice(0, 10) : "",
    active: campaign.active,
    priority: String(campaign.priority),
    minMembershipTierId: campaign.eligibility?.minMembershipTierId ?? "",
    minInvestedAmount: campaign.eligibility?.minInvestedAmount ?? "",
    newUsersOnly: Boolean(campaign.eligibility?.newUsersOnly),
    requiredReferral: Boolean(campaign.eligibility?.requiredReferral),
    reason: ""
  };
}

const inputClass =
  "w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none placeholder:text-[#6B7280] focus:border-[#C6A15B]/60";

export function AdminBonusPanel() {
  const [summary, setSummary] = useState<BonusAdminSummary | null>(null);
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
  const [reconciliation, setReconciliation] = useState<BonusReconciliationResult | null>(null);
  const [reconcileUser, setReconcileUser] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    setError(null);
    try {
      setSummary(await fetchBonusSummary());
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to load the bonus engine"));
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = (next: Partial<CampaignFormState>) => setForm((current) => ({ ...current, ...next }));

  const submitCampaign = async () => {
    if (form.reason.trim().length < 3) {
      setError("Enter a reason (at least 3 characters) to record this change in the audit log.");
      return;
    }
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      await saveBonusCampaign({
        campaignId: form.campaignId || undefined,
        name: form.name.trim(),
        description: form.description.trim(),
        percentage: form.percentage.trim(),
        minDeposit: form.minDeposit.trim(),
        maxBonus: form.maxBonus.trim() === "" ? null : form.maxBonus.trim(),
        eligibleAssets: toList(form.eligibleAssets),
        startsAt: form.startsAt ? form.startsAt : null,
        endsAt: form.endsAt ? form.endsAt : null,
        active: form.active,
        priority: Number(form.priority || 0),
        eligibility: {
          minMembershipTierId: form.minMembershipTierId.trim() || null,
          minInvestedAmount: form.minInvestedAmount.trim() || null,
          newUsersOnly: form.newUsersOnly,
          requiredReferral: form.requiredReferral
        },
        reason: form.reason.trim()
      });
      setNotice(form.campaignId ? "Campaign updated." : "Campaign created.");
      setForm(EMPTY_FORM);
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to save the campaign"));
    } finally {
      setBusy(null);
    }
  };

  const deactivate = async (campaign: BonusCampaignView) => {
    const reason = window.prompt(`Reason for deactivating "${campaign.name}"?`);
    if (!reason || reason.trim().length < 3) {
      setError("A reason (at least 3 characters) is required to deactivate a campaign.");
      return;
    }
    setBusy(campaign.campaignId);
    setError(null);
    try {
      await deactivateBonusCampaign(campaign.campaignId, reason.trim());
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to deactivate the campaign"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (campaign: BonusCampaignView) => {
    if (!window.confirm(`Delete campaign "${campaign.name}" permanently?`)) return;
    setBusy(campaign.campaignId);
    setError(null);
    try {
      await deleteBonusCampaign(campaign.campaignId);
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to delete the campaign"));
    } finally {
      setBusy(null);
    }
  };

  const runReconcile = async () => {
    setBusy("reconcile");
    setError(null);
    try {
      setReconciliation(await reconcileBonuses(reconcileUser.trim() || undefined));
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Bonus reconciliation failed"));
    } finally {
      setBusy(null);
    }
  };

  const totals = summary?.totals;

  return (
    <div className="space-y-4">
      {error ? <ErrorRow message={error} onRetry={load} /> : null}
      {notice ? <p className="text-[11px] text-[#16C784]">{notice}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">Promotional credits</p>
          </div>
          <p className="mt-3 financial-figure text-lg font-medium text-[#C6A15B]">
            {totals ? totals.totalCredited : "—"}
          </p>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">
            {totals ? `${totals.creditCount} verified bonus credit(s) recorded as promotional credits` : "Loading…"}
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-[#6B7280]">
            Bonuses post to the promotional_credits ledger account and are never counted as deposited
            principal or trading profit.
          </p>
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">Bonus reconciliation</p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
            Verifies every recorded credit against its promotional_credits ledger entry and flags eligible
            confirmed deposits that never received a bonus.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={reconcileUser}
              onChange={(event) => setReconcileUser(event.target.value)}
              placeholder="Optional user id (blank = all)"
              className={`${inputClass} sm:flex-1 sm:max-w-xs`}
            />
            <button
              type="button"
              onClick={runReconcile}
              disabled={busy !== null}
              className="btn btn-sm btn-secondary w-full sm:w-auto"
            >
              {busy === "reconcile" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Run reconciliation
            </button>
          </div>
          {reconciliation ? (
            <div className="mt-3 space-y-1 text-[11px] text-[#9CA3AF]">
              <p>
                Scope {reconciliation.scope} · credits {reconciliation.creditsChecked} · deposits{" "}
                {reconciliation.depositsChecked} · mismatched{" "}
                <span className={reconciliation.mismatched > 0 ? "text-[#EA3943]" : "text-[#16C784]"}>
                  {reconciliation.mismatched}
                </span>
              </p>
              {reconciliation.issues.length === 0 ? (
                <p className="text-[#16C784]">No inconsistencies detected.</p>
              ) : (
                <ul className="space-y-1">
                  {reconciliation.issues.map((issue, index) => (
                    <li key={`${issue.code}-${issue.reference}-${index}`} className="text-[11px] text-[#EA3943]">
                      <span className="font-mono">{issue.code}</span> · {issue.reference} — {issue.detail}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </Panel>

        <Panel>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">Active campaigns</p>
          </div>
          <p className="mt-3 financial-figure text-lg font-medium text-[#F5F5F7]">
            {summary ? summary.campaigns.filter((campaign) => campaign.active).length : "—"}
          </p>
          <p className="mt-1 text-[11px] text-[#9CA3AF]">
            {summary ? `${summary.campaigns.length} campaign(s) configured` : "Loading…"}
          </p>
          <button
            type="button"
            onClick={load}
            disabled={busy !== null}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-50"
          >
            {busy === "load" ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            )}
            Refresh
          </button>
        </Panel>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">
              {form.campaignId ? "Edit campaign" : "New campaign"}
            </p>
          </div>
          {form.campaignId ? (
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className="text-[11px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input value={form.name} onChange={(event) => patch({ name: event.target.value })} placeholder="Campaign name" className={inputClass} />
          <input value={form.percentage} onChange={(event) => patch({ percentage: event.target.value })} placeholder="Bonus percentage (e.g. 5)" className={inputClass} />
          <input value={form.minDeposit} onChange={(event) => patch({ minDeposit: event.target.value })} placeholder="Minimum qualifying deposit" className={inputClass} />
          <input value={form.maxBonus} onChange={(event) => patch({ maxBonus: event.target.value })} placeholder="Maximum bonus (blank = none)" className={inputClass} />
          <input value={form.eligibleAssets} onChange={(event) => patch({ eligibleAssets: event.target.value })} placeholder="Eligible assets (comma separated)" className={inputClass} />
          <input value={form.priority} onChange={(event) => patch({ priority: event.target.value })} placeholder="Priority (higher wins)" className={inputClass} />
          <input type="date" value={form.startsAt} onChange={(event) => patch({ startsAt: event.target.value })} className={inputClass} />
          <input type="date" value={form.endsAt} onChange={(event) => patch({ endsAt: event.target.value })} className={inputClass} />
          <input value={form.minMembershipTierId} onChange={(event) => patch({ minMembershipTierId: event.target.value })} placeholder="Minimum membership tier id (optional)" className={inputClass} />
          <input value={form.minInvestedAmount} onChange={(event) => patch({ minInvestedAmount: event.target.value })} placeholder="Minimum invested amount (optional)" className={inputClass} />
          <input value={form.reason} onChange={(event) => patch({ reason: event.target.value })} placeholder="Audit reason (required)" className={`${inputClass} md:col-span-2`} />
        </div>
        <textarea
          value={form.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="Campaign description shown to administrators"
          rows={2}
          className={`${inputClass} mt-2`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#9CA3AF]">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.active} onChange={(event) => patch({ active: event.target.checked })} />
            Active
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.newUsersOnly} onChange={(event) => patch({ newUsersOnly: event.target.checked })} />
            New users only (7 days)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.requiredReferral} onChange={(event) => patch({ requiredReferral: event.target.checked })} />
            Requires referral
          </label>
          <button
            type="button"
            onClick={submitCampaign}
            disabled={busy !== null}
            className="btn btn-sm btn-primary ml-auto w-full sm:w-auto"
          >
            {busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            {form.campaignId ? "Save changes" : "Create campaign"}
          </button>
        </div>
      </Panel>

      <Panel className="p-0">
        <div className="border-b border-[#26272B] px-4 py-3">
          <p className="text-xs font-medium text-[#F5F5F7]">Configured campaigns</p>
        </div>
        {!summary ? (
          <div className="px-4 py-2">
            <LoadingRow label="Loading campaigns…" />
          </div>
        ) : summary.campaigns.length === 0 ? (
          <div className="px-4 py-4">
            <EmptyState title="No campaigns configured" description="Create a campaign to start crediting promotional bonuses." />
          </div>
        ) : (
          <ul className="divide-y divide-[#26272B]/60">
            {summary.campaigns.map((campaign) => (
              <li key={campaign.campaignId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={campaign.active ? "positive" : "neutral"} label={campaign.active ? "Active" : "Inactive"} />
                    <span className="text-xs font-medium text-[#F5F5F7]">{campaign.name}</span>
                    <span className="financial-figure text-[11px] text-[#C6A15B]">{campaign.percentage}%</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">
                    Min {campaign.minDeposit} · Max {campaign.maxBonus ?? "none"} · Priority {campaign.priority} ·{" "}
                    {campaign.eligibleAssets ? campaign.eligibleAssets.join(", ") : "all assets"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#6B7280]">
                    {campaign.startsAt ? `Starts ${formatDateTime(campaign.startsAt)}` : "No start"} ·{" "}
                    {campaign.endsAt ? `Ends ${formatDateTime(campaign.endsAt)}` : "No end"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <button type="button" onClick={() => setForm(formFromCampaign(campaign))} className="btn btn-sm btn-ghost">
                    Edit
                  </button>
                  {campaign.active ? (
                    <button type="button" onClick={() => deactivate(campaign)} disabled={busy !== null} className="btn btn-sm btn-secondary">
                      Deactivate
                    </button>
                  ) : null}
                  <button type="button" onClick={() => remove(campaign)} disabled={busy !== null} className="btn btn-sm bg-[#EA3943]/12 text-[#EA3943] hover:bg-[#EA3943]/20">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-0">
        <div className="border-b border-[#26272B] px-4 py-3">
          <p className="text-xs font-medium text-[#F5F5F7]">Recent bonus credits</p>
        </div>
        {!summary ? (
          <div className="px-4 py-2">
            <LoadingRow label="Loading credits…" />
          </div>
        ) : summary.recentCredits.length === 0 ? (
          <div className="px-4 py-4">
            <EmptyState title="No bonus credits recorded yet" description="Credits appear here the moment an eligible deposit is independently verified and confirmed." />
          </div>
        ) : (
          <ul className="divide-y divide-[#26272B]/60">
            {summary.recentCredits.map((credit) => (
              <li key={credit.creditId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[#F5F5F7]">
                    {credit.bonusAmount} {credit.asset} · {credit.percentage}% · {credit.campaignName}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">{formatDateTime(credit.createdAt)}</span>
                </div>
                <p className="mt-1 break-words text-[10px] text-[#6B7280]">
                  Qualifying {credit.qualifyingAmount} · User {credit.userId} · Deposit {credit.depositId} · Ref {credit.reference}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
