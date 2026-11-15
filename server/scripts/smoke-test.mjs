/**
 * NexaCrypto API smoke test.
 *
 * Probes every registered API route as an authenticated user and reports the
 * HTTP status of each response. Exits with code 1 if any endpoint returns a 5xx
 * so it can be used as a deployment gate.
 *
 * Usage:
 *   BASE=https://cryptosite-yc00.onrender.com/api \
 *   EMAIL=admin@local.dev \
 *   PASSWORD='ChangeMeNow123!' \
 *   node server/scripts/smoke-test.mjs
 *
 * Defaults target the deployed backend with the bootstrap admin account.
 */

const BASE = process.env.BASE || "https://cryptosite-yc00.onrender.com/api";
const EMAIL = process.env.EMAIL || "admin@local.dev";
const PASSWORD = process.env.PASSWORD || "ChangeMeNow123!";

const PUBLIC_ENDPOINTS = [
  "GET /health",
  "GET /market/prices",
  "GET /market/coin/BTC",
  "GET /bonuses/active",
  "GET /deposits/addresses",
  "GET /leaderboard/depositors",
  "GET /leaderboard/earnings",
  "GET /leaderboard/streaks",
  "GET /leaderboard/growth"
];

const AUTHENTICATED_ENDPOINTS = [
  "GET /auth/me",
  "GET /user/current_xp_level",
  "GET /user/settings",
  "GET /operations/membership",
  "GET /operations/membership/config",
  "GET /operations/investment-level",
  "GET /operations/investment-level/config",
  "GET /operations/performance",
  "GET /operations/bonuses",
  "GET /operations/rewards",
  "GET /operations/transactions",
  "GET /portfolio/summary",
  "GET /portfolio/overview",
  "GET /notifications/me",
  "GET /notifications/unseen",
  "GET /referrals/dashboard",
  "GET /social_feed",
  "GET /ai/me",
  "GET /deposits/me",
  "GET /withdrawals/me",
  "GET /withdrawals/summary",
  "GET /admin/users_stats",
  "GET /admin/risk_flags",
  "GET /admin/analytics/overview",
  "GET /admin/analytics/heatmap",
  "GET /operations/admin/overview",
  "GET /operations/admin/users",
  "GET /operations/admin/deposits",
  "GET /operations/admin/withdrawals",
  "GET /operations/admin/ledger",
  "GET /operations/admin/memberships",
  "GET /operations/admin/membership/users",
  "GET /operations/admin/investment-levels",
  "GET /operations/admin/investment-level/users",
  "GET /operations/admin/performance",
  "GET /operations/admin/performance/summary",
  "GET /operations/admin/transactions",
  "GET /operations/admin/activity",
  "GET /operations/admin/bonus",
  "GET /operations/admin/bonus/campaigns",
  "GET /operations/admin/bonus/credits",
  "GET /operations/admin/rewards",
  "GET /operations/admin/rewards/catalog",
  "GET /operations/admin/rewards/grants",
  "GET /operations/admin/settings",
  "GET /operations/admin/reconcile/history"
];

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  if (!res.ok) {
    throw new Error(`Login failed with HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.accessToken) {
    throw new Error("Login succeeded but no accessToken was returned");
  }
  return body.accessToken;
}

async function probe(method, path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, { method, headers });
  let snippet = "";
  try {
    const text = await res.text();
    snippet = text.replace(/\s+/g, " ").slice(0, 100);
  } catch {
    snippet = "";
  }
  return { status: res.status, snippet };
}

async function runGroup(label, entries, token) {
  console.log(`\n=== ${label} ===`);
  const failures = [];
  for (const entry of entries) {
    const [method, path] = entry.split(" ");
    let result;
    try {
      result = await probe(method, path, token);
    } catch (error) {
      result = { status: "ERR", snippet: String(error).slice(0, 100) };
    }
    const isServerError =
      typeof result.status === "number" && result.status >= 500;
    if (isServerError) {
      failures.push(entry);
    }
    console.log(
      `${String(result.status).padEnd(4)} ${entry.padEnd(48)} ${result.snippet}${
        isServerError ? "  <<< 5xx" : ""
      }`
    );
  }
  return failures;
}

async function main() {
  console.log(`Target: ${BASE}`);
  const token = await login();
  console.log(`Authenticated as ${EMAIL}`);

  const publicFailures = await runGroup("Public endpoints", PUBLIC_ENDPOINTS, null);
  const authFailures = await runGroup(
    "Authenticated endpoints",
    AUTHENTICATED_ENDPOINTS,
    token
  );

  const failures = [...publicFailures, ...authFailures];
  const total = PUBLIC_ENDPOINTS.length + AUTHENTICATED_ENDPOINTS.length;

  console.log(
    `\nSUMMARY: ${total} endpoints probed, ${failures.length} returned 5xx`
  );
  if (failures.length > 0) {
    console.log("Failing endpoints:");
    for (const entry of failures) {
      console.log(`  - ${entry}`);
    }
    process.exit(1);
  }
  console.log("All endpoints healthy.");
}

main().catch((error) => {
  console.error(`Smoke test aborted: ${error.message}`);
  process.exit(1);
});
