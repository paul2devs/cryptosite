const LOCAL_API_BASE = "http://localhost:4000/api";

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function normalize(base: string): string {
  return base.replace(/\/+$/, "");
}

let warned = false;

/**
 * Single source of truth for the backend API base URL.
 *
 * Resolution order:
 *  1. `VITE_API_BASE_URL` (set this in every deployed environment).
 *  2. `http://localhost:4000/api` when the app runs on localhost.
 *  3. Same-origin `/api` for deployed builds that forgot to set the variable,
 *     so requests never silently point at localhost in production.
 */
export function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return normalize(configured.trim());
  }

  if (typeof window !== "undefined" && window.location) {
    if (isLocalHost(window.location.hostname)) {
      return LOCAL_API_BASE;
    }
    if (!warned) {
      warned = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[NexaCrypto] VITE_API_BASE_URL is not set for this build. Falling back to same-origin " +
          "`/api`. Set VITE_API_BASE_URL to the deployed API URL (for example " +
          "https://your-api.onrender.com/api) and rebuild."
      );
    }
    return "/api";
  }

  return LOCAL_API_BASE;
}

/** Origin (no `/api` suffix) used by the realtime socket client. */
export function resolveApiOrigin(): string {
  return resolveApiBaseUrl().replace(/\/api$/, "");
}

export { LOCAL_API_BASE };
