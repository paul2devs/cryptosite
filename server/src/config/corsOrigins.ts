/**
 * Single source of truth for cross-origin allow-listing across the HTTP API and
 * the realtime socket server.
 *
 * Origins come from the built-in defaults plus the comma-separated `CORS_ORIGIN`
 * environment variable. Entries in `CORS_ORIGIN` may contain `*` wildcards, for
 * example `CORS_ORIGIN=https://*.vercel.app` to accept Vercel preview domains.
 */
export const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://nexocrypto.org",
  "https://www.nexocrypto.org"
];

function configuredOrigins(): string[] {
  return (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function matchesPattern(origin: string, pattern: string): boolean {
  if (!pattern.includes("*")) {
    return origin === pattern;
  }
  const escaped = pattern
    .split("*")
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`, "i").test(origin);
}

export function isOriginAllowed(origin: string | undefined | null): boolean {
  // Same-origin / server-to-server requests send no Origin header.
  if (!origin) {
    return true;
  }
  return [...defaultAllowedOrigins, ...configuredOrigins()].some((allowed) =>
    matchesPattern(origin, allowed)
  );
}
