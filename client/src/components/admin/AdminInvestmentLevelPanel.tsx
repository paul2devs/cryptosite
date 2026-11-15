import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../utils/api";
import { ErrorRow, Panel } from "../dashboard/primitives";

interface AdminLevelBenefit {
  benefitId: string;
  code: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  requiresActivation: boolean;
  active: boolean;
  sortOrder: number;
}

interface AdminLevel {
  levelId: string;
  name: string;
  levelNumber: number;
  active: boolean;
  threshold: string;
  description: string;
  icon: string;
  theme: { accent?: string };
  sortOrder: number;
  effectiveFrom: string | null;
  users: number;
  benefits: AdminLevelBenefit[];
}

interface AdminSummary {
  rules: {
    qualificationMetric: { code: string; label: string; description: string };
    creditedEvents: string[];
    excludedEvents: string[];
    automaticUpgrades: boolean;
    downgradesSupported: boolean;
    downgradePolicy: string;
    retentionPolicy: string;
    manualOverridePolicy: string;
  };
  metric: { code: string; label: string; description: string };
  distribution: AdminLevel[];
  approaching: Array<{ userId: string; email: string; currentLevel: string; nextLevel: string; remaining: string }>;
  overrides: Array<{
    userId: string;
    levelId: string | null;
    levelName: string | null;
    reason: string | null;
    setAt: string | null;
    qualifyingAmount: string;
  }>;
  history: Array<{
    historyId: string;
    userId: string;
    fromLevelName: string | null;
    toLevelName: string | null;
    fromLevelNumber: number | null;
    toLevelNumber: number | null;
    qualifyingAmount: string;
    reason: string;
    source: string;
    actorAdminId: string | null;
    createdAt: string;
  }>;
  benefits: Array<AdminLevelBenefit & { levelId: string }>;
}

interface AdminUser {
  userId: string;
  name: string | null;
  email: string;
  levelId: string | null;
  levelName: string | null;
  levelNumber: number | null;
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
  levels: Array<{ levelId: string; name: string; levelNumber: number; active: boolean }>;
}

interface LevelForm {
  levelId: string;
  levelNumber: string;
  name: string;
  description: string;
  threshold: string;
  icon: string;
  accent: string;
  sortOrder: string;
  active: boolean;
  effectiveFrom: string;
}

interface BenefitForm {
  benefitId: string;
  levelId: string;
  code: string;
  name: string;
  description: string;
  category: string;
  available: boolean;
  requiresActivation: boolean;
  sortOrder: string;
  active: boolean;
}

const EMPTY_LEVEL: LevelForm = {
  levelId: "",
  levelNumber: "",
  name: "",
  description: "",
  threshold: "",
  icon: "",
  accent: "#C6A15B",
  sortOrder: "",
  active: true,
  effectiveFrom: ""
};

const EMPTY_BENEFIT: BenefitForm = {
  benefitId: "",
  levelId: "",
  code: "",
  name: "",
  description: "",
  category: "tools",
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

export function AdminInvestmentLevelPanel() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");

  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [levelForm, setLevelForm] = useState<LevelForm>(EMPTY_LEVEL);
  const [benefitForm, setBenefitForm] = useState<BenefitForm>(EMPTY_BENEFIT);

  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustLevelId, setAdjustLevelId] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const loadSummary = useCallback(async () => {
    const response = await api.get<AdminSummary>("/operations/admin/investment-levels");
    setSummary(response.data);
  }, []);

  const loadUsers = useCallback(
    async (nextPage: number) => {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", "20");
      if (query.trim()) params.set("q", query.trim());
      if (levelFilter) params.set("levelId", levelFilter);
      if (statusFilter) params.set("status", statusFilter);
      const response = await api.get<AdminUsersResponse>(
        `/operations/admin/investment-level/users?${params.toString()}`
      );
      setUsers(response.data);
    },
    [query, levelFilter, statusFilter]
  );

  const reloadAll = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadSummary(), loadUsers(nextPage)]);
      } catch (requestError) {
        setError(message(requestError, "Failed to load investment level data"));
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

  const levels = summary?.distribution ?? [];
  const activeLevels = useMemo(() => levels.filter((level) => level.active), [levels]);

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

  const submitLevel = async () => {
    if (reason.trim().length < 3) {
      setError("Enter a reason of at least 3 characters before saving a level.");
      return;
    }
    const levelNumber = Number(levelForm.levelNumber);
    if (!Number.isInteger(levelNumber) || levelNumber < 1) {
      setError("Enter a whole level number of 1 or greater.");
      return;
    }
    if (levelForm.name.trim().length < 2) {
      setError("Enter a level name of at least 2 characters.");
      return;
    }
    if (levelForm.description.trim().length < 3) {
      setError("Enter a level description of at least 3 characters.");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(levelForm.threshold.trim())) {
      setError("Enter the qualification threshold as a USD amount with up to 2 decimals.");
      return;
    }
    await run(async () => {
      await api.post("/operations/admin/investment-levels", {
        levelId: levelForm.levelId || undefined,
        levelNumber,
        name: levelForm.name,
        description: levelForm.description,
        threshold: levelForm.threshold.trim(),
        icon: levelForm.icon || `level_${levelNumber}`,
        accent: levelForm.accent || "#C6A15B",
        sortOrder: Number(levelForm.sortOrder) || levelNumber,
        active: levelForm.active,
        effectiveFrom: levelForm.effectiveFrom ? levelForm.effectiveFrom : null,
        reason
      });
      setLevelForm(EMPTY_LEVEL);
      await loadSummary();
    }, "Investment level configuration saved");
  };

  const submitBenefit = async () => {
    if (reason.trim().length < 3) {
      setError("Enter a reason of at least 3 characters before saving a benefit.");
      return;
    }
    if (!benefitForm.levelId) {
      setError("Select the level this benefit applies to.");
      return;
    }
    if (benefitForm.code.trim().length < 3) {
      setError("Enter a benefit code of at least 3 characters.");
      return;
    }
    if (benefitForm.name.trim().length < 2) {
      setError("Enter a benefit name of at least 2 characters.");
      return;
    }
    if (benefitForm.description.trim().length < 3) {
      setError("Enter a benefit description of at least 3 characters.");
      return;
    }
    if (benefitForm.category.trim().length < 2) {
      setError("Enter a benefit category of at least 2 characters.");
      return;
    }
    await run(async () => {
      await api.post("/operations/admin/investment-level/benefits", {
        benefitId: benefitForm.benefitId || undefined,
        levelId: benefitForm.levelId,
        code: benefitForm.code,
        name: benefitForm.name,
        description: benefitForm.description,
        category: benefitForm.category,
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
      setError("Enter a reason of at least 3 characters before adjusting an investment level.");
      return;
    }
    await run(async () => {
      await api.post(`/operations/admin/investment-level/users/${adjustUserId}/adjust`, {
        levelId: adjustLevelId || null,
        reason: adjustReason
      });
      setAdjustUserId(null);
      setAdjustLevelId("");
      setAdjustReason("");
      await Promise.all([loadSummary(), loadUsers(page)]);
    }, "Investment level adjusted and audited");
  };

  const clearOverride = async (userId: string) => {
    if (reason.trim().length < 3) {
      setError("Enter a reason in the reason field before clearing an exception.");
      return;
    }
    await run(async () => {
      await api.post(`/operations/admin/investment-level/users/${userId}/clear-override`, { reason });
      await Promise.all([loadSummary(), loadUsers(page)]);
    }, "Manual exception cleared and level recalculated");
  };

  const recalculate = async (userId: string) => {
    if (reason.trim().length < 3) {
      setError("Enter a reason in the reason field before recalculating eligibility.");
      return;
    }
    await run(async () => {
      await api.post(`/operations/admin/investment-level/users/${userId}/recalculate`, { reason });
      await Promise.all([loadSummary(), loadUsers(page)]);
    }, "Eligibility recalculated");
  };

  const totalPages = users ? Math.max(1, Math.ceil(users.total / users.pageSize)) : 1;

  return (
    <div className="space-y-6">
      {error ? <ErrorRow message={error} /> : null}
      {notice ? <p className="text-xs text-[#16C784]">{notice}</p> : null}
      {loading && !summary ? (
        <p className="text-sm text-[#9CA3AF]">Loading investment level data...</p>
      ) : null}

      <Panel>
        <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Qualification policy</p>
        {summary ? (
          <div className="mt-2 space-y-1 text-xs text-[#9CA3AF]">
            <p>
              Metric · {summary.metric.label} ({summary.metric.code})
            </p>
            <p>Automatic upgrades {summary.rules.automaticUpgrades ? "enabled" : "disabled"} · Automatic downgrades {summary.rules.downgradesSupported ? "enabled" : "disabled"}</p>
            <p>{summary.rules.downgradePolicy}</p>
            <p>{summary.rules.retentionPolicy}</p>
            <p>{summary.rules.manualOverridePolicy}</p>
          </div>
        ) : null}
      </Panel>

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Level distribution</p>
        <div className="space-y-2">
          {levels.map((level) => (
            <div key={level.levelId} className="rounded-xl bg-[#17181A] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#F5F5F7]">
                <span>
                  Level {level.levelNumber} · {level.name} · {level.users} users · ${level.threshold}+ ·{" "}
                  {level.active ? "active" : "inactive"} · {level.benefits.length} benefits
                </span>
                <span className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() =>
                      setLevelForm({
                        levelId: level.levelId,
                        levelNumber: String(level.levelNumber),
                        name: level.name,
                        description: level.description,
                        threshold: level.threshold,
                        icon: level.icon,
                        accent: level.theme?.accent ?? "#C6A15B",
                        sortOrder: String(level.sortOrder),
                        active: level.active,
                        effectiveFrom: level.effectiveFrom
                          ? new Date(level.effectiveFrom).toISOString().slice(0, 10)
                          : ""
                      })
                    }
                  >
                    Edit
                  </button>
                  {level.active ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        void run(async () => {
                          await api.post(`/operations/admin/investment-levels/${level.levelId}/deactivate`, {
                            reason: reason || "Deactivated from operations"
                          });
                          await loadSummary();
                        }, `Level ${level.levelNumber} deactivated`)
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
                          await api.delete(`/operations/admin/investment-levels/${level.levelId}`);
                          await loadSummary();
                        }, `Level ${level.levelNumber} removed`)
                      }
                    >
                      Delete
                    </button>
                  )}
                </span>
              </div>
              {level.benefits.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[11px] text-[#9CA3AF]">
                  {level.benefits.map((benefit) => (
                    <li key={benefit.benefitId} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {benefit.name} · {benefit.code} · {benefit.category} ·{" "}
                        {benefit.available ? "available" : "unavailable"}
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
                              levelId: level.levelId,
                              code: benefit.code,
                              name: benefit.name,
                              description: benefit.description,
                              category: benefit.category,
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
                              await api.delete(
                                `/operations/admin/investment-level/benefits/${benefit.benefitId}`,
                                { data: { reason: reason || "Removed from operations" } }
                              );
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
          {levels.length === 0 && !loading ? (
            <p className="text-xs text-[#9CA3AF]">No investment levels configured.</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">
            {levelForm.levelId ? "Edit level" : "Create level"}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={levelForm.levelNumber}
              onChange={(event) => setLevelForm({ ...levelForm, levelNumber: event.target.value })}
              placeholder="Level number"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
            <input
              value={levelForm.sortOrder}
              onChange={(event) => setLevelForm({ ...levelForm, sortOrder: event.target.value })}
              placeholder="Sort order"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          </div>
          <input
            value={levelForm.name}
            onChange={(event) => setLevelForm({ ...levelForm, name: event.target.value })}
            placeholder="Level name"
            className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
          />
          <input
            value={levelForm.description}
            onChange={(event) => setLevelForm({ ...levelForm, description: event.target.value })}
            placeholder="Description"
            className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={levelForm.threshold}
              onChange={(event) => setLevelForm({ ...levelForm, threshold: event.target.value })}
              placeholder="Threshold USD (e.g. 5000.00)"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
            <input
              type="date"
              value={levelForm.effectiveFrom}
              onChange={(event) => setLevelForm({ ...levelForm, effectiveFrom: event.target.value })}
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={levelForm.icon}
              onChange={(event) => setLevelForm({ ...levelForm, icon: event.target.value })}
              placeholder="Icon key"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
            <input
              value={levelForm.accent}
              onChange={(event) => setLevelForm({ ...levelForm, accent: event.target.value })}
              placeholder="Accent hex"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#9CA3AF]">
            <input
              type="checkbox"
              checked={levelForm.active}
              onChange={(event) => setLevelForm({ ...levelForm, active: event.target.checked })}
            />
            Active
          </label>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason (required, audited)"
            className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void submitLevel()} className="btn btn-sm btn-primary">
              {levelForm.levelId ? "Update level" : "Save level"}
            </button>
            {levelForm.levelId ? (
              <button type="button" onClick={() => setLevelForm(EMPTY_LEVEL)} className="btn btn-sm btn-ghost">
                Cancel
              </button>
            ) : null}
          </div>
        </Panel>

        <Panel className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">
            {benefitForm.benefitId ? "Edit benefit" : "Configure benefit"}
          </p>
          <select
            value={benefitForm.levelId}
            onChange={(event) => setBenefitForm({ ...benefitForm, levelId: event.target.value })}
            className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
          >
            <option value="">Select applicable level</option>
            {activeLevels.map((level) => (
              <option key={level.levelId} value={level.levelId}>
                Level {level.levelNumber} · {level.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={benefitForm.code}
              onChange={(event) => setBenefitForm({ ...benefitForm, code: event.target.value })}
              placeholder="Code"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
            <input
              value={benefitForm.category}
              onChange={(event) => setBenefitForm({ ...benefitForm, category: event.target.value })}
              placeholder="Category"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={benefitForm.name}
              onChange={(event) => setBenefitForm({ ...benefitForm, name: event.target.value })}
              placeholder="Benefit name"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
            <input
              value={benefitForm.sortOrder}
              onChange={(event) => setBenefitForm({ ...benefitForm, sortOrder: event.target.value })}
              placeholder="Sort order"
              className="rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
          </div>
          <input
            value={benefitForm.description}
            onChange={(event) => setBenefitForm({ ...benefitForm, description: event.target.value })}
            placeholder="Benefit description"
            className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
          />
          <div className="flex flex-wrap gap-4 text-xs text-[#9CA3AF]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={benefitForm.available}
                onChange={(event) => setBenefitForm({ ...benefitForm, available: event.target.checked })}
              />
              Delivered now
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={benefitForm.requiresActivation}
                onChange={(event) => setBenefitForm({ ...benefitForm, requiresActivation: event.target.checked })}
              />
              Requires activation
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={benefitForm.active}
                onChange={(event) => setBenefitForm({ ...benefitForm, active: event.target.checked })}
              />
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
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Users by investment level</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, id"
              className="w-full rounded-xl bg-[#17181A] px-3 py-2 text-sm text-[#F5F5F7] sm:w-auto"
            />
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="w-full rounded-xl bg-[#17181A] px-3 py-2 text-sm text-[#F5F5F7] sm:w-auto"
            >
              <option value="">All levels</option>
              {levels.map((level) => (
                <option key={level.levelId} value={level.levelId}>
                  Level {level.levelNumber} · {level.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl bg-[#17181A] px-3 py-2 text-sm text-[#F5F5F7] sm:w-auto"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="manual_review">Platform exception</option>
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
                    setError(message(requestError, "Failed to load users"));
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
              className="btn btn-sm btn-primary"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">
              <tr>
                <th className="py-2">User</th>
                <th>Level</th>
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
                  <td>{user.levelName ?? "Unqualified"}</td>
                  <td className="financial-figure">{user.qualifyingAmount}</td>
                  <td>
                    {user.status}
                    {user.manualReason ? (
                      <span className="block text-[11px] text-[#C6A15B]">{user.manualReason}</span>
                    ) : null}
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-2 text-xs">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => {
                          setAdjustUserId(user.userId);
                          setAdjustLevelId(user.levelId ?? "");
                          setAdjustReason("");
                        }}
                      >
                        Adjust
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => void recalculate(user.userId)}>
                        Recalculate
                      </button>
                      {user.status === "manual_review" ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => void clearOverride(user.userId)}
                        >
                          Clear exception
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users && users.users.length === 0 ? (
            <p className="text-xs text-[#9CA3AF]">No users match these filters.</p>
          ) : null}
        </div>

        {adjustUserId ? (
          <Panel className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">
              Manual investment level adjustment · {adjustUserId}
            </p>
            <p className="text-[11px] text-[#9CA3AF]">
              Manual adjustments require authorization, are recorded against your platform account,
              and are written to an immutable audit entry with the previous and new level. Server-side
              validation applies and historical qualification results are never silently rewritten.
            </p>
            <select
              value={adjustLevelId}
              onChange={(event) => setAdjustLevelId(event.target.value)}
              className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            >
              <option value="">Remove level (unassign)</option>
              {activeLevels.map((level) => (
                <option key={level.levelId} value={level.levelId}>
                  Level {level.levelNumber} · {level.name}
                </option>
              ))}
            </select>
            <input
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value)}
              placeholder="Reason (required, audited)"
              className="w-full rounded-xl bg-[#0F0F10] px-3 py-2 text-sm text-[#F5F5F7]"
            />
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
              disabled={page <= 1}
              className="btn btn-sm btn-secondary"
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
              disabled={page >= totalPages}
              className="btn btn-sm btn-secondary"
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
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Approaching next level</p>
          {summary && summary.approaching.length === 0 ? <p className="text-xs text-[#9CA3AF]">None</p> : null}
          {summary?.approaching.map((row) => (
            <p key={row.userId} className="text-xs text-[#9CA3AF]">
              {row.email} · {row.remaining} USD to {row.nextLevel}
            </p>
          ))}
        </Panel>
        <Panel className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Active manual exceptions</p>
          {summary && summary.overrides.length === 0 ? <p className="text-xs text-[#9CA3AF]">None</p> : null}
          {summary?.overrides.map((row) => (
            <p key={row.userId} className="text-xs text-[#9CA3AF]">
              {row.userId} · {row.levelName ?? "unassigned"} · {row.reason ?? "no reason"} ·{" "}
              {row.qualifyingAmount} qualifying
            </p>
          ))}
        </Panel>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[#9CA3AF]">Investment level history</p>
        {summary && summary.history.length === 0 ? <p className="text-xs text-[#9CA3AF]">No history yet.</p> : null}
        {summary?.history.map((row) => (
          <p key={row.historyId} className="text-xs text-[#9CA3AF]">
            {new Date(row.createdAt).toLocaleString("en-US")} · {row.fromLevelName ?? "none"} →{" "}
            {row.toLevelName ?? "none"} · {row.source} · {row.reason}
            {row.actorAdminId ? ` · Platform ${row.actorAdminId}` : ""}
          </p>
        ))}
      </div>
    </div>
  );
}
