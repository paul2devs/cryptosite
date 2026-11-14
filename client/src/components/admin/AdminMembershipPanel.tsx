import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../utils/api";
import { ErrorRow, Panel } from "../dashboard/primitives";

interface AdminTierBenefit {
  benefitId: string;
  code: string;
  name: string;
  description: string;
  available: boolean;
  requiresActivation: boolean;
  active: boolean;
  sortOrder: number;
}

interface AdminTier {
  tierId: string;
  name: string;
  active: boolean;
  minAmount: string;
  maxAmount: string | null;
  description: string;
  sortOrder: number;
  users: number;
  benefits: AdminTierBenefit[];
}

interface AdminSummary {
  rules: {
    automaticUpgrades: boolean;
    downgradesSupported: boolean;
    downgradePolicy: string;
    retentionPolicy: string;
    manualOverridePolicy: string;
  };
  distribution: AdminTier[];
  approaching: Array<{ userId: string; email: string; currentTier: string; nextTier: string; remaining: string }>;
  overrides: Array<{ userId: string; tierId: string | null; tierName: string | null; reason: string | null; setAt: string | null; qualifyingAmount: string }>;
  history: Array<{
    historyId: string;
    userId: string;
    fromTierName: string | null;
    toTierName: string | null;
    qualifyingAmount: string;
    reason: string;
    source: string;
    actorAdminId: string | null;
    createdAt: string;
  }>;
  benefits: Array<AdminTierBenefit & { tierId: string }>;
}

interface AdminUser {
  userId: string;
  name: string | null;
  email: string;
  tierId: string | null;
  tierName: string | null;
  qualifyingAmount: string;
  achievedAt: string | null;
  status: string;
  manualReason: string | null;
  reason: string | null;
}

interface AdminUsersResponse {
  page: number;
  pageSize: number;
  total: number;
  users: AdminUser[];
  tiers: Array<{ tierId: string; name: string; sortOrder: number; active: boolean }>;
}

interface TierForm {
  tierId: string;
  name: string;
  minAmount: string;
  maxAmount: string;
  sortOrder: string;
  active: boolean;
}

interface BenefitForm {
  benefitId: string;
  tierId: string;
  code: string;
  name: string;
  description: string;
  available: boolean;
  requiresActivation: boolean;
  sortOrder: string;
  active: boolean;
}

const EMPTY_TIER: TierForm = { tierId: "", name: "", minAmount: "", maxAmount: "", sortOrder: "", active: true };
const EMPTY_BENEFIT: BenefitForm = {
  benefitId: "",
  tierId: "",
  code: "",
  name: "",
  description: "",
  available: true,
  requiresActivation: false,
  sortOrder: "0",
  active: true
};

function message(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const detail = candidate?.response?.data?.message;
  return typeof detail === "string" && detail.length > 0 ? detail : fallback;
}

export function AdminMembershipPanel() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [tierForm, setTierForm] = useState<TierForm>(EMPTY_TIER);
  const [benefitForm, setBenefitForm] = useState<BenefitForm>(EMPTY_BENEFIT);

  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustTierId, setAdjustTierId] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const loadSummary = useCallback(async () => {
    const response = await api.get<AdminSummary>("/operations/admin/memberships");
    setSummary(response.data);
  }, []);

  const loadUsers = useCallback(
    async (nextPage: number) => {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", "20");
      if (query.trim()) params.set("q", query.trim());
      if (tierFilter) params.set("tierId", tierFilter);
      if (statusFilter) params.set("status", statusFilter);
      const response = await api.get<AdminUsersResponse>(`/operations/admin/membership/users?${params.toString()}`);
      setUsers(response.data);
    },
    [query, tierFilter, statusFilter]
  );

  const reloadAll = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadSummary(), loadUsers(nextPage)]);
      } catch (requestError) {
        setError(message(requestError, "Failed to load membership administration data"));
      } finally {
        setLoading(false);
      }
    },
    [loadSummary, loadUsers, page]
  );

  useEffect(() => {
    void reloadAll(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiers = summary?.distribution ?? [];
  const activeTiers = useMemo(() => tiers.filter((tier) => tier.active), [tiers]);

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
    } catch (requestError) {
      setError(message(requestError, "The action could not be completed"));
    }
  };

  const submitTier = async () => {
    if (reason.trim().length < 3) {
      setError("Enter a reason of at least 3 characters before saving a tier.");
      return;
    }
    await run(async () => {
      await api.post("/operations/admin/memberships", {
        tierId: tierForm.tierId || undefined,
        name: tierForm.name,
        description: `${tierForm.name} membership tier`,
        minAmount: tierForm.minAmount,
        maxAmount: tierForm.maxAmount.trim() ? tierForm.maxAmount.trim() : null,
        benefits: [],
        icon: tierForm.tierId ? "tier" : `tier_${tierForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        accent: "#C6A15B",
        sortOrder: Number(tierForm.sortOrder) || tiers.length + 1,
        active: tierForm.active,
        reason
      });
      setTierForm(EMPTY_TIER);
      await loadSummary();
    }, "Tier configuration saved");
  };

  const submitBenefit = async () => {
    if (reason.trim().length < 3) {
      setError("Enter a reason of at least 3 characters before saving a benefit.");
      return;
    }
    if (!benefitForm.tierId) {
      setError("Select the tier this benefit applies to.");
      return;
    }
    await run(async () => {
      await api.post("/operations/admin/membership/benefits", {
        benefitId: benefitForm.benefitId || undefined,
        tierId: benefitForm.tierId,
        code: benefitForm.code,
        name: benefitForm.name,
        description: benefitForm.description,
        available: benefitForm.available,
        requiresActivation: benefitForm.requiresActivation,
        sortOrder: Number(benefitForm.sortOrder) || 0,
        active: benefitForm.active,
        reason
      });
      setBenefitForm(EMPTY_BENEFIT);
      await loadSummary();
    }, "Benefit saved");
  };

  const submitAdjustment = async () => {
    if (!adjustUserId) return;
    if (adjustReason.trim().length < 3) {
      setError("Enter a reason of at least 3 characters before adjusting a membership.");
      return;
    }
    await run(async () => {
      await api.post(`/operations/admin/membership/users/${adjustUserId}/adjust`, {
        tierId: adjustTierId || null,
        reason: adjustReason
      });
      setAdjustUserId(null);
      setAdjustTierId("");
      setAdjustReason("");
      await Promise.all([loadSummary(), loadUsers(page)]);
    }, "Membership adjusted and audited");
  };

  const clearOverride = async (userId: string) => {
    if (reason.trim().length < 3) {
      setError("Enter a reason in the reason field before clearing an exception.");
      return;
    }
    await run(async () => {
      await api.post(`/operations/admin/membership/users/${userId}/clear-override`, { reason });
      await Promise.all([loadSummary(), loadUsers(page)]);
    }, "Manual exception cleared");
  };

  const totalPages = users ? Math.max(1, Math.ceil(users.total / users.pageSize)) : 1;

  return (
    <div className="space-y-6">
      {error ? <ErrorRow message={error} /> : null}
      {notice ? <p className="text-xs text-[#16C784]">{notice}</p> : null}
      {loading && !summary ? <p className="text-sm text-[#9CA3AF]">Loading membership administration...</p> : null}

      <Panel>
        <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Policy</p>
        {summary ? (
          <div className="mt-2 space-y-1 text-xs text-[#9CA3AF]">
            <p>Automatic upgrades {summary.rules.automaticUpgrades ? "enabled" : "disabled"} · Automatic downgrades {summary.rules.downgradesSupported ? "enabled" : "disabled"}</p>
            <p>{summary.rules.downgradePolicy}</p>
            <p>{summary.rules.retentionPolicy}</p>
            <p>{summary.rules.manualOverridePolicy}</p>
          </div>
        ) : null}
      </Panel>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Tier distribution</p>
        <div className="space-y-2">
          {tiers.map((tier) => (
            <div key={tier.tierId} className="rounded-xl bg-[#17181A] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#F5F5F7]">
                <span>
                  {tier.name} · {tier.users} users · {tier.minAmount}
                  {tier.maxAmount ? `–${tier.maxAmount}` : "+"} · {tier.active ? "active" : "inactive"} ·{" "}
                  {tier.benefits.length} benefits
                </span>
                <span className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() =>
                      setTierForm({
                        tierId: tier.tierId,
                        name: tier.name,
                        minAmount: tier.minAmount,
                        maxAmount: tier.maxAmount ?? "",
                        sortOrder: String(tier.sortOrder),
                        active: tier.active
                      })
                    }
                  >
                    Edit
                  </button>
                  {tier.active ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void run(async () => {
                          await api.post(`/operations/admin/memberships/${tier.tierId}/deactivate`, {
                            reason: reason || "Deactivated from operations"
                          });
                          await loadSummary();
                        }, `${tier.name} deactivated`)
                      }
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm bg-[#EA3943]/12 text-[#EA3943] hover:bg-[#EA3943]/20"
                      onClick={() =>
                        void run(async () => {
                          await api.delete(`/operations/admin/memberships/${tier.tierId}`);
                          await loadSummary();
                        }, `${tier.name} removed`)
                      }
                    >
                      Delete
                    </button>
                  )}
                </span>
              </div>
              {tier.benefits.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[11px] text-[#9CA3AF]">
                  {tier.benefits.map((benefit) => (
                    <li key={benefit.benefitId} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {benefit.name} · {benefit.code} · {benefit.available ? "available" : "unavailable"}
                        {benefit.requiresActivation ? " · activation required" : ""}
                        {benefit.active ? "" : " · inactive"}
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() =>
                            setBenefitForm({
                              benefitId: benefit.benefitId,
                              tierId: tier.tierId,
                              code: benefit.code,
                              name: benefit.name,
                              description: benefit.description,
                              available: benefit.available,
                              requiresActivation: benefit.requiresActivation,
                              sortOrder: String(benefit.sortOrder),
                              active: benefit.active
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm bg-[#EA3943]/12 text-[#EA3943] hover:bg-[#EA3943]/20"
                          onClick={() =>
                            void run(async () => {
                              await api.delete(`/operations/admin/membership/benefits/${benefit.benefitId}`, {
                                data: { reason: reason || "Removed from operations" }
                              });
                              await loadSummary();
                            }, `${benefit.name} removed`)
                          }
                        >
                          Remove
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {tiers.length === 0 && !loading ? <p className="text-xs text-[#9CA3AF]">No tiers configured.</p> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">{tierForm.tierId ? "Edit tier" : "Create tier"}</p>
          <input value={tierForm.name} onChange={(event) => setTierForm({ ...tierForm, name: event.target.value })} placeholder="Tier name" className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
          <div className="grid grid-cols-2 gap-2">
            <input value={tierForm.minAmount} onChange={(event) => setTierForm({ ...tierForm, minAmount: event.target.value })} placeholder="Minimum USD" className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
            <input value={tierForm.maxAmount} onChange={(event) => setTierForm({ ...tierForm, maxAmount: event.target.value })} placeholder="Maximum USD (blank if open)" className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={tierForm.sortOrder} onChange={(event) => setTierForm({ ...tierForm, sortOrder: event.target.value })} placeholder="Sort order" className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
            <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
              <input type="checkbox" checked={tierForm.active} onChange={(event) => setTierForm({ ...tierForm, active: event.target.checked })} />
              Active
            </label>
          </div>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (required, audited)" className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void submitTier()} className="btn btn-sm btn-primary">
              {tierForm.tierId ? "Update tier" : "Save tier"}
            </button>
            {tierForm.tierId ? (
              <button type="button" onClick={() => setTierForm(EMPTY_TIER)} className="btn btn-sm btn-ghost">
                Cancel
              </button>
            ) : null}
          </div>
        </Panel>

        <Panel className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">{benefitForm.benefitId ? "Edit benefit" : "Create benefit"}</p>
          <select value={benefitForm.tierId} onChange={(event) => setBenefitForm({ ...benefitForm, tierId: event.target.value })} className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]">
            <option value="">Select applicable tier</option>
            {activeTiers.map((tier) => (
              <option key={tier.tierId} value={tier.tierId}>
                {tier.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input value={benefitForm.code} onChange={(event) => setBenefitForm({ ...benefitForm, code: event.target.value })} placeholder="Code" className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
            <input value={benefitForm.sortOrder} onChange={(event) => setBenefitForm({ ...benefitForm, sortOrder: event.target.value })} placeholder="Sort order" className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
          </div>
          <input value={benefitForm.name} onChange={(event) => setBenefitForm({ ...benefitForm, name: event.target.value })} placeholder="Benefit name" className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
          <input value={benefitForm.description} onChange={(event) => setBenefitForm({ ...benefitForm, description: event.target.value })} placeholder="Benefit description" className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
          <div className="flex flex-wrap gap-4 text-xs text-[#9CA3AF]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={benefitForm.available} onChange={(event) => setBenefitForm({ ...benefitForm, available: event.target.checked })} />
              Deliverable now
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={benefitForm.requiresActivation} onChange={(event) => setBenefitForm({ ...benefitForm, requiresActivation: event.target.checked })} />
              Requires activation
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={benefitForm.active} onChange={(event) => setBenefitForm({ ...benefitForm, active: event.target.checked })} />
              Active
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void submitBenefit()} className="btn btn-sm btn-primary">
              {benefitForm.benefitId ? "Update benefit" : "Save benefit"}
            </button>
            {benefitForm.benefitId ? (
              <button type="button" onClick={() => setBenefitForm(EMPTY_BENEFIT)} className="btn btn-sm btn-ghost">
                Cancel
              </button>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Members by tier</p>
          <div className="flex flex-wrap gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, id" className="w-full rounded-xl bg-[#17181A] px-3 py-2 text-sm text-[#F5F5F7] sm:w-auto" />
            <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} className="w-full rounded-xl bg-[#17181A] px-3 py-2 text-sm text-[#F5F5F7] sm:w-auto">
              <option value="">All tiers</option>
              {tiers.map((tier) => (
                <option key={tier.tierId} value={tier.tierId}>
                  {tier.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-xl bg-[#17181A] px-3 py-2 text-sm text-[#F5F5F7] sm:w-auto">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="manual_review">Admin exception</option>
              <option value="unqualified">Unqualified</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                void (async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    await loadUsers(1);
                  } catch (requestError) {
                    setError(message(requestError, "Failed to load members"));
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
              className="btn btn-sm btn-primary w-full sm:w-auto"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">
              <tr>
                <th className="py-2">Member</th>
                <th>Tier</th>
                <th>Qualifying</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users?.users ?? []).map((user) => (
                <tr key={user.userId} className="border-t border-[#2A2B2E] text-[#F5F5F7]">
                  <td className="py-2">
                    <span className="block">{user.email}</span>
                    <span className="text-[11px] text-[#9CA3AF]">{user.userId}</span>
                  </td>
                  <td>{user.tierName ?? "Unassigned"}</td>
                  <td className="financial-figure">{user.qualifyingAmount}</td>
                  <td>
                    {user.status}
                    {user.manualReason ? <span className="block text-[11px] text-[#C6A15B]">{user.manualReason}</span> : null}
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setAdjustUserId(user.userId);
                          setAdjustTierId(user.tierId ?? "");
                          setAdjustReason("");
                        }}
                      >
                        Adjust
                      </button>
                      {user.status === "manual_review" ? (
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void clearOverride(user.userId)}>
                          Clear exception
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users && users.users.length === 0 ? <p className="text-xs text-[#9CA3AF]">No members match these filters.</p> : null}
        </div>

        {adjustUserId ? (
          <Panel className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Manual membership adjustment · {adjustUserId}</p>
            <p className="text-[11px] text-[#9CA3AF]">
              Manual adjustments require authorization, are recorded against your administrator account,
              and are written to an immutable audit entry with the previous and new tier.
            </p>
            <select value={adjustTierId} onChange={(event) => setAdjustTierId(event.target.value)} className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]">
              <option value="">Remove tier (unassign)</option>
              {activeTiers.map((tier) => (
                <option key={tier.tierId} value={tier.tierId}>
                  {tier.name}
                </option>
              ))}
            </select>
            <input value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} placeholder="Reason (required, audited)" className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void submitAdjustment()} className="btn btn-sm btn-primary">
                Apply adjustment
              </button>
              <button type="button" onClick={() => setAdjustUserId(null)} className="btn btn-sm btn-ghost">
                Cancel
              </button>
            </div>
          </Panel>
        ) : null}

        {users && users.total > users.pageSize ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#9CA3AF]">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={page <= 1}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                void loadUsers(next);
              }}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={page >= totalPages}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void loadUsers(next);
              }}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Approaching next tier</p>
          {summary && summary.approaching.length === 0 ? <p className="text-xs text-[#9CA3AF]">None</p> : null}
          {summary?.approaching.map((row) => (
            <p key={row.userId} className="text-xs text-[#9CA3AF]">
              {row.email} · {row.remaining} USD to {row.nextTier}
            </p>
          ))}
        </Panel>
        <Panel className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Active manual exceptions</p>
          {summary && summary.overrides.length === 0 ? <p className="text-xs text-[#9CA3AF]">None</p> : null}
          {summary?.overrides.map((row) => (
            <p key={row.userId} className="text-xs text-[#9CA3AF]">
              {row.userId} · {row.tierName ?? "unassigned"} · {row.reason ?? "no reason"} · {row.qualifyingAmount} qualifying
            </p>
          ))}
        </Panel>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Membership history</p>
        {summary && summary.history.length === 0 ? <p className="text-xs text-[#9CA3AF]">No history yet.</p> : null}
        {summary?.history.map((row) => (
          <p key={row.historyId} className="text-xs text-[#9CA3AF]">
            {new Date(row.createdAt).toLocaleString("en-US")} · {row.fromTierName ?? "none"} → {row.toTierName ?? "none"} ·{" "}
            {row.source} · {row.reason}
            {row.actorAdminId ? ` · admin ${row.actorAdminId}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}
