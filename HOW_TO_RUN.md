# NexaCrypto — How to Run (Step by Step)

This project is an npm-workspaces monorepo:

```
cryptosite/
├─ package.json          # root: workspaces + scripts
├─ client/               # React 18 + Vite + Redux + Tailwind (dev server on :5173)
└─ server/               # Node + TypeScript + Express + Sequelize + PostgreSQL + Redis (API on :4000)
```

---

## 1. Prerequisites

Install these first:

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 18 LTS or 20 LTS | `node -v` |
| npm | 9 or 10 | ships with Node; must support workspaces |
| PostgreSQL | 13+ | You can use a local DB or a hosted Postgres (Neon is already configured in `server/.env`) |
| Redis | optional | Used for rate limiting / caching. The configured Upstash URL works over TLS |

Verify:

```bash
node -v
npm -v
```

---

## 2. Install dependencies

Run once from the repository root. This installs the root, `server/`, and `client/` dependencies together:

```bash
cd /home/paulsmithdev/Desktop/cryptosite
npm install
```

---

## 3. Configure the server environment

The server reads `server/.env` (the loader checks, in order: `.env.local`, `.env`, `env.local`, `env`).

If `server/.env` does not exist yet, create it. Minimum required keys:

```dotenv
# --- Required ---
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
JWT_ACCESS_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string
BCRYPT_SALT_ROUNDS=10
CORS_ORIGIN=http://localhost:5173

# --- Redis (rate limiting / caching). Optional in dev but recommended ---
REDIS_URL=rediss://default:PASSWORD@HOST:6379

# --- Database sync ---
# true  -> sequelize.sync({ alter: true }) runs on boot and reconciles schema
# false -> no schema changes are applied automatically
DB_SYNC_ALTER=true

# --- First-run admin account (only created when no admin exists) ---
ADMIN_BOOTSTRAP_EMAIL=admin@local.dev
ADMIN_BOOTSTRAP_PASSWORD=ChangeMeNow123!
```

Notes:

- `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are validated on start — the server refuses to boot without them.
- On the first start, if no admin user exists, the server creates one using `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` and **prints the credentials to the console**. In production a password is mandatory; in development one is generated and printed if you leave it blank.
- The repo already ships a `server/.env` with a working Neon `DATABASE_URL`, Upstash `REDIS_URL`, market-data bases, and per-chain deposit addresses. For a fresh environment, copy its structure and replace the secrets.

### Optional: blockchain deposit verification, market data, email

```dotenv
# Market data (server-side)
COINGECKO_API_BASE=https://api.coingecko.com/api/v3
BINANCE_API_BASE=https://api.binance.com/api/v3/ticker/24hr

# On-chain deposit verification
BLOCKCHAIN_VERIFICATION_ENABLED=true
BTC_BLOCKCHAIN_API_BASE=https://blockstream.info/api
ETHERSCAN_API_BASE=https://api.etherscan.io/api
ETHERSCAN_API_KEY=your-etherscan-key
TRONSCAN_API_BASE=https://apilist.tronscanapi.com/api
SOLANA_RPC_URL=https://your-solana-rpc

# Multiplier engine tuning
MULTIPLIER_MAX_STACKED=2
MULTIPLIER_DIMINISHING_FACTOR=0.5

# Email (SMTP) — only needed for transactional emails / password reset
EMAIL_FROM="NexaCrypto <no-reply@example.com>"
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASS=your-smtp-password
```

---

## 4. Configure the client environment (optional)

All client variables are optional and have sensible defaults. Put them in `client/.env` if you need to override:

```dotenv
# API base for axios / realtime. Default: http://localhost:4000/api
VITE_API_BASE_URL=http://localhost:4000/api

# Public market snapshot provider used by the landing page.
# Default: CoinGecko /simple/price
VITE_MARKET_API_URL=https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether,binancecoin,ripple&vs_currencies=usd&include_market_cap=true&include_24hr_change=true
VITE_MARKET_API_KEY=

# Canonical site URL used by SEO tags
VITE_APP_BASE_URL=http://localhost:5173

# Support link used by the support widget
VITE_SUPPORT_TELEGRAM_URL=https://t.me/nexacrypto_support
```

If you leave `VITE_MARKET_API_URL` unset, the landing page pulls live prices directly from the public CoinGecko endpoint. Prices are never hardcoded — if the feed returns nothing, the UI shows a muted dash instead of inventing a number.

### Deployed environments (important)

For a deployed client you **must** set `VITE_API_BASE_URL` to the public API URL (including the `/api` suffix) in the host's environment variables **before** building:

```dotenv
VITE_API_BASE_URL=https://<your-api-host>/api
```

The base URL is resolved once, in `client/src/utils/apiBase.ts`, in this order:

1. `VITE_API_BASE_URL` if present.
2. `http://localhost:4000/api` when the page is served from `localhost` / `127.0.0.1`.
3. Same-origin `/api` as a last resort (with a console warning).

If `VITE_API_BASE_URL` is missing from a deployed build, every authenticated request (portfolio, transactions, dashboard, etc.) fails and surfaces as "Failed to load…" errors. Older builds fell back to `http://localhost:4000/api`, which made a deployed browser call the visitor's own machine — the classic cause of this symptom.

---

## 5. Run in development

### Option A — start both server and client together (recommended)

From the repository root:

```bash
npm run dev
```

This runs the API and the Vite dev server concurrently.

### Option B — start them in separate terminals

Terminal 1 (API):

```bash
npm run dev:server
```

Terminal 2 (web app):

```bash
npm run dev:client
```

### URLs

| Service | URL |
| --- | --- |
| Web app (Vite) | http://localhost:5173 |
| API | http://localhost:4000 |
| Public landing page | http://localhost:5173/landing |

On server boot you should see:

```
Database connected successfully
Admin bootstrap account ensured        # only on first run
Server running on http://localhost:4000
```

Keep `CORS_ORIGIN` in `server/.env` matching the client origin (`http://localhost:5173` in dev) or the browser will block API calls.

For a deployed server, set `CORS_ORIGIN` to the deployed frontend origin(s), comma-separated. `*` wildcards are supported (via `server/src/config/corsOrigins.ts`), which is handy for Vercel preview domains:

```dotenv
CORS_ORIGIN=https://cryptosite-seven.vercel.app,https://*.vercel.app
```

---

## 6. Run the tests

Server domain-logic tests (TypeScript compiled then run with `node --test`):

```bash
npm --workspace server run test
```

Expected: all suites pass (78 tests).

---

## 7. Type-check and build for production

Type-check the client (no emit):

```bash
cd client && npx tsc --noEmit
```

Build the client bundle:

```bash
npm --workspace client run build
```

Build the server (compiles TypeScript to `server/dist`):

```bash
npm --workspace server run build
```

---

## 8. Run in production

1. Build both workspaces (see step 7).
2. Start the API:

   ```bash
   npm --workspace server run start
   ```

   This runs `node server/dist/server.js`.
3. Serve the built client (`client/dist`) with any static host. The included `.vercel.json` rewrites all routes to `/index.html` so client-side routing works. Point your host's environment variable for the API base (`VITE_API_BASE_URL`) at the deployed API URL and rebuild the client.
4. Set `NODE_ENV=production`, a strong `ADMIN_BOOTSTRAP_PASSWORD`, and `DB_SYNC_ALTER=false` in production so schema changes are intentional.

---

## 9. Troubleshooting

| Symptom | Cause / Fix |
| --- | --- |
| `Missing required environment variable: DATABASE_URL` | `server/.env` is missing or the key is empty. Add it and restart. |
| `Database connection failed` | Wrong `DATABASE_URL`, network/SSL issue, or the DB is asleep (Neon free tier auto-suspends — first request wakes it). |
| Browser console shows CORS errors | `CORS_ORIGIN` in `server/.env` must exactly match the client origin. |
| Landing prices show `—` | The public market feed is unreachable or rate-limited. Set `VITE_MARKET_API_URL` / `VITE_MARKET_API_KEY`. |
| `ESLint couldn't find an eslint.config.(js|mjs|cjs) file` | Pre-existing repo issue: ESLint 9 is installed but the repo still uses the legacy config format. This does not affect running, building, or the tests. |
| Port already in use | Change `PORT` in `server/.env`, or Vite's `server.port` in `client/vite.config.ts`. |
