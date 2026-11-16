# NexaCrypto — Mandatory Email Verification: Setup & Run Guide

This document explains **how to run the mandatory email verification system** and
**exactly what must be present in your `.env`**.

It covers two things that ship together:

- **Part A — Mandatory email verification** (backend-enforced, not a client flag).
- **Part B — Advanced branded email template system** (the premium HTML email +
  a development-only preview).

---

## 1. What was built (quick map)

| Area | File |
| --- | --- |
| Verification token logic (SHA-256, single-use, expiry, row locks) | `server/src/services/emailVerificationService.ts` |
| Token model | `server/src/models/EmailVerificationToken.ts` |
| Enforced-by-DB guard for every protected route | `server/src/middleware/auth.ts` |
| Register / login / verify / resend endpoints | `server/src/controllers/authController.ts` |
| Routes + rate limiting | `server/src/routes/authRoutes.ts` |
| Email sending | `server/src/services/email/emailService.ts`, `server/src/services/email/emailClient.ts` |
| Branded email design system (layout/header/hero/button/footer/info) | `server/src/services/email/templates/brand.ts` |
| The verification email | `server/src/services/email/templates/verification.ts` |
| Dev-only preview + outbox | `server/src/routes/emailPreviewRoutes.ts` (mounted in `server/src/app.ts`) |
| Migration (adds + backfills `email_verified`) | `server/src/config/database.ts` |
| Frontend verification screen (all 4 states) | `client/src/pages/VerifyEmailPage.tsx` |
| Frontend 403 interception | `client/src/utils/api.ts` |
| Routes / guards / boot listener | `client/src/App.tsx` |
| Register + login redirects | `client/src/pages/RegisterPage.tsx`, `client/src/pages/LoginPage.tsx` |

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Creates an **unverified** account, emails a link, **does not** sign the user in. |
| `POST` | `/api/auth/verify-email` | Consumes the token. Returns `verified` / `already_verified` (200), `expired` (410), `invalid` (400). |
| `POST` | `/api/auth/resend-verification` | Sends a fresh link. Always returns a generic 200 (no account enumeration). |
| `POST` | `/api/auth/login` | Valid but unverified credentials → `403 { code: "EMAIL_NOT_VERIFIED" }`. |

### Frontend screens

- `/verify-email` → "check your inbox" (waiting) state.
- `/verify-email/:token` → the emailed link. Renders **success / expired / invalid** automatically.

---

## 2. Prerequisites

- Node.js 18+ and npm (the repo is an npm-workspaces monorepo: `server` + `client`).
- A PostgreSQL database (Neon, Render, or local Postgres all work).
- An SMTP provider **only if you want real email delivery**. For local
  development you do **not** need SMTP — use the dev outbox (section 5).

---

## 3. Environment variables

### 3.1 Where the server reads `.env` from

The server loads the **first file that exists**, in this order:

1. `server/.env.local`
2. `server/.env` ← *(this is the file currently in the repo)*
3. `server/env.local`
4. `server/env`

So: **edit `server/.env`** (or create `server/.env.local` to override it).

### 3.2 Server — required (already in your `.env`, not new)

These are mandatory for the app to boot; email verification reuses them.

```dotenv
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require
JWT_ACCESS_SECRET=change-me-to-a-long-random-string
JWT_REFRESH_SECRET=change-me-to-a-different-long-random-string
BCRYPT_SALT_ROUNDS=10
CORS_ORIGIN=http://localhost:5173
```

### 3.3 Server — email delivery (add these)

Real delivery is **opt-in** through `EMAIL_ENABLED`. When it is `false` the
server still works: the verification flow can be completed locally via the dev
outbox (section 5).

```dotenv
# Master switch for outbound email. Set to true to actually deliver mail.
EMAIL_ENABLED=true

# Sender identity shown in the email's "From:" field.
EMAIL_FROM=NexaCrypto <no-reply@nexacrypto.com>

# SMTP transport
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587                 # 587 (STARTTLS) or 465 (implicit TLS)
SMTP_SECURE=false             # true for 465, false for 587 (auto-forced true when port is 465)
SMTP_USER=you@yourprovider.com
SMTP_PASS=your-smtp-password-or-api-key

# Optional connection pooling (these are the defaults)
SMTP_POOL=true
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
```

> If `EMAIL_ENABLED=true` but `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` are
> missing, the server logs a clear `[env]` warning at boot and the send fails
> gracefully (the account is **never** marked verified by the email step).

### 3.4 Server — verification behaviour

```dotenv
# Base URL used to build the link inside the email: <APP_BASE_URL>/verify-email/<token>
# Set this to your FRONTEND origin. Falls back to PUBLIC_APP_URL, then FRONTEND_URL,
# then http://localhost:5173.
APP_BASE_URL=http://localhost:5173

# How long a verification link stays valid. Default 30, clamped to 5..1440 minutes.
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=30

# Minimum seconds between two verification emails for the same account. Default 60, clamped 0..3600.
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60
```

### 3.5 Server — dev-only preview / outbox

```dotenv
# Never active when NODE_ENV=production. Captures outgoing mail in memory so you
# can finish the verification flow locally without SMTP.
EMAIL_DEV_OUTBOX_ENABLED=true
NODE_ENV=development
```

### 3.6 Server — rate limits (optional, defaults shown)

```dotenv
RATE_LIMIT_VERIFY_WINDOW_MS=900000          # 15 min
RATE_LIMIT_VERIFY_MAX=20                    # token-submission attempts per window per IP
RATE_LIMIT_RESEND_VERIFICATION_WINDOW_MS=900000
RATE_LIMIT_RESEND_VERIFICATION_MAX=5        # resend requests per window per IP
```

### 3.7 Client — `client/.env`

```dotenv
# Backend API base. Required for non-localhost builds.
# Falls back to http://localhost:4000/api when running on localhost.
VITE_API_BASE_URL=http://localhost:4000/api
```

---

## 4. Run it — step by step

```bash
# 1) From the repo root, install both workspaces
cd /home/paulsmithdev/Desktop/cryptosite
npm install

# 2) Confirm your server/.env contains the variables from section 3.
#    At minimum: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET.
#    For local email testing also add:
#      APP_BASE_URL=http://localhost:5173
#      EMAIL_DEV_OUTBOX_ENABLED=true
#      NODE_ENV=development

# 3) (Optional) type-check / build both workspaces
npm --workspace server run build
npm --workspace client run build

# 4) Start backend + frontend together
npm run dev
# or separately:
#   npm run dev:server     # http://localhost:4000
#   npm run dev:client     # http://localhost:5173
```

**Migrations run automatically.** On boot the server runs
`sequelize.sync({ alter: true })` plus `reconcileUsersSchema`, which:

- adds `email_verified` / `email_verified_at` if the columns are missing, and
- **backfills existing accounts as verified once**, so users who registered
  before this feature are not locked out.

---

## 5. Testing the flow locally (no SMTP needed)

1. Set `NODE_ENV=development` and `EMAIL_DEV_OUTBOX_ENABLED=true` in `server/.env`
   (leave `EMAIL_ENABLED=false` if you don't have an SMTP provider).
2. Restart the server.
3. Register at <http://localhost:5173/register>. You are redirected to
   `/verify-email` — **note that you are not signed in.**
4. Fetch the verification link from the dev outbox:

   - Human-readable: <http://localhost:4000/api/dev/email-preview/outbox?format=text>
   - JSON: <http://localhost:4000/api/dev/email-preview/outbox>
   - Open the message HTML: click `previewHtmlUrl` in the JSON.

5. Copy the `/verify-email/<token>` link and open it → **success state** → click
   "Continue to NexaCrypto" → sign in on `/login`.

### Branded email preview (design review)

- Side-by-side desktop (600px) + mobile (375px): <http://localhost:4000/api/dev/email-preview>
- Raw HTML: `.../api/dev/email-preview/verification?format=html`
- Plain-text alternative: `.../api/dev/email-preview/verification?format=text`

> The preview and outbox routes return `404` when `NODE_ENV=production`.

### Verify behaviour with curl

```bash
# Register (creates an unverified account, returns NO tokens)
curl -i -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Passw0rd!23"}'

# Verify a token (grab <token> from the outbox)
curl -i -X POST http://localhost:4000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"<token>"}'

# Resend (always a generic 200)
curl -i -X POST http://localhost:4000/api/auth/resend-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Login before verifying -> 403 { "code": "EMAIL_NOT_VERIFIED" }
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Passw0rd!23"}'
```

### Spec test checklist

| Test | Expected |
| --- | --- |
| Register | Account created, no session issued, redirected to `/verify-email`. |
| Login with valid but unverified credentials | `403 EMAIL_NOT_VERIFIED` + clear message + resend offered (not "invalid credentials"). |
| Open the emailed link | Email marked verified in the DB; success state shown. |
| Re-open the same link | "Already confirmed" / invalid state; never re-verifies. |
| Expired link (past TTL) | Expired state + resend option. |
| Resend | Fresh token issued, old token invalidated, cooldown enforced, generic response. |
| Protected APIs with an unverified token | `403 EMAIL_NOT_VERIFIED` (checked against the DB row, not a client flag). |
| Existing verified accounts | Still work (migration backfill). |
| Admin tooling | Administrators are exempt so the back office keeps working. |
| Token safety | Crypto-random, SHA-256 hashed, single-use, expiring, never logged. |

---

## 6. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `[env] EMAIL_ENABLED: ... not true` warning | Expected when `EMAIL_ENABLED=false`. Use the dev outbox or set delivery vars. |
| `[env] SMTP_HOST: EMAIL_ENABLED is true but ... not set` | You enabled email without SMTP credentials. Add `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` or set `EMAIL_ENABLED=false`. |
| Email link points at `localhost:5173` on a deployment | Set `APP_BASE_URL` to your public frontend origin. |
| `/api/dev/email-preview` returns 404 | `NODE_ENV=production`. The tools are dev-only by design. |
| Outbox is empty | `EMAIL_DEV_OUTBOX_ENABLED` is not `true`, or you are in production. |
| Verification link "expired" immediately | Clock skew, or `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES` set too low. |
| 429 on resend | IP rate limit (`RATE_LIMIT_RESEND_VERIFICATION_MAX`). Raise it or wait. |
| Users locked out after deploy | Ensure the server booted once so the migration backfill ran. |
