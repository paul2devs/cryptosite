# NexaCrypto — Backend API Failure Repair & Deployment Guide

This document answers two things:

1. **What to do now** (deploy the fix and verify it).
2. **The full investigation report** (root cause, files changed, endpoint inventory).

Read top-to-bottom; the deploy steps are in section 3.

---

## 1. Root cause (one shared infrastructure defect)

The widespread API failures had a **single shared root cause**, not per-route bugs:

> **`server/src/config/cache.ts` was not fail-safe.** Every cache read/write went
> straight to Redis with `await` and **no `try/catch`**, so any Redis failure
> propagated as an unhandled exception into every caller and became an HTTP 500.

The production Redis (Upstash) connection is **not writeable**, and because the
client was created with:

```ts
new Redis(url, { maxRetriesPerRequest: 1, enableOfflineQueue: false })
```

...every command rejected **immediately** instead of queueing. Verified directly
against the production `REDIS_URL`:

```
GET REJECTED after 72ms: Stream isn't writeable and enableOfflineQueue options is false
SET REJECTED:            Stream isn't writeable and enableOfflineQueue options is false
```

`getCachedJson()` awaited that rejection without a guard, so it bubbled up:

```
getCachedJson()  ->  rejects
  -> getDynamicBonusFactor()        (bonusOptimizationService)
  -> getAdminOverview()             (analyticsService)
  -> GET /api/admin/analytics/overview  =>  HTTP 500
```

### Blast radius — every endpoint that touches the cache

| Endpoint | Cache path | Failure mode |
| --- | --- | --- |
| `GET /api/admin/analytics/overview` | `getDynamicBonusFactor()` → `getCachedJson()` | **Reproducible 500 in production** |
| `GET /api/portfolio/summary` | `getAllMarketPrices()` → `loadFromCache()` → `getCachedJson()` | 500 on cold start (before any price refresh) |
| `GET /api/portfolio/overview` | same as above | 500 on cold start |
| `GET /api/market/prices`, `GET /api/market/coin/:symbol` | `loadFromCache()` | 500 on cold start |
| `GET /api/leaderboard/*` | `leaderboardService` → `getCachedJson()` | 500 whenever cache is cold |
| `GET /api/operations/bonuses`, `GET /api/bonuses/active` | `bonusService` → `getCachedJson()` | 500 whenever cache is cold |

This is why the failures looked "random / system-wide": any request that landed
on a cold cache **and** an unhealthy Redis returned 500, while requests that hit
the in-process `inMemoryCache` succeeded.

### Status of the originally-reported endpoints

The three endpoints named in the report were tested against production **as of
this investigation**:

| Endpoint | Production result | Note |
| --- | --- | --- |
| `GET /api/user/current_xp_level` | **200** | Does not touch the cache |
| `GET /api/operations/membership` | **200** | Does not touch the cache |
| `GET /api/portfolio/summary` | **200** | Succeeds once a price refresh has populated the in-process cache; 500s on cold start |

The three examples were symptoms of the same cache defect (and of earlier,
already-fixed auth-deploy states). The **only** endpoint still returning 500 in
production at the time of writing was `GET /api/admin/analytics/overview`.

---

## 2. What was fixed

1. **Fail-safe cache (`server/src/config/cache.ts`)** — Redis `get`/`set` are now
   wrapped in `try/catch`; on any Redis error the call transparently degrades to
   an in-process `InMemoryCache`. A dead Redis can no longer produce a 5xx.
   Failures are logged at most once every 30 s. The cache status now reports
   `degraded: true` when Redis is configured but failing.
2. **Global error handling (`server/src/middleware/errorHandler.ts`, new)** —
   correlation IDs (`X-Correlation-Id`, echoed unless supplied), error
   categorisation (validation / auth / conflict / rate-limit / database /
   unknown), Sequelize error-name and SQLSTATE logging, and a strict rule that
   **no stack traces, secrets, or internal messages are returned to clients**.
   Also sanitises credentials out of log lines.
3. **Startup configuration validation (`server/src/config/env.ts`)** — new
   `validateRuntimeEnv()` / `logEnvWarnings()` warn on short/duplicate JWT
   secrets, missing `REDIS_URL`, missing `CORS_ORIGIN`, and non-production
   `NODE_ENV`, in addition to the existing hard-required checks.
4. **Richer health endpoint (`server/src/app.ts`)** — `GET /api/health` now
   returns database status **and** cache status, and responds `503` when the DB
   is down.
5. **Analytics controller (`server/src/controllers/analyticsController.ts`)** —
   errors are forwarded to the central handler with `next(error)` so the real
   cause is logged with its correlation ID instead of being swallowed.
6. **Operations controller (`server/src/controllers/operationsController.ts`)** —
   the shared `fail()` helper no longer returns raw internal error text on 5xx;
   it logs the diagnostic and returns a safe, categorised message plus the
   correlation ID.
7. **Process guards (`server/src/server.ts`)** — `unhandledRejection` and
   `uncaughtException` are logged (sanitised) instead of failing silently.

### Evidence the fix works

Reproduced locally against the **exact production Redis URL** (which rejects
every command) using the patched server:

```
SUMMARY: 55 endpoints probed, 0 returned 5xx
GET /admin/analytics/overview  ->  200   (previously 500)
GET /portfolio/summary         ->  200
GET /operations/membership     ->  200
GET /user/current_xp_level     ->  200
health.cache                   ->  {"backend":"redis","redisConfigured":true,"degraded":true}
```

Server compile `tsc --noEmit` exit 0; unit tests **78/78 pass**.

---

## 3. What to do — deploy and verify (step by step)

The production backend still runs the **old** code, so `/api/admin/analytics/overview`
still returns 500 until you deploy. The built output in `server/dist/` is already
regenerated and committed-ready.

### Step 1 — Commit and push

```bash
cd /home/paulsmithdev/Desktop/cryptosite
git add server/src server/dist server/scripts HOW_TO_RUN.md BACKEND_REPAIR.md
git commit -m "fix(backend): make cache layer fail-safe and add global error handling"
git push
```

### Step 2 — Confirm Render build/start settings

In the Render service for the API, confirm:

| Setting | Value |
| --- | --- |
| Root directory | `server` (or repo root, see below) |
| Build command | `npm install && npm run build` |
| Start command | `npm run start` (runs `node dist/server.js`) |
| Node version | 18 LTS or 20 LTS |

If the service root is the **repository root** instead, use:

| Setting | Value |
| --- | --- |
| Build command | `npm install && npm --workspace server run build` |
| Start command | `npm --workspace server run start` |

### Step 3 — Confirm environment variables on Render

Required (the server refuses to boot without the first three):

```dotenv
NODE_ENV=production
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
JWT_ACCESS_SECRET=<long random string>
JWT_REFRESH_SECRET=<different long random string>
BCRYPT_SALT_ROUNDS=10
CORS_ORIGIN=https://cryptosite-seven.vercel.app,https://*.vercel.app
DB_SYNC_ALTER=false
```

Optional but recommended:

```dotenv
REDIS_URL=rediss://default:<password>@<host>:6379
ADMIN_BOOTSTRAP_EMAIL=admin@local.dev
ADMIN_BOOTSTRAP_PASSWORD=<strong password>
COINGECKO_API_BASE=https://api.coingecko.com/api/v3
```

Notes:

- `DB_SYNC_ALTER=false` — keep automatic schema alteration **off** in production
  so schema changes are intentional and startup is fast. (The repo's local
  `server/.env` uses `true`; that is fine for local development only.)
- The Redis URL is optional for correctness now — the API degrades gracefully —
  but keeping a healthy Redis restores caching performance.

### Step 4 — Trigger the deploy

Push (Step 1) auto-deploys if auto-deploy is on; otherwise click **Manual Deploy →
Deploy latest commit**. Wait for the build to finish, then open the logs and
confirm the boot sequence:

```
Database connected successfully
Server running on http://localhost:<port>
```

`[env] ...` warnings are informational. `[cache] Redis ... failed, using in-memory fallback`
is expected if Redis is unhealthy and is **not** an error condition.

### Step 5 — Verify production

Health check:

```bash
curl -s https://cryptosite-yc00.onrender.com/api/health
```

Expect `database.ok: true`. If the cache line shows `"degraded": true`, the API is
running normally on the in-memory fallback.

Full authenticated smoke test (from the repo root):

```bash
BASE=https://cryptosite-yc00.onrender.com/api \
EMAIL=admin@local.dev \
PASSWORD='ChangeMeNow123!' \
node server/scripts/smoke-test.mjs
```

Expect:

```
SUMMARY: 55 endpoints probed, 0 returned 5xx
All endpoints healthy.
```

The script exits non-zero if any endpoint returns 5xx, so it can gate your deploy.

### Step 6 — Spot-check the previously-failing endpoint

```bash
TOKEN=$(curl -s -X POST https://cryptosite-yc00.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local.dev","password":"ChangeMeNow123!"}' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).accessToken))")

curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  https://cryptosite-yc00.onrender.com/api/admin/analytics/overview
```

Expect `200` (was `500`).

---

## 4. Files changed (backend)

| File | Change |
| --- | --- |
| `server/src/config/cache.ts` | Fail-safe Redis wrapper with in-memory fallback; `degraded` status; throttled failure logging |
| `server/src/middleware/errorHandler.ts` | **New** — correlation IDs, error categorisation, safe responses, process guards |
| `server/src/config/env.ts` | Added `validateRuntimeEnv()` / `logEnvWarnings()` |
| `server/src/app.ts` | Wired correlation ID + central error handler + `notFoundHandler`; enriched `/api/health`; startup warnings |
| `server/src/controllers/analyticsController.ts` | Forward errors to the central handler |
| `server/src/controllers/operationsController.ts` | `fail()` no longer leaks internal messages on 5xx; logs with correlation ID |
| `server/src/server.ts` | Register process-level handlers |
| `server/dist/**` | Rebuilt compiled output (tracked in git) |
| `server/scripts/smoke-test.mjs` | **New** — authenticated endpoint sweep / deploy gate |

Previously changed in the auth-refresh work (still in effect):

| File | Change |
| --- | --- |
| `server/src/controllers/authController.ts` | `POST /auth/refresh` signs a clean access token (fixes refresh 401) |
| `server/src/config/corsOrigins.ts` | Shared wildcard-aware origin allow-list |
| `server/src/realtime/socket.ts` | Uses the shared origin allow-list |

---

## 5. Final report

1. **Overall root cause of the widespread API failures.**
   A single shared infrastructure defect: the Redis cache layer
   (`server/src/config/cache.ts`) awaited Redis operations with no error handling.
   The production Redis connection rejects every command
   (`Stream isn't writeable and enableOfflineQueue options is false`), so any
   endpoint that touched the cache threw an unhandled error and returned HTTP 500.

2. **Was Neon database connectivity involved?**
   No. Production `GET /api/health` returns `database.ok: true`, and every SQL
   query used by the failing analytics endpoint was executed successfully against
   the live Neon database (verified via `psql`).

3. **Were there Prisma schema/migration problems?**
   No — and note the project uses **Sequelize**, not Prisma. The schema matches the
   code: all 39 tables exist, every referenced column is present, all four
   defensive `reconcile*Schema()` helpers complete, and no relation mismatches
   were found. No migration or schema change was required.

4. **Did authentication middleware contribute?**
   No. `authenticate` correctly returns 401 without a token and 200 with a valid
   one. The earlier refresh-token 401 bug was already fixed and verified
   (`POST /api/auth/refresh` → 200 on production).

5. **Backend files changed.** See section 4.

6. **Endpoints tested.** 55 endpoints probed (9 public, 46 authenticated) against
   production and against a locally-run build using the exact production Redis
   failure. See section 1 (blast radius) and the smoke-test script.

7. **Endpoints confirmed working.**
   - Production (old code): 54/55 return 200; only `/api/admin/analytics/overview` returns 500.
   - Locally with the fix, under the exact production Redis failure: **55/55 return 200**.

8. **Remaining Render configuration / deployment work.**
   - Push the commit (section 3, Step 1).
   - Confirm build/start commands and `NODE_ENV=production`, `DB_SYNC_ALTER=false`,
     and `CORS_ORIGIN` on Render (Steps 2–3).
   - Deploy and run the smoke test (Steps 4–6).
   - Investigate the Upstash Redis instance separately if you want Redis caching
     back (the API is fully functional without it).
