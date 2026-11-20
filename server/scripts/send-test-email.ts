/**
 * Resend email smoke test.
 *
 * Sends NexaCrypto's real transactional templates through the same central
 * `sendEmail` path used in production, so the provider integration, the branded
 * templates and the failure handling can be verified without touching the app.
 *
 * Usage (from the `server` directory):
 *   node ../node_modules/ts-node/dist/bin.js --transpile-only scripts/send-test-email.ts --type=test --to=you@example.com
 *   npm run email:test -- --type=all --to=you@example.com
 *
 * Options:
 *   --type=test|welcome|verification|password-reset|deposit|withdrawal|investment|all
 *   --to=<email>            (falls back to the EMAIL_TEST_TO env var)
 *
 * The API key is read from the backend environment only; it is never printed.
 */
import "../src/config/env";

import { isEmailEnabled, sendEmail } from "../src/services/email/emailClient";
import { renderPasswordResetRequestEmail, renderWelcomeEmail } from "../src/services/email/templates/account";
import { renderAccountEventEmail } from "../src/services/email/templates/events";
import { renderVerificationEmail } from "../src/services/email/templates/verification";

type EmailType =
  | "test"
  | "welcome"
  | "verification"
  | "password-reset"
  | "deposit"
  | "withdrawal"
  | "investment";

const ALL_TYPES: EmailType[] = [
  "test",
  "welcome",
  "verification",
  "password-reset",
  "deposit",
  "withdrawal",
  "investment"
];

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      out[body.slice(0, eq)] = body.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[body] = next;
        i += 1;
      } else {
        out[body] = "true";
      }
    }
  }
  return out;
}

function buildMessage(type: EmailType, name: string): { subject: string; html: string; text?: string } {
  switch (type) {
    case "welcome":
      return renderWelcomeEmail({ name });
    case "verification": {
      const rendered = renderVerificationEmail({
        name,
        verifyUrl: "https://example.com/verify-email/SMOKE-TEST-TOKEN",
        expiresMinutes: 30
      });
      return { subject: rendered.subject, html: rendered.html, text: rendered.text };
    }
    case "password-reset":
      return renderPasswordResetRequestEmail({
        name,
        resetUrl: "https://example.com/reset-password/SMOKE-TEST-TOKEN",
        expiresMinutes: 30
      });
    case "deposit":
      return renderAccountEventEmail({
        name,
        subject: "Deposit submitted: 0.05000000 BTC",
        heading: "Deposit submitted",
        preheader: "We've received your deposit and it is being verified.",
        message: "Your deposit has been submitted and is awaiting platform verification before your wallet can be credited.",
        details: [
          { label: "Reference", value: "DEP-SMOKETEST01" },
          { label: "Amount", value: "0.05000000 BTC" },
          { label: "Date", value: new Date().toISOString() }
        ],
        statusLabel: "Awaiting platform verification",
        statusTone: "gold",
        ctaLabel: "View deposit",
        ctaPath: "/deposit"
      });
    case "withdrawal":
      return renderAccountEventEmail({
        name,
        subject: "Withdrawal processed: 250.00 USDT",
        heading: "Withdrawal processed",
        preheader: "Your withdrawal has been processed successfully.",
        message: "Your withdrawal request has been processed and your funds are on the way.",
        details: [
          { label: "Reference", value: "WD-SMOKETEST01" },
          { label: "Amount", value: "250.00 USDT" },
          { label: "Status", value: "Completed" }
        ],
        statusLabel: "Processed",
        statusTone: "positive",
        ctaLabel: "View transactions",
        ctaPath: "/transactions"
      });
    case "investment":
      return renderAccountEventEmail({
        name,
        subject: "Investment created: 100.00 USDT",
        heading: "Investment created",
        preheader: "Your investment is now active and accruing earnings.",
        message: "Your investment has been created and is now active. Earnings are credited as they are verified.",
        details: [
          { label: "Reference", value: "INV-SMOKETEST01" },
          { label: "Amount", value: "100.00 USDT" }
        ],
        statusLabel: "Active",
        statusTone: "gold",
        ctaLabel: "View portfolio",
        ctaPath: "/portfolio"
      });
    case "test":
    default:
      return renderAccountEventEmail({
        name,
        subject: "NexaCrypto email delivery test",
        heading: "Email delivery test",
        preheader: "Your Resend integration is working.",
        message: "This is a test message confirming that NexaCrypto can deliver transactional email through Resend.",
        details: [
          { label: "Provider", value: "Resend" },
          { label: "Environment", value: String(process.env.NODE_ENV || "development") }
        ],
        statusLabel: "Delivered",
        statusTone: "positive"
      });
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const recipient = String(args.to || process.env.EMAIL_TEST_TO || "").trim();
  const requested = String(args.type || "test").trim();
  const name = String(args.name || "Test Member");

  if (!recipient) {
    // eslint-disable-next-line no-console
    console.error("Missing recipient. Pass --to=<email> or set EMAIL_TEST_TO.");
    process.exitCode = 2;
    return;
  }

  if (!isEmailEnabled()) {
    // eslint-disable-next-line no-console
    console.error("EMAIL_ENABLED is not true; refusing to report a false success. Set EMAIL_ENABLED=true and RESEND_API_KEY.");
    process.exitCode = 2;
    return;
  }

  const types: EmailType[] = requested === "all" ? ALL_TYPES : [requested as EmailType];
  if (types.some((t) => !ALL_TYPES.includes(t))) {
    // eslint-disable-next-line no-console
    console.error(`Unknown --type="${requested}". Valid: ${ALL_TYPES.join(", ")}, all.`);
    process.exitCode = 2;
    return;
  }

  let failures = 0;
  for (const type of types) {
    const message = buildMessage(type, name);
    try {
      await sendEmail({ to: recipient, ...message });
      // eslint-disable-next-line no-console
      console.log(`OK   ${type.padEnd(14)} -> ${recipient}`);
    } catch (error) {
      failures += 1;
      const reason = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(`FAIL ${type.padEnd(14)} -> ${recipient}: ${reason}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\n${types.length - failures}/${types.length} email(s) accepted by Resend.`);
  if (failures > 0) process.exitCode = 1;
}

void main();
