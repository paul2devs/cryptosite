import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Plus, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { api } from "../../utils/api";
import { EmptyState, ErrorRow, LoadingRow, Panel, Stat, StatStrip, StatusBadge } from "../dashboard/primitives";
import { formatDateTime } from "../../utils/format";
import {
  REWARD_CATEGORIES,
  REWARD_CATEGORY_LABEL,
  deactivateRewardCatalog,
  deleteRewardCatalog,
  fetchAdminRewardGrants,
  fetchRewardAdminSummary,
  grantRewardToUser,
  revokeUserRewardGrant,
  saveRewardCatalog,
  type AdminRewardGrantPage,
  type RewardAdminSummary,
  type RewardCatalogEntry,
  type RewardCategory,
  type RewardRequirementType
} from "../../utils/rewards";

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

const inputClass =
  "w-full rounded-xl border border-[#26272B] bg-[#0F0F10] px-3 py-1.5 text-xs text-[#F5F5F7] outline-none placeholder:text-[#6B7280] focus:border-[#C6A15B]/60";

const REQUIREMENT_OPTIONS: Array<{ value: RewardRequirementType; label: string }> = [
  { value: "manual", label: "Manual — issued by an administrator" },
  { value: "deposit_total", label: "Confirmed verified deposits" },
  { value: "invest_total", label: "Verified invested principal" },
  { value: "membership_tier", label: "Membership tier" },
  { value: "referral_count", label: "Referred accounts" }
];

interface CatalogFormState {
  rewardId: string;
  name: string;
  description: string;
  category: RewardCategory;
  amount: string;
  asset: string;
  requirementType: RewardRequirementType;
  requirementAmount: string;
  requirementCount: string;
  requirementTierId: string;
  maxRedemptions: string;
  active: boolean;
  priority: string;
  expiresAt: string;
  reason: string;
}

const EMPTY_CATALOG_FORM: CatalogFormState = {
  rewardId: "",
  name: "",
  description: "",
  category: "loyalty",
  amount: "10",
  asset: "USDT",
  requirementType: "deposit_total",
  requirementAmount: "500",
  requirementCount: "",
  requirementTierId: "",
  maxRedemptions: "",
  active: true,
  priority: "0",
  expiresAt: "",
  reason: ""
};

interface GrantFormState {
  userId: string;
  rewardId: string;
  name: string;
  category: RewardCategory;
  amount: string;
  asset: string;
  expiresAt: string;
  reason: string;
}

const EMPTY_GRANT_FORM: GrantFormState = {
  userId: "",
  rewardId: "",
  name: "",
  category: "special",
  amount: "",
  asset: "USDT",
  expiresAt: "",
  reason: ""
};

function catalogFormFromEntry(entry: RewardCatalogEntry): CatalogFormState {
  return {
    rewardId: entry.rewardId,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    amount: entry.amount,
    asset: entry.asset,
    requirementType: entry.requirementType,
    requirementAmount: entry.requirementAmount,
    requirementCount: entry.requirementCount ? String(entry.requirementCount) : "",
    requirementTierId: entry.requirementTierId ?? "",
    maxRedemptions: entry.maxRedemptions ? String(entry.maxRedemptions) : "",
    active: entry.active,
    priority: String(entry.priority),
    expiresAt: entry.expiresAt ? entry.expiresAt.slice(0, 10) : "",
    reason: ""
  };
}

export function AdminRewardsPanel() {
  const [summary, setSummary] = useState<RewardAdminSummary | null>(null);
  const [grants, setGrants] = useState<AdminRewardGrantPage | null>(null);
  const [grantsPage, setGrantsPage] = useState(1);
  const [tiers, setTiers] = useState<Array<{ tierId: string; name: string }>>([]);
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>(EMPTY_CATALOG_FORM);
  const [grantForm, setGrantForm] = useState<GrantFormState>(EMPTY_GRANT_FORM);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    setError(null);
    try {
      setSummary(await fetchRewardAdminSummary());
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to load the reward engine"));
    } finally {
      setBusy(null);
    }
  }, []);

  const loadGrants = useCallback(async (page: number) => {
    try {
      setGrants(await fetchAdminRewardGrants({ page, pageSize: 20 }));
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to load reward grants"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadGrants(grantsPage);
  }, [grantsPage, loadGrants]);

  useEffect(() => {
    let active = true;
    api
      .get<{ distribution: Array<{ tierId: string; name: string }> }>("/operations/admin/memberships")
      .then((response) => {
        if (active) {
          setTiers(response.data.distribution.map((tier) => ({ tierId: tier.tierId, name: tier.name })));
        }
      })
      .catch(() => {
        if (active) setTiers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const patchCatalog = (next: Partial<CatalogFormState>) =>
    setCatalogForm((current) => ({ ...current, ...next }));
  const patchGrant = (next: Partial<GrantFormState>) =>
    setGrantForm((current) => ({ ...current, ...next }));

  const submitCatalog = async () => {
    if (catalogForm.reason.trim().length < 3) {
      setError("Enter a reason (at least 3 characters) to record this change in the audit log.");
      return;
    }
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      await saveRewardCatalog({
        rewardId: catalogForm.rewardId || undefined,
        name: catalogForm.name.trim(),
        description: catalogForm.description.trim(),
        category: catalogForm.category,
        amount: catalogForm.amount.trim(),
        asset: catalogForm.asset.trim(),
        requirementType: catalogForm.requirementType,
        requirementAmount: catalogForm.requirementAmount.trim() || null,
        requirementCount:
          catalogForm.requirementCount.trim() === "" ? null : Number(catalogForm.requirementCount),
        requirementTierId:
          catalogForm.requirementType === "membership_tier"
            ? catalogForm.requirementTierId || null
            : null,
        maxRedemptions:
          catalogForm.maxRedemptions.trim() === "" ? null : Number(catalogForm.maxRedemptions),
        active: catalogForm.active,
        priority: Number(catalogForm.priority || 0),
        expiresAt: catalogForm.expiresAt || null,
        reason: catalogForm.reason.trim()
      });
      setNotice(catalogForm.rewardId ? "Reward updated." : "Reward created.");
      setCatalogForm(EMPTY_CATALOG_FORM);
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to save the reward"));
    } finally {
      setBusy(null);
    }
  };

  const deactivate = async (entry: RewardCatalogEntry) => {
    const reason = window.prompt(`Reason for deactivating "${entry.name}"?`);
    if (!reason || reason.trim().length < 3) {
      setError("A reason (at least 3 characters) is required to deactivate a reward.");
      return;
    }
    setBusy(entry.rewardId);
    setError(null);
    try {
      await deactivateRewardCatalog(entry.rewardId, reason.trim());
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to deactivate the reward"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (entry: RewardCatalogEntry) => {
    const reason = window.prompt(`Reason for deleting "${entry.name}"?`);
    if (!reason || reason.trim().length < 3) {
      setError("A reason (at least 3 characters) is required to delete a reward.");
      return;
    }
    if (!window.confirm(`Delete reward "${entry.name}" permanently?`)) return;
    setBusy(entry.rewardId);
    setError(null);
    try {
      await deleteRewardCatalog(entry.rewardId, reason.trim());
      await load();
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to delete the reward"));
    } finally {
      setBusy(null);
    }
  };

  const submitGrant = async () => {
    if (grantForm.userId.trim() === "") {
      setError("Enter the user id to grant a reward to.");
      return;
    }
    if (grantForm.reason.trim().length < 3) {
      setError("Enter a reason (at least 3 characters) to record this grant in the audit log.");
      return;
    }
    if (!grantForm.rewardId && grantForm.amount.trim() === "") {
      setError("Select a catalogue reward, or enter an explicit amount for a manual reward.");
      return;
    }
    setBusy("grant");
    setError(null);
    setNotice(null);
    try {
      await grantRewardToUser({
        userId: grantForm.userId.trim(),
        rewardId: grantForm.rewardId || null,
        name: grantForm.rewardId ? null : grantForm.name.trim() || null,
        category: grantForm.rewardId ? null : grantForm.category,
        amount: grantForm.amount.trim() || null,
        asset: grantForm.asset.trim() || null,
        expiresAt: grantForm.expiresAt || null,
        reason: grantForm.reason.trim()
      });
      setNotice("Reward granted and posted to the promotional_credits ledger.");
      setGrantForm(EMPTY_GRANT_FORM);
      await load();
      await loadGrants(grantsPage);
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to grant the reward"));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (userRewardId: string, name: string) => {
    const reason = window.prompt(`Reason for revoking "${name}"?`);
    if (!reason || reason.trim().length < 3) {
      setError("A reason (at least 3 characters) is required to revoke a reward.");
      return;
    }
    setBusy(userRewardId);
    setError(null);
    try {
      await revokeUserRewardGrant(userRewardId, reason.trim());
      await load();
      await loadGrants(grantsPage);
    } catch (requestError) {
      setError(extractMessage(requestError, "Failed to revoke the reward"));
    } finally {
      setBusy(null);
    }
  };

  const totals = summary?.totals;
  const totalGrantPages = grants ? Math.max(1, Math.ceil(grants.total / grants.pageSize)) : 1;

  return (
    <div className="space-y-4">
      {error ? <ErrorRow message={error} onRetry={() => void load()} /> : null}
      {notice ? <p className="text-[11px] text-[#16C784]">{notice}</p> : null}

      <Panel className="min-w-0">
        <StatStrip>
          <Stat label="Catalog" value={summary ? String(summary.catalogCount) : "—"} />
          <Stat label="Active" value={summary ? String(summary.activeCount) : "—"} tone="positive" />
          <Stat label="Recipients" value={summary ? String(summary.userCount) : "—"} />
          <Stat label="Grants" value={summary ? String(summary.grantCount) : "—"} />
          <Stat label="Redemptions" value={summary ? String(summary.redemptionCount) : "—"} />
        </StatStrip>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["granted", "available", "pending", "redeemed"] as const).map((key) => (
          <Panel key={key} className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">
              {key === "granted"
                ? "Total granted"
                : key === "available"
                  ? "Available"
                  : key === "pending"
                    ? "Pending"
                    : "Redeemed"}
            </p>
            <p className="financial-figure mt-1 text-base font-medium text-[#F5F5F7]">
              {totals ? totals[key] : "—"}
            </p>
          </Panel>
        ))}
      </div>

      {summary && summary.byCategory.length > 0 ? (
        <Panel className="space-y-3">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">By category</p>
          </div>
          <div className="space-y-0.5">
            {summary.byCategory.map((category) => (
              <div key={category.id} className="list-row justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#F5F5F7]">{category.label}</p>
                  <p className="text-[10px] text-[#6B7280]">{category.grantedCount} grant(s)</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="financial-figure text-xs text-[#C6A15B]">{category.grantedTotal}</p>
                  <p className="text-[10px] text-[#6B7280]">Redeemed {category.redeemedTotal}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {summary && summary.campaignPerformance.length > 0 ? (
        <Panel className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">Campaign performance</p>
          </div>
          <div className="space-y-0.5">
            {summary.campaignPerformance.map((campaign) => (
              <div key={campaign.rewardId} className="list-row flex-col items-stretch gap-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={campaign.active ? "positive" : "neutral"}
                      label={campaign.active ? "Active" : "Inactive"}
                    />
                    <span className="text-xs font-medium text-[#F5F5F7]">{campaign.name}</span>
                    <span className="text-[10px] text-[#6B7280]">{campaign.categoryLabel}</span>
                  </div>
                  <span className="financial-figure text-xs text-[#C6A15B]">
                    {campaign.grantedTotal}
                  </span>
                </div>
                <p className="text-[10px] text-[#6B7280]">
                  {campaign.grantedCount} granted · {campaign.redeemedCount} redeemed ·{" "}
                  {campaign.redeemedTotal} redeemed value
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#F5F5F7]">
              {catalogForm.rewardId ? "Edit reward" : "New reward"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {catalogForm.rewardId ? (
              <button
                type="button"
                onClick={() => setCatalogForm(EMPTY_CATALOG_FORM)}
                className="text-[11px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
              >
                Cancel edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 text-[11px] text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-50"
            >
              {busy === "load" ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              )}
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input value={catalogForm.name} onChange={(event) => patchCatalog({ name: event.target.value })} placeholder="Reward name" className={inputClass} />
          <select
            value={catalogForm.category}
            onChange={(event) => patchCatalog({ category: event.target.value as RewardCategory })}
            className={inputClass}
          >
            {REWARD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {REWARD_CATEGORY_LABEL[category]}
              </option>
            ))}
          </select>
          <input value={catalogForm.amount} onChange={(event) => patchCatalog({ amount: event.target.value })} placeholder="Reward amount (e.g. 25)" className={inputClass} />
          <input value={catalogForm.asset} onChange={(event) => patchCatalog({ asset: event.target.value })} placeholder="Asset (USDT)" className={inputClass} />
          <select
            value={catalogForm.requirementType}
            onChange={(event) =>
              patchCatalog({ requirementType: event.target.value as RewardRequirementType })
            }
            className={inputClass}
          >
            {REQUIREMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {(catalogForm.requirementType === "deposit_total" ||
            catalogForm.requirementType === "invest_total") && (
            <input
              value={catalogForm.requirementAmount}
              onChange={(event) => patchCatalog({ requirementAmount: event.target.value })}
              placeholder="Required amount (e.g. 500)"
              className={inputClass}
            />
          )}
          {catalogForm.requirementType === "referral_count" ? (
            <input
              value={catalogForm.requirementCount}
              onChange={(event) => patchCatalog({ requirementCount: event.target.value })}
              placeholder="Required referred accounts"
              className={inputClass}
            />
          ) : null}
          {catalogForm.requirementType === "membership_tier" ? (
            <select
              value={catalogForm.requirementTierId}
              onChange={(event) => patchCatalog({ requirementTierId: event.target.value })}
              className={inputClass}
            >
              <option value="">Select required tier</option>
              {tiers.map((tier) => (
                <option key={tier.tierId} value={tier.tierId}>
                  {tier.name}
                </option>
              ))}
            </select>
          ) : null}
          <input value={catalogForm.maxRedemptions} onChange={(event) => patchCatalog({ maxRedemptions: event.target.value })} placeholder="Max grants (blank = unlimited)" className={inputClass} />
          <input value={catalogForm.priority} onChange={(event) => patchCatalog({ priority: event.target.value })} placeholder="Priority (higher shows first)" className={inputClass} />
          <input type="date" value={catalogForm.expiresAt} onChange={(event) => patchCatalog({ expiresAt: event.target.value })} className={inputClass} />
          <input value={catalogForm.reason} onChange={(event) => patchCatalog({ reason: event.target.value })} placeholder="Audit reason (required)" className={`${inputClass} md:col-span-2`} />
        </div>
        <textarea
          value={catalogForm.description}
          onChange={(event) => patchCatalog({ description: event.target.value })}
          placeholder="Reward description shown to users"
          rows={2}
          className={`${inputClass} mt-2`}
        />
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#9CA3AF]">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={catalogForm.active} onChange={(event) => patchCatalog({ active: event.target.checked })} />
            Active
          </label>
          <button
            type="button"
            onClick={submitCatalog}
            disabled={busy !== null}
            className="btn btn-sm btn-primary ml-auto w-full sm:w-auto"
          >
            {busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            {catalogForm.rewardId ? "Save changes" : "Create reward"}
          </button>
        </div>
      </Panel>

      <Panel className="p-0">
        <div className="border-b border-[#26272B] px-4 py-3">
          <p className="text-xs font-medium text-[#F5F5F7]">Reward catalogue</p>
        </div>
        {!summary ? (
          <div className="px-4 py-2">
            <LoadingRow label="Loading rewards…" />
          </div>
        ) : summary.catalog.length === 0 ? (
          <div className="px-4 py-4">
            <EmptyState
              title="No rewards published"
              description="Create a reward so users can start earning and redeeming it."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[#26272B]/60">
            {summary.catalog.map((entry) => (
              <li key={entry.rewardId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={entry.active ? "positive" : "neutral"} label={entry.active ? "Active" : "Inactive"} />
                    <span className="text-xs font-medium text-[#F5F5F7]">{entry.name}</span>
                    <span className="financial-figure text-[11px] text-[#C6A15B]">
                      {entry.amount} {entry.asset}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">
                    {entry.categoryLabel} · {entry.requirementLabel} · priority {entry.priority}
                    {entry.maxRedemptions ? ` · max ${entry.maxRedemptions}` : ""}
                    {entry.requirementTierName ? ` · ${entry.requirementTierName}` : ""}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#6B7280]">
                    {entry.expiresAt ? `Expires ${formatDateTime(entry.expiresAt)}` : "No expiry"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <button type="button" onClick={() => setCatalogForm(catalogFormFromEntry(entry))} className="btn btn-sm btn-ghost">
                    Edit
                  </button>
                  {entry.active ? (
                    <button type="button" onClick={() => void deactivate(entry)} disabled={busy !== null} className="btn btn-sm btn-secondary">
                      Deactivate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void remove(entry)}
                    disabled={busy !== null}
                    className="btn btn-sm bg-[#EA3943]/12 text-[#EA3943] hover:bg-[#EA3943]/20"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[#C6A15B]" aria-hidden="true" />
          <p className="text-xs font-medium text-[#F5F5F7]">Grant a reward to a user</p>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#9CA3AF]">
          Every grant posts a balanced ledger entry to the user's promotional credits, is recorded in
          the admin audit log, and notifies the user. Rewards are never counted as investment
          principal or trading profit.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input value={grantForm.userId} onChange={(event) => patchGrant({ userId: event.target.value })} placeholder="User id (UUID)" className={inputClass} />
          <select value={grantForm.rewardId} onChange={(event) => patchGrant({ rewardId: event.target.value })} className={inputClass}>
            <option value="">No catalogue reward — manual grant</option>
            {(summary?.catalog ?? []).map((entry) => (
              <option key={entry.rewardId} value={entry.rewardId}>
                {entry.name} ({entry.amount} {entry.asset})
              </option>
            ))}
          </select>
          <input value={grantForm.amount} onChange={(event) => patchGrant({ amount: event.target.value })} placeholder="Amount (defaults to reward amount)" className={inputClass} />
          {!grantForm.rewardId ? (
            <>
              <input value={grantForm.name} onChange={(event) => patchGrant({ name: event.target.value })} placeholder="Manual reward name" className={inputClass} />
              <select value={grantForm.category} onChange={(event) => patchGrant({ category: event.target.value as RewardCategory })} className={inputClass}>
                {REWARD_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {REWARD_CATEGORY_LABEL[category]}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <input value={grantForm.asset} onChange={(event) => patchGrant({ asset: event.target.value })} placeholder="Asset (USDT)" className={inputClass} />
          <input type="date" value={grantForm.expiresAt} onChange={(event) => patchGrant({ expiresAt: event.target.value })} className={inputClass} />
          <input value={grantForm.reason} onChange={(event) => patchGrant({ reason: event.target.value })} placeholder="Audit reason (required)" className={`${inputClass} md:col-span-2`} />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={submitGrant}
            disabled={busy !== null}
            className="btn btn-sm btn-primary w-full sm:w-auto"
          >
            {busy === "grant" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            Grant reward
          </button>
        </div>
      </Panel>

      <Panel className="p-0">
        <div className="border-b border-[#26272B] px-4 py-3">
          <p className="text-xs font-medium text-[#F5F5F7]">User reward grants</p>
        </div>
        {!grants ? (
          <div className="px-4 py-2">
            <LoadingRow label="Loading grants…" />
          </div>
        ) : grants.rewards.length === 0 ? (
          <div className="px-4 py-4">
            <EmptyState title="No rewards granted yet" description="Grants appear here once users earn or are granted a reward." />
          </div>
        ) : (
          <ul className="divide-y divide-[#26272B]/60">
            {grants.rewards.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-[#F5F5F7]">{row.name}</span>
                    <StatusBadge tone={row.grantSource === "admin" ? "gold" : "neutral"} label={row.grantSource === "admin" ? "Admin grant" : "Automatic"} />
                    <StatusBadge tone={row.status === "available" ? "positive" : row.status === "redeemed" ? "neutral" : "negative"} label={row.statusLabel} />
                  </div>
                  <p className="mt-1 break-words text-[11px] text-[#9CA3AF]">
                    {row.userEmail || row.userId} · {row.amount} {row.asset} · {row.categoryLabel}
                  </p>
                  <p className="mt-0.5 break-words font-mono text-[10px] text-[#6B7280]">
                    {row.reference} · {row.grantReason}
                  </p>
                </div>
                {row.status !== "redeemed" && row.status !== "revoked" ? (
                  <button
                    type="button"
                    onClick={() => void revoke(row.id, row.name)}
                    disabled={busy !== null}
                    className="btn btn-sm btn-secondary"
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {grants && grants.total > grants.pageSize ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-[11px] text-[#6B7280]">
              {grants.total} grant(s) · page {grants.page} of {totalGrantPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={grantsPage <= 1}
                onClick={() => setGrantsPage((page) => Math.max(1, page - 1))}
                className="btn btn-sm btn-secondary"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={grantsPage >= totalGrantPages}
                onClick={() => setGrantsPage((page) => page + 1)}
                className="btn btn-sm btn-secondary"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
