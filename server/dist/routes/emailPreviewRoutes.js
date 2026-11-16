"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emailClient_1 = require("../services/email/emailClient");
const verification_1 = require("../services/email/templates/verification");
/**
 * Development-only email preview.
 *
 * This router is mounted exclusively when `NODE_ENV !== "production"` (see
 * `app.ts`) and every handler re-checks the environment so it can never be
 * reached on a deployed instance. It renders the branded verification email
 * with clearly identified SAMPLE data — no real verification token is ever
 * generated, read, or exposed here.
 */
const router = (0, express_1.Router)();
const SAMPLE_NAME = "Sample Member";
const SAMPLE_EXPIRES_MINUTES = 30;
function isProduction() {
    return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}
function blockInProduction(res) {
    if (isProduction()) {
        res.status(404).json({ message: "Not found" });
        return true;
    }
    return false;
}
function sampleVerifyUrl() {
    const baseUrl = (0, emailClient_1.getAppBaseUrl)();
    return `${baseUrl}/verify-email/SAMPLE-TOKEN-NOT-A-REAL-TOKEN`;
}
/** The verification email itself, rendered with sample data. */
router.get("/verification", (req, res) => {
    if (blockInProduction(res))
        return;
    const format = String(req.query.format || "html").toLowerCase();
    const { html, text } = (0, verification_1.renderVerificationEmail)({
        name: SAMPLE_NAME,
        verifyUrl: sampleVerifyUrl(),
        expiresMinutes: SAMPLE_EXPIRES_MINUTES
    });
    if (format === "text") {
        res
            .status(200)
            .type("text/plain")
            .send([
            "NexaCrypto verification email — PLAIN TEXT ALTERNATIVE (sample data)",
            "-----------------------------------------------------------------",
            "",
            text
        ].join("\n"));
        return;
    }
    res.status(200).type("text/html").send(html);
});
/**
 * A side-by-side preview harness: the same email rendered in a desktop-width
 * and a mobile-width frame, plus a link to the plain-text alternative.
 */
router.get("/", (_req, res) => {
    if (blockInProduction(res))
        return;
    const base = "/api/dev/email-preview";
    res.status(200).type("text/html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>NexaCrypto email preview (development only)</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; padding: 24px; background: #0B0C0E; color: #F5F5F7;
             font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
      h1 { font-size: 16px; letter-spacing: 0.02em; margin: 0 0 6px 0; }
      p.note { color: #92969D; font-size: 12px; margin: 0 0 20px 0; }
      .frames { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; }
      .frame { border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; overflow: hidden; background: #111315; }
      .frame h2 { font-size: 11px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase;
                  color: #C6A15B; margin: 0; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.09); }
      iframe { display: block; border: 0; background: #0B0C0E; }
      a { color: #C6A15B; }
    </style>
  </head>
  <body>
    <h1>NexaCrypto — verification email preview</h1>
    <p class="note">Development only. Sample data. No real verification token is used.
      <a href="${base}/verification?format=text" target="_blank" rel="noreferrer">Open the plain-text alternative</a>.</p>
    <div class="frames">
      <div class="frame">
        <h2>Desktop · 600px</h2>
        <iframe src="${base}/verification?format=html" title="Desktop preview" width="600" height="900"></iframe>
      </div>
      <div class="frame">
        <h2>Mobile · 375px</h2>
        <iframe src="${base}/verification?format=html" title="Mobile preview" width="375" height="900"></iframe>
      </div>
    </div>
  </body>
</html>`);
});
/**
 * The development outbox: messages captured by `sendEmail` while
 * `EMAIL_DEV_OUTBOX_ENABLED` is on. This is separate from the preview route
 * above and exists so a developer can finish the real verification flow
 * locally; it stays empty (and returns nothing) unless explicitly enabled.
 */
router.get("/outbox", (req, res) => {
    if (blockInProduction(res))
        return;
    if (!(0, emailClient_1.isEmailOutboxEnabled)()) {
        res.status(200).json({
            enabled: false,
            message: "The development email outbox is disabled. Set EMAIL_DEV_OUTBOX_ENABLED=true to capture outgoing messages locally."
        });
        return;
    }
    const format = String(req.query.format || "json").toLowerCase();
    const entries = (0, emailClient_1.getEmailOutbox)();
    if (format === "text") {
        res
            .status(200)
            .type("text/plain")
            .send(entries.length === 0
            ? "Outbox is empty."
            : entries
                .map((entry) => entry.text || `[html only]\n${entry.subject}`)
                .join("\n\n------------------------------\n\n"));
        return;
    }
    res.status(200).json({
        enabled: true,
        count: entries.length,
        messages: entries.map((entry) => ({
            capturedAt: entry.capturedAt,
            to: entry.to,
            subject: entry.subject,
            previewHtmlUrl: `/api/dev/email-preview/outbox/${encodeURIComponent(entry.capturedAt)}`,
            text: entry.text ?? null
        }))
    });
});
/** Renders a single captured outbox message as HTML. */
router.get("/outbox/:capturedAt", (req, res) => {
    if (blockInProduction(res))
        return;
    if (!(0, emailClient_1.isEmailOutboxEnabled)()) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    const entry = (0, emailClient_1.getEmailOutbox)().find((item) => item.capturedAt === String(req.params.capturedAt));
    if (!entry) {
        res.status(404).json({ message: "Not found" });
        return;
    }
    res.status(200).type("text/html").send(entry.html);
});
/** Empties the development outbox. */
router.delete("/outbox", (_req, res) => {
    if (blockInProduction(res))
        return;
    (0, emailClient_1.clearEmailOutbox)();
    res.status(200).json({ ok: true });
});
exports.default = router;
